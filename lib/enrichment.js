import dns from "dns";
import axios from "axios";
import OpenAI from "openai";
import { scrapeEmailFromWebsite, guessAndVerifyEmail } from "./email.js";

dns.setDefaultResultOrder("ipv4first");

/**
 * Extracts the domain name from a URL.
 * @param {string} url 
 * @returns {string|null} Domain name
 */
function extractDomain(url) {
  if (!url || url === "No website found" || !url.startsWith("http")) return null;
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./i, "");
  } catch {
    return null;
  }
}

/**
 * Queries Hunter.io Domain Search API to find emails for a domain.
 * @param {string} domain 
 * @returns {Promise<{email: string, ownerName: string}|null>}
 */
async function queryHunter(domain) {
  const apiKey = process.env.HUNTER_API_KEY;
  if (!apiKey || !domain) return null;

  try {
    console.log(`[Enrichment] Querying Hunter.io for domain: ${domain}`);
    const url = `https://api.hunter.io/v2/domain-search?domain=${encodeURIComponent(domain)}&api_key=${apiKey}`;
    const response = await axios.get(url, { timeout: 4000 });
    const data = response.data?.data;
    if (!data) return null;

    const emails = data.emails || [];
    // Find email with an owner/manager position or the first one with a first name
    const bestEmail = emails.find(e => e.position?.toLowerCase().includes("owner") || e.position?.toLowerCase().includes("founder") || e.first_name) || emails[0];

    return {
      email: bestEmail?.value || "N/A",
      ownerName: bestEmail?.first_name || "N/A"
    };
  } catch (err) {
    console.error(`[Enrichment] Hunter.io lookup failed for ${domain}:`, err.message);
    return null;
  }
}

/**
 * Queries Google via Serper Search and uses OpenRouter to extract contact details.
 * @param {string} leadName 
 * @param {string} location 
 * @returns {Promise<{ownerName: string, email: string, socialLink: string}|null>}
 */
async function queryGoogleAndAI(leadName, location) {
  if (!process.env.SERPER_API_KEY || !process.env.OPENROUTER_API_KEY) {
    return null;
  }

  try {
    console.log(`[Enrichment] Querying Google + AI for lead: ${leadName}`);
    const searchQuery = `"${leadName}" ${location} contact email owner facebook instagram`;
    
    // 1. Google search via Serper
    const searchRes = await axios({
      method: "post",
      url: "https://google.serper.dev/search",
      headers: {
        "X-API-KEY": process.env.SERPER_API_KEY,
        "Content-Type": "application/json"
      },
      data: JSON.stringify({
        q: searchQuery,
        num: 5
      }),
      timeout: 4000
    });

    const organic = searchRes.data?.organic || [];
    const snippetsText = organic
      .map((o, idx) => `[Result ${idx + 1}] Title: ${o.title}\nSnippet: ${o.snippet}\nLink: ${o.link}`)
      .join("\n\n");

    if (!snippetsText) {
      return null;
    }

    // 2. Parse snippets using OpenRouter LLM
    const openrouter = new OpenAI({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: "https://openrouter.ai/api/v1",
    });

    const completion = await openrouter.chat.completions.create({
      model: process.env.OPENROUTER_MODEL || "meta-llama/llama-3.1-8b-instruct",
      messages: [
        {
          role: "system",
          content: `You are an AI data extractor. Your job is to extract B2B lead details from the provided search result snippets.
          Extract the following fields:
          - ownerName: The owner's, founder's, or manager's FIRST name ONLY (e.g., "John", "Sarah"). Do not include last names, prefixes, titles, or general business names. If not found, use "N/A".
          - email: The business email address. If not found, use "N/A".
          - socialLink: A Facebook, Instagram, or LinkedIn page URL for this business. If not found, use "N/A".

          Return the result as a valid JSON object with keys: "ownerName", "email", "socialLink".
          Provide ONLY the raw JSON object. Do not wrap it in markdown code blocks.`
        },
        {
          role: "user",
          content: `Business Name: ${leadName}\nLocation: ${location}\n\nSearch Results Snippets:\n${snippetsText}`
        }
      ],
      temperature: 0.1,
      timeout: 6000
    });

    let content = completion.choices[0]?.message?.content || "";
    // Clean up response formatting
    content = content.replace(/\x60{3}json\s*/gi, "").replace(/\x60{3}/g, "").trim();
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      content = jsonMatch[0];
    }

    const data = JSON.parse(content);
    return {
      ownerName: data.ownerName || "N/A",
      email: data.email || "N/A",
      socialLink: data.socialLink || "N/A"
    };

  } catch (error) {
    console.error(`[Enrichment] Google + AI enrichment failed for ${leadName}:`, error.message);
    return null;
  }
}

/**
 * Enriches a single lead with owner name, email address, and social links.
 * @param {Object} lead 
 * @param {string} location 
 * @returns {Promise<Object>} Enriched lead
 */
export async function enrichLead(lead, location) {
  let ownerName = lead.ownerName || "N/A";
  let email = lead.email || "N/A";
  let socialLink = lead.socialLink || "N/A";

  try {
    // 1. Try Hunter.io domain search if website is present and key is set
    const domain = extractDomain(lead.website);
    if (domain && process.env.HUNTER_API_KEY) {
      const hunterResult = await queryHunter(domain);
      if (hunterResult) {
        if (hunterResult.email && hunterResult.email !== "N/A") {
          email = hunterResult.email;
        }
        if (hunterResult.ownerName && hunterResult.ownerName !== "N/A") {
          ownerName = hunterResult.ownerName;
        }
      }
    }

    // 2. Fallback to Google Search + OpenRouter extraction
    if (email === "N/A" || ownerName === "N/A") {
      const googleResult = await queryGoogleAndAI(lead.name, location);
      if (googleResult) {
        if (ownerName === "N/A" && googleResult.ownerName !== "N/A") {
          ownerName = googleResult.ownerName;
        }
        if (email === "N/A" && googleResult.email !== "N/A") {
          email = googleResult.email;
        }
        if (socialLink === "N/A" && googleResult.socialLink !== "N/A") {
          socialLink = googleResult.socialLink;
        }
      }
    }

    // 3. Fallback to direct website scraping & pattern guessing
    if (email === "N/A" && lead.website && lead.website.startsWith("http")) {
      console.log(`[Enrichment] Falling back to direct website scraping/guessing for: ${lead.name}`);
      const scrapedEmail = await scrapeEmailFromWebsite(lead.website);
      if (scrapedEmail) {
        email = scrapedEmail;
        console.log(`[Enrichment] Scraped email: ${email}`);
      } else {
        const guessedEmail = await guessAndVerifyEmail(lead.website, ownerName);
        if (guessedEmail) {
          email = guessedEmail;
          console.log(`[Enrichment] Guessed email: ${email}`);
        }
      }
    }
  } catch (err) {
    console.error(`[Enrichment] Error during lead enrichment:`, err);
  }

  return {
    ...lead,
    ownerName,
    email,
    socialLink
  };
}

/**
 * Enriches an array of leads in throttled batches of 3 to avoid API rate limits.
 * @param {Array} leads 
 * @param {string} location 
 * @returns {Promise<Array>} Enriched leads
 */
export async function enrichLeads(leads, location) {
  if (!Array.isArray(leads) || leads.length === 0) return [];

  console.log(`[Enrichment] Enriching ${leads.length} leads...`);
  const BATCH_SIZE = 3;
  const enrichedList = [];

  for (let i = 0; i < leads.length; i += BATCH_SIZE) {
    const batch = leads.slice(i, i + BATCH_SIZE);
    const batchPromises = batch.map(lead =>
      Promise.race([
        enrichLead(lead, location),
        new Promise((resolve) =>
          setTimeout(() => {
            console.warn(`[Enrichment] Timeout reached (15s) for lead: ${lead.name}`);
            resolve({
              ...lead,
              ownerName: "N/A",
              email: "N/A",
              socialLink: "N/A"
            });
          }, 15000)
        )
      ])
    );

    const batchResults = await Promise.all(batchPromises);
    enrichedList.push(...batchResults);
  }

  console.log(`[Enrichment] Enrichment process completed.`);
  return enrichedList;
}
