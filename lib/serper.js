import dns from "dns";
import axios from "axios";

dns.setDefaultResultOrder("ipv4first");

function buildSerperError(detail, status = 500, originalError) {
  const error = new Error(`Error: Failed Serper API call - ${detail}`);
  error.status = status;
  if (originalError) {
    error.cause = originalError;
  }
  error.details = detail;
  return error;
}

function extractSerperErrorDetail(error) {
  if (error?.response?.data) {
    if (typeof error.response.data === "string") {
      return error.response.data;
    }
    if (typeof error.response.data.error?.message === "string") {
      return error.response.data.error.message;
    }
    if (typeof error.response.data.error === "string") {
      return error.response.data.error;
    }
    try {
      return JSON.stringify(error.response.data);
    } catch {
      return "Unknown Serper error.";
    }
  }
  if (typeof error?.message === "string" && error.message.length > 0) {
    return error.message;
  }
  return "Unknown Serper error.";
}

/**
 * Searches for local businesses using Serper.dev Google Maps API.
 * Runs 3 parallel queries and merges/deduplicates results for up to ~30 leads.
 * @param {string} category - The category to search for.
 * @param {string} location - The location to search in.
 * @returns {Promise<Array>} - Array of raw lead objects.
 */
export async function searchMapsViaSerper(category, location) {
  console.log(`[Serper] searchMapsViaSerper invoked (category="${category}", location="${location}")`);

  if (!process.env.SERPER_API_KEY) {
    const detail = "Missing SERPER_API_KEY environment variable.";
    console.error("[Serper]", detail);
    throw buildSerperError(detail);
  }

  const queries = [
    `${category} in ${location}`,
    `best ${category} near ${location}`,
    `top ${category} ${location}`,
  ];

  const fetchQuery = async (q) => {
    try {
      const config = {
        method: "post",
        url: "https://google.serper.dev/maps",
        headers: {
          "X-API-KEY": process.env.SERPER_API_KEY,
          "Content-Type": "application/json",
        },
        data: JSON.stringify({ q, hl: "en" }),
      };
      const response = await axios(config);
      const places = response?.data?.places || [];
      console.log(`[Serper] Query "${q}" returned ${places.length} results.`);
      return places;
    } catch (error) {
      // Non-fatal: if one query fails, log and return empty array
      console.warn(`[Serper] Query "${q}" failed:`, error?.message || error);
      return [];
    }
  };

  try {
    // Run all 3 queries in parallel
    const allResults = await Promise.all(queries.map(fetchQuery));

    // Merge all results into one flat array
    const merged = allResults.flat();

    // Deduplicate by phone number (primary key), fall back to title+address
    const seen = new Set();
    const unique = merged.filter((place) => {
      const key = place.phoneNumber || place.phone
        ? (place.phoneNumber || place.phone).replace(/\D/g, "")
        : `${place.title}|${place.address}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    console.log(`[Serper] Merged ${merged.length} results → ${unique.length} unique after dedup.`);
    return unique;
  } catch (error) {
    if (error?.message?.startsWith("Error: Failed Serper API call -")) {
      console.error("[Serper] Serper API call failed:", error.details || error.message);
      throw error;
    }
    const status = error?.response?.status || error?.status || 500;
    const detail = extractSerperErrorDetail(error);
    console.error("[Serper] Serper API request error:", detail, error?.response?.data || error);
    throw buildSerperError(detail, status, error);
  }
}
