import { NextResponse } from "next/server";
import { extractDataFromPrompt } from "@/lib/ai";
import { searchMapsViaSerper } from "@/lib/serper";
import { computeLeadHash, getLeadByHash } from "@/lib/db";
import { enrichLeads, enrichLead } from "@/lib/enrichment";

function buildValidationError(detail) {
  const error = new Error(`Error: Invalid input validation failed - ${detail}`);
  error.status = 400;
  error.details = detail;
  return error;
}

function normalizeStatus(error) {
  if (typeof error?.status === "number") return error.status;
  if (typeof error?.statusCode === "number") return error.statusCode;
  if (typeof error?.code === "number" && error.code >= 400 && error.code <= 599) {
    return error.code;
  }
  return 500;
}

function scorePriority(lead) {
  const reviewCount = parseInt(lead.reviewCount, 10);
  const rating = parseFloat(lead.rating);
  const hasNoWebsite = !lead.website || lead.website === "No website found";

  if (hasNoWebsite || (!isNaN(reviewCount) && reviewCount < 50) || (!isNaN(rating) && rating < 4.0)) {
    return "HIGH";
  }
  if ((!isNaN(reviewCount) && reviewCount <= 200) || (!isNaN(rating) && rating <= 4.5)) {
    return "MEDIUM";
  }
  return "LOW";
}

export async function POST(request) {
  console.log("[API] Received POST /api/search request.");

  try {
    const body = await request.json().catch(() => ({}));
    const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
    const autoEnrich = body?.enrich !== false; // Enable enrichment by default unless explicitly set to false

    if (!prompt) {
      throw buildValidationError("Prompt is required.");
    }

    console.log("[API] Starting AI extraction step.");
    let extracted;
    try {
      extracted = await extractDataFromPrompt(prompt);
    } catch (error) {
      console.error("[API] extractDataFromPrompt failed:", error);
      throw error;
    }

    const location = typeof extracted.location === "string" ? extracted.location.trim() : "";
    const category = typeof extracted.category === "string" ? extracted.category.trim() : "";
    const intent = typeof extracted.intent === "string" ? extracted.intent.trim() : "";
    const requiresMissingWebsite = !!extracted.requires_missing_website;

    if (!location || !category) {
      throw buildValidationError("Could not extract both location and category from prompt.");
    }

    console.log(`[API] AI extraction successful (location="${location}", category="${category}", intent="${intent}", requiresMissingWebsite=${requiresMissingWebsite})`);

    console.log("[API] Starting Serper search step.");
    let localResults;
    try {
      localResults = await searchMapsViaSerper(category, location);
    } catch (error) {
      console.error("[API] searchMapsViaSerper failed:", error);
      throw error;
    }

    const resultsArray = Array.isArray(localResults) ? localResults : [];
    console.log(`[API] Serper returned ${resultsArray.length} raw results.`);

    let filteredLeads;
    if (requiresMissingWebsite) {
      filteredLeads = resultsArray.filter(item => !item.website && !item.link);
      console.log(`[API] Filtered down to ${filteredLeads.length} leads with no website (Strict Mode).`);
    } else {
      filteredLeads = resultsArray;
      console.log(`[API] Kept all ${filteredLeads.length} leads (Broad Mode).`);
    }

    // Process leads, calculate score, check duplicates
    const formattedLeads = await Promise.all(
      filteredLeads.map(async (lead) => {
        const name = lead.title || "Unknown";
        const address = lead.address || "Unknown";
        const hash = computeLeadHash(name, address);

        // Check DB for existing lead
        const existing = getLeadByHash(hash);

        // reviewCountVal kept for frontend UI rendering compatibility (reviews field)
        const reviewCountVal = lead.ratingCount || lead.reviewsCount || lead.reviews ? parseInt(lead.ratingCount || lead.reviewsCount || lead.reviews, 10) : 0;

        const websiteUrl = lead.website || lead.link || null;

        // Extract email — Layer 1: scrape website contact page
        let email = existing?.email || "N/A";
        if (email === "N/A" && websiteUrl && websiteUrl.startsWith("http")) {
          const { scrapeEmailFromWebsite, guessAndVerifyEmail } = await import("@/lib/email");

          // Layer 1: direct scrape
          const scrapedEmail = await scrapeEmailFromWebsite(websiteUrl);

          if (scrapedEmail) {
            email = scrapedEmail;
            console.log(`[API] Layer 1 found email for ${lead.title}: ${email}`);
          } else {
            // Layer 2: pattern guess + DNS/AbstractAPI verification
            console.log(`[API] Layer 1 found no email for ${lead.title} — trying Layer 2 pattern guesser.`);
            const ownerName = lead.owner || lead.ownerName || null;
            const guessedEmail = await guessAndVerifyEmail(websiteUrl, ownerName);
            if (guessedEmail) {
              email = guessedEmail;
              console.log(`[API] Layer 2 found email for ${lead.title}: ${email}`);
            } else {
              console.log(`[API] Both layers found no email for ${lead.title}.`);
            }
          }
        }

        return {
          hash,
          name,
          ownerName: lead.owner || lead.ownerName || existing?.ownerName || "N/A",
          address,
          phone: (lead.phoneNumber || lead.phone)
            ? `'${lead.phoneNumber || lead.phone}`
            : "N/A",
          rating: lead.rating || "N/A",
          reviewCount: lead.ratingCount || lead.reviewsCount || lead.reviews || "N/A",
          reviews: reviewCountVal, // Kept for frontend UI rendering compatibility
          website: websiteUrl || "No website found",
          email,
          category,
          location,
          priority: scorePriority({
            reviewCount: lead.ratingCount || lead.reviewsCount || lead.reviews || "N/A",
            rating: lead.rating || "N/A",
            website: websiteUrl || "No website found",
          }),
          isDuplicate: !!existing,
          status: existing?.status || "not_contacted",
          notes: existing?.notes || "",
          socialLink: existing?.socialLink || "N/A"
        };
      })
    );

    let leads = formattedLeads;

    // Run AI Enrichment if autoEnrich is toggled
    if (autoEnrich && leads.length > 0) {
      console.log("[API] Auto-enrichment is enabled. Processing leads...");
      // To save tokens and avoid long response times, enrich only leads that are not duplicates 
      // or those that are duplicates but still have N/A for email/ownerName.
      const toEnrich = leads.filter(l => !l.isDuplicate || l.email === "N/A" || l.ownerName === "N/A");
      
      if (toEnrich.length > 0) {
        // Limit auto-enrichment to the first 25 leads to avoid long response times
        const limitToEnrich = toEnrich.slice(0, 25);
        console.log(`[API] Auto-enriching ${limitToEnrich.length} leads (out of ${toEnrich.length} candidate leads)...`);
        
        const enrichedLeads = await enrichLeads(limitToEnrich, location);
        
        // Merge enriched leads back into the main list
        const enrichedMap = new Map(enrichedLeads.map(l => [l.hash, l]));
        leads = leads.map(l => {
          if (enrichedMap.has(l.hash)) {
            return enrichedMap.get(l.hash);
          }
          return l;
        });
      }
    }

    return NextResponse.json({
      leads,
      meta: { location, category, intent }
    });

  } catch (error) {
    const status = normalizeStatus(error);
    const message = error?.message || "Internal Server Error";
    console.error("[API] /api/search failed:", message, error);

    const responsePayload = {
      error: message,
      statusCode: status,
    };

    if (error?.details && error.details !== message) {
      responsePayload.details = error.details;
    }

    return NextResponse.json(responsePayload, { status });
  }
}
