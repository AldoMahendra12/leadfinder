import axios from "axios";
import dns from "dns";

/**
 * Scrapes a business website for public email addresses.
 * @param {string} websiteUrl - The URL of the website.
 * @returns {Promise<string|null>} The first valid email address found, or null.
 */
export async function scrapeEmailFromWebsite(websiteUrl) {
  if (!websiteUrl || typeof websiteUrl !== "string" || !websiteUrl.startsWith("http")) {
    return null;
  }

  const userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
  const emailRegex = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;

  // Helper to extract unique emails and filter out false positives
  const extractEmails = (html) => {
    if (!html || typeof html !== "string") return [];
    const matches = html.match(emailRegex) || [];
    return [...new Set(matches)].filter((email) => {
      const lower = email.toLowerCase();
      return !lower.includes("sentry") &&
             !lower.includes("wix") &&
             !lower.includes("example") &&
             !lower.includes("placeholder") &&
             !lower.includes(".png") &&
             !lower.includes(".jpg") &&
             !lower.includes(".svg") &&
             !lower.includes("schema.org");
    });
  };

  const baseUrl = websiteUrl.endsWith("/") ? websiteUrl.slice(0, -1) : websiteUrl;
  const urlsToTry = [
    `${baseUrl}/contact`,
    `${baseUrl}/contact-us`,
    baseUrl // fallback to homepage
  ];

  for (const url of urlsToTry) {
    try {
      console.log(`[Email] Fetching URL: ${url}`);
      const response = await axios.get(url, {
        headers: { "User-Agent": userAgent },
        timeout: 5000,
        validateStatus: (status) => status === 200
      });

      if (response.data && typeof response.data === "string") {
        const emails = extractEmails(response.data);
        if (emails.length > 0) {
          console.log(`[Email] Found email on ${url}: ${emails[0]}`);
          return emails[0];
        }
      }
    } catch (error) {
      console.log(`[Email] Failed to fetch or extract from ${url}:`, error.message);
      // Silently continue to next fallback
    }
  }

  return null;
}

/**
 * Extracts the root domain from a URL string.
 * e.g. "https://www.mikesplumbing.com/about" → "mikesplumbing.com"
 */
function extractDomain(websiteUrl) {
  try {
    const url = new URL(websiteUrl);
    // Remove www. prefix if present
    return url.hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

/**
 * Generates common email patterns for a given domain and optional owner first name.
 * @param {string} domain - e.g. "mikesplumbing.com"
 * @param {string|null} ownerFirstName - e.g. "Mike" (optional)
 * @returns {string[]} - Array of candidate email addresses
 */
function generateEmailPatterns(domain, ownerFirstName = null) {
  const patterns = [
    `info@${domain}`,
    `contact@${domain}`,
    `hello@${domain}`,
    `admin@${domain}`,
    `office@${domain}`,
    `support@${domain}`,
  ];

  // If we have an owner first name, prepend personal patterns (highest priority)
  if (ownerFirstName && ownerFirstName !== "N/A") {
    const first = ownerFirstName.toLowerCase().trim();
    patterns.unshift(`${first}@${domain}`);
  }

  return patterns;
}

/**
 * Checks if a domain has valid MX records (can receive email).
 * Uses Node's built-in dns module — no API key needed.
 * @param {string} domain
 * @returns {Promise<boolean>}
 */
async function domainHasMxRecords(domain) {
  try {
    const records = await dns.promises.resolveMx(domain);
    return Array.isArray(records) && records.length > 0;
  } catch {
    return false;
  }
}

/**
 * Verifies a single email address using AbstractAPI (free tier: 100/month).
 * Returns true if the email is valid and deliverable.
 * Falls back to returning true if no API key is set (skips verification).
 * @param {string} email
 * @returns {Promise<boolean>}
 */
async function verifyEmailWithAbstractApi(email) {
  const apiKey = process.env.ABSTRACT_API_KEY;

  // If no API key configured, skip verification and accept the pattern
  if (!apiKey) {
    console.log(`[Email] No ABSTRACT_API_KEY set — skipping verification for ${email}`);
    return true;
  }

  try {
    const url = `https://emailvalidation.abstractapi.com/v1/?api_key=${apiKey}&email=${encodeURIComponent(email)}`;
    const response = await axios.get(url, { timeout: 5000 });
    const data = response.data;

    // Accept if deliverability is DELIVERABLE and it's not a disposable address
    const isDeliverable = data?.deliverability === "DELIVERABLE";
    const isNotDisposable = data?.is_disposable_email?.value === false;
    const isValidFormat = data?.is_valid_format?.value === true;

    const result = isValidFormat && isDeliverable && isNotDisposable;
    console.log(`[Email] AbstractAPI verified ${email}: ${result ? "VALID" : "INVALID"}`);
    return result;
  } catch (err) {
    // Non-fatal — if verification fails, accept the pattern anyway
    console.warn(`[Email] AbstractAPI verification failed for ${email}:`, err?.message);
    return true;
  }
}

/**
 * Layer 2 email finder: guesses common patterns and verifies them.
 * Call this ONLY when scrapeEmailFromWebsite() returned null.
 *
 * @param {string} websiteUrl - The business website URL
 * @param {string|null} ownerName - Owner full name (e.g. "Mike Johnson") — first name extracted automatically
 * @returns {Promise<string|null>} - First verified email, or null if none found
 */
export async function guessAndVerifyEmail(websiteUrl, ownerName = null) {
  if (!websiteUrl || websiteUrl === "No website found") {
    console.log("[Email] guessAndVerifyEmail: no website URL, skipping.");
    return null;
  }

  const domain = extractDomain(websiteUrl);
  if (!domain) {
    console.log("[Email] guessAndVerifyEmail: could not extract domain from URL:", websiteUrl);
    return null;
  }

  // Step 1: Check domain has MX records before guessing
  const hasMx = await domainHasMxRecords(domain);
  if (!hasMx) {
    console.log(`[Email] Domain ${domain} has no MX records — skipping pattern guessing.`);
    return null;
  }

  // Step 2: Extract first name from owner name if available
  const ownerFirstName = ownerName && ownerName !== "N/A"
    ? ownerName.trim().split(" ")[0]
    : null;

  // Step 3: Generate patterns
  const patterns = generateEmailPatterns(domain, ownerFirstName);
  console.log(`[Email] Generated ${patterns.length} patterns for ${domain}:`, patterns);

  // Step 4: Verify each pattern, return first valid one
  for (const email of patterns) {
    const isValid = await verifyEmailWithAbstractApi(email);
    if (isValid) {
      console.log(`[Email] Pattern verified: ${email}`);
      return email;
    }
  }

  console.log(`[Email] No valid pattern found for domain: ${domain}`);
  return null;
}
