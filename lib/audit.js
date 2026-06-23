import axios from "axios";
import OpenAI from "openai";

// ─────────────────────────────────────────────
// CHECK 1: Website health via Google PageSpeed
// Free API, no key required for basic usage
// ─────────────────────────────────────────────
async function checkWebsiteHealth(websiteUrl) {
  const defaultResult = {
    hasSSL: false,
    mobileScore: null,
    performanceScore: null,
    isSlowSite: null,
    isMobileFriendly: null,
    pageSpeedError: null,
  };

  if (!websiteUrl || websiteUrl === "No website found") {
    return { ...defaultResult, pageSpeedError: "No website" };
  }

  // SSL check — simply whether the URL starts with https
  const hasSSL = websiteUrl.startsWith("https://");

  try {
    const encodedUrl = encodeURIComponent(websiteUrl);
    const apiKey = process.env.PAGESPEED_API_KEY;
    const apiUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodedUrl}&strategy=mobile${apiKey ? `&key=${apiKey}` : ""}`;

    const response = await axios.get(apiUrl, { timeout: 15000 });
    const data = response.data;

    const performanceScore = Math.round(
      (data?.lighthouseResult?.categories?.performance?.score ?? 0) * 100
    );
    const mobileScore = performanceScore; // PageSpeed mobile strategy IS the mobile score

    return {
      hasSSL,
      mobileScore,
      performanceScore,
      isSlowSite: performanceScore < 50,
      isMobileFriendly: performanceScore >= 50,
      pageSpeedError: null,
    };
  } catch (err) {
    console.warn("[Audit] PageSpeed check failed:", err?.message);
    return {
      ...defaultResult,
      hasSSL,
      pageSpeedError: err?.message || "PageSpeed unavailable",
    };
  }
}

// ─────────────────────────────────────────────
// CHECK 2: Social presence via Serper web search
// Reuses the existing SERPER_API_KEY
// ─────────────────────────────────────────────
async function checkSocialPresence(businessName, address) {
  const defaultResult = {
    hasFacebook: false,
    hasInstagram: false,
    facebookUrl: null,
    instagramUrl: null,
    socialError: null,
  };

  if (!process.env.SERPER_API_KEY) {
    return { ...defaultResult, socialError: "Missing SERPER_API_KEY" };
  }

  // Extract city from address (take the last part after the last comma)
  const city = address && address !== "Unknown"
    ? address.split(",").slice(-2).join(",").trim()
    : "";

  const query = `"${businessName}" ${city} facebook OR instagram`;

  try {
    const response = await axios.post(
      "https://google.serper.dev/search",
      JSON.stringify({ q: query, num: 10 }),
      {
        headers: {
          "X-API-KEY": process.env.SERPER_API_KEY,
          "Content-Type": "application/json",
        },
        timeout: 8000,
      }
    );

    const organicResults = response?.data?.organic || [];

    let hasFacebook = false;
    let hasInstagram = false;
    let facebookUrl = null;
    let instagramUrl = null;

    for (const result of organicResults) {
      const link = result.link || "";
      if (!hasFacebook && link.includes("facebook.com")) {
        hasFacebook = true;
        facebookUrl = link;
      }
      if (!hasInstagram && link.includes("instagram.com")) {
        hasInstagram = true;
        instagramUrl = link;
      }
      if (hasFacebook && hasInstagram) break;
    }

    console.log(`[Audit] Social check for "${businessName}": FB=${hasFacebook}, IG=${hasInstagram}`);
    return { hasFacebook, hasInstagram, facebookUrl, instagramUrl, socialError: null };
  } catch (err) {
    console.warn("[Audit] Social presence check failed:", err?.message);
    return { ...defaultResult, socialError: err?.message || "Social check failed" };
  }
}

// ─────────────────────────────────────────────
// CHECK 3: AI-generated pain points + call opener
// Uses existing OPENROUTER_API_KEY
// ─────────────────────────────────────────────
async function generatePainPoints(lead, healthData, socialData) {
  const defaultResult = {
    painPoints: [],
    callOpener: null,
    auditScore: 0,
    aiError: null,
  };

  if (!process.env.OPENROUTER_API_KEY) {
    return { ...defaultResult, aiError: "Missing OPENROUTER_API_KEY" };
  }

  // Build a score: lower = more pain = higher priority for you
  let painScore = 0;
  if (!healthData.hasSSL) painScore += 20;
  if (healthData.isSlowSite) painScore += 25;
  if (!socialData.hasFacebook) painScore += 15;
  if (!socialData.hasInstagram) painScore += 15;
  const reviewCount = parseInt(lead.reviewCount, 10);
  if (!isNaN(reviewCount) && reviewCount < 50) painScore += 25;

  // auditScore = how badly they need help (0-100, higher = more pain)
  const auditScore = Math.min(painScore, 100);

  const context = `
Business: ${lead.name}
Location: ${lead.address}
Category: ${lead.category || "local service business"}
Rating: ${lead.rating || "unknown"}
Review Count: ${lead.reviewCount || "unknown"}
Has Website: ${lead.website && lead.website !== "No website found" ? "Yes" : "No"}
Website URL: ${lead.website || "None"}
SSL Certificate: ${healthData.hasSSL ? "Yes (secure)" : "No (not secure)"}
Mobile Performance Score: ${healthData.mobileScore !== null ? `${healthData.mobileScore}/100` : "Could not check"}
Website is Slow: ${healthData.isSlowSite ? "Yes" : healthData.isSlowSite === false ? "No" : "Unknown"}
Has Facebook Page: ${socialData.hasFacebook ? "Yes" : "No"}
Has Instagram: ${socialData.hasInstagram ? "Yes" : "No"}
`.trim();

  const systemPrompt = `You are a sales consultant for an AI automation agency that helps local service businesses.
Given the audit data below, do two things:

1. Write exactly 3 short, specific pain points this business is experiencing RIGHT NOW based on the data.
   Each pain point must be one sentence, specific, and reference actual numbers or findings from the audit.
   Format as a JSON array of 3 strings under key "painPoints".

2. Write a 2-sentence cold call opener the salesperson should say in the first 10 seconds.
   It must reference 2 specific findings. Start with "Hey [Owner], I looked at your business before calling —".
   Format as a string under key "callOpener".

Return ONLY valid JSON with keys "painPoints" (array of 3 strings) and "callOpener" (string).
No markdown, no explanation, no backticks.`;

  try {
    const openrouter = new OpenAI({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: "https://openrouter.ai/api/v1",
    });

    const completion = await openrouter.chat.completions.create({
      model: process.env.OPENROUTER_MODEL || "meta-llama/llama-3.1-8b-instruct",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: context },
      ],
      temperature: 0.4,
      stream: false,
    });

    let raw = completion.choices?.[0]?.message?.content || "";

    // Strip markdown code fences if present
    raw = raw.replace(/```json\s*/gi, "").replace(/```/g, "").trim();

    // Extract JSON object
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found in AI response");

    const parsed = JSON.parse(jsonMatch[0]);

    const painPoints = Array.isArray(parsed.painPoints)
      ? parsed.painPoints.slice(0, 3)
      : [];

    const callOpener = typeof parsed.callOpener === "string"
      ? parsed.callOpener
      : null;

    console.log(`[Audit] Generated ${painPoints.length} pain points for ${lead.name}`);
    return { painPoints, callOpener, auditScore, aiError: null };
  } catch (err) {
    console.warn("[Audit] AI pain point generation failed:", err?.message);
    return { ...defaultResult, auditScore, aiError: err?.message || "AI failed" };
  }
}

// ─────────────────────────────────────────────
// MAIN EXPORT: runPreCallAudit
// Orchestrates all 3 checks, always resolves (never throws)
// ─────────────────────────────────────────────
export async function runPreCallAudit(lead) {
  console.log(`[Audit] Starting pre-call audit for: ${lead.name}`);

  const websiteUrl = lead.website && lead.website !== "No website found"
    ? lead.website
    : null;

  // Run health + social in parallel (independent), then AI last (needs both)
  const [healthData, socialData] = await Promise.all([
    checkWebsiteHealth(websiteUrl),
    checkSocialPresence(lead.name, lead.address),
  ]);

  const aiData = await generatePainPoints(lead, healthData, socialData);

  const result = {
    businessName: lead.name,
    website: {
      hasSSL: healthData.hasSSL,
      mobileScore: healthData.mobileScore,
      performanceScore: healthData.performanceScore,
      isSlowSite: healthData.isSlowSite,
      error: healthData.pageSpeedError,
    },
    social: {
      hasFacebook: socialData.hasFacebook,
      hasInstagram: socialData.hasInstagram,
      facebookUrl: socialData.facebookUrl,
      instagramUrl: socialData.instagramUrl,
      error: socialData.socialError,
    },
    ai: {
      painPoints: aiData.painPoints,
      callOpener: aiData.callOpener,
      auditScore: aiData.auditScore,
      error: aiData.aiError,
    },
    auditScore: aiData.auditScore,
    completedAt: new Date().toISOString(),
  };

  console.log(`[Audit] Completed audit for ${lead.name}. Score: ${result.auditScore}/100`);
  return result;
}
