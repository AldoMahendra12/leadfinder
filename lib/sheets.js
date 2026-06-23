import { google } from "googleapis";
import axios from "axios";
import dns from "dns";

dns.setDefaultResultOrder("ipv4first");

function buildSheetsError(detail, status = 500, originalError) {
  const error = new Error(`Error: Failed Google Sheets API call - ${detail}`);
  error.status = status;
  if (originalError) {
    error.cause = originalError;
  }
  error.details = detail;
  return error;
}

function extractSheetsErrorDetail(error) {
  if (Array.isArray(error?.errors) && error.errors.length > 0) {
    return error.errors.map(err => err.message).join("; ");
  }
  if (error?.response?.data?.error?.message) {
    return error.response.data.error.message;
  }
  if (typeof error?.message === "string" && error.message.length > 0) {
    return error.message;
  }
  return "Unknown Google Sheets error.";
}

/**
 * Saves a list of leads to a Google Sheet.
 * @param {Array} leads - Array of formatted lead objects.
 * @param {string} category - The search category.
 * @param {string} location - The search location.
 */
export async function saveLeadsToGoogleSheet(leads, category, location) {
  if (!leads || leads.length === 0) {
    console.log("[Sheets] No leads to save to Google Sheets.");
    return;
  }

  // Format phone numbers to prevent Google Sheets formula parsing errors (e.g. +61... showing #ERROR!)
  const formattedLeads = leads.map(lead => {
    const rawPhone = lead.phone || "N/A";
    const formattedPhone = (rawPhone.startsWith("+") || rawPhone.startsWith("0")) && !rawPhone.startsWith("'")
      ? `'${rawPhone}`
      : rawPhone;
    return {
      ...lead,
      phone: formattedPhone
    };
  });

  // Webhook-based export (Method A - Zero GCP APIs)
  if (process.env.GOOGLE_WEBHOOK_URL) {
    console.log(`[Sheets] Attempting to append ${formattedLeads.length} leads via Google Apps Script Webhook.`);
    try {
      const response = await axios.post(process.env.GOOGLE_WEBHOOK_URL, {
        leads: formattedLeads,
        category,
        location
      }, { timeout: 12000 });
      
      if (response.data && response.data.success === false) {
        throw new Error(response.data.error || "Webhook execution failed.");
      }
      console.log(`[Sheets] Webhook post successful: ${formattedLeads.length} leads saved.`);
      return;
    } catch (error) {
      console.error("[Sheets] Webhook save failed:", error.message);
      throw buildSheetsError(`Webhook failed - ${error.message}`, 500, error);
    }
  }

  const missingEnvVars = [
    !process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && "GOOGLE_SERVICE_ACCOUNT_EMAIL",
    !process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY && "GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY",
    !process.env.GOOGLE_SHEET_ID && "GOOGLE_SHEET_ID"
  ].filter(Boolean);

  if (missingEnvVars.length > 0) {
    const detail = `Missing environment variable(s): ${missingEnvVars.join(", ")} (Alternatively, set GOOGLE_WEBHOOK_URL to use Apps Script Method A)`;
    console.error("[Sheets]", detail);
    throw buildSheetsError(detail);
  }

  console.log(`[Sheets] Attempting to append ${leads.length} leads to Google Sheet.`);

  try {
    const auth = new google.auth.JWT(
      process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      null,
      (process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
      ["https://www.googleapis.com/auth/spreadsheets"]
    );

    const sheets = google.sheets({ version: "v4", auth });

    // Define headers
    const headers = [
      "Name",
      "Owner Name",
      "Email",
      "Phone",
      "Rating",
      "Review Count",
      "Priority",
      "Website",
      "Category",
      "Location",
      "Status",
      "Email_1_Sent",
      "Email_2_Sent",
      "Email_3_Sent",
      "Date Added"
    ];

    try {
      const getResponse = await sheets.spreadsheets.values.get({
        spreadsheetId: process.env.GOOGLE_SHEET_ID,
        range: "Sheet1!A1:O1",
      });

      const existingHeaders = getResponse.data.values;
      if (!existingHeaders || existingHeaders.length === 0) {
        console.log("[Sheets] Sheet appears empty or missing headers. Adding headers.");
        await sheets.spreadsheets.values.update({
          spreadsheetId: process.env.GOOGLE_SHEET_ID,
          range: "Sheet1!A1",
          valueInputOption: "USER_ENTERED",
          requestBody: {
            values: [headers],
          },
        });
      }
    } catch (readError) {
      console.warn("[Sheets] Failed to check for existing headers, proceeding to append data:", readError.message);
      // We continue to append data even if header check fails
    }

    // --- DEDUPLICATION: read existing names+phones and skip duplicates ---
    let existingKeys = new Set();
    try {
      const existingData = await sheets.spreadsheets.values.get({
        spreadsheetId: process.env.GOOGLE_SHEET_ID,
        range: "Sheet1!A:D", // Name (A) and Phone (D)
      });
      const existingRows = existingData.data.values || [];
      // Skip header row (index 0), build a set of "name|phone" keys
      existingRows.slice(1).forEach((row) => {
        const key = `${(row[0] || "").toLowerCase().trim()}|${(row[3] || "").trim()}`;
        existingKeys.add(key);
      });
      console.log(`[Sheets] Loaded ${existingKeys.size} existing leads for deduplication.`);
    } catch (dedupError) {
      console.warn("[Sheets] Could not load existing data for deduplication, skipping:", dedupError.message);
      // Non-fatal — continue without dedup if reading fails
    }

    // Filter out duplicates
    const deduplicatedLeads = formattedLeads.filter((lead) => {
      const key = `${(lead.name || "").toLowerCase().trim()}|${(lead.phone || "").trim()}`;
      if (existingKeys.has(key)) {
        console.log(`[Sheets] Skipping duplicate: ${lead.name}`);
        return false;
      }
      return true;
    });

    console.log(`[Sheets] After deduplication: ${deduplicatedLeads.length} new leads to save (${formattedLeads.length - deduplicatedLeads.length} skipped).`);

    if (deduplicatedLeads.length === 0) {
      console.log("[Sheets] All leads already exist in sheet. Nothing to append.");
      return { saved: 0, skipped: formattedLeads.length };
    }

    // Prepare rows
    const rows = deduplicatedLeads.map((lead) => [
      lead.name,
      lead.ownerName || "N/A",
      lead.email || "N/A",
      lead.phone,
      lead.rating,
      lead.reviewCount || "N/A",
      lead.priority || "N/A",
      lead.website,
      category,
      location,
      "New",          // Status default
      "No",           // Email_1_Sent default
      "No",           // Email_2_Sent default
      "No",           // Email_3_Sent default
      new Date().toISOString()
    ]);

    await sheets.spreadsheets.values.append({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: "Sheet1!A1", // Append will find the first empty row
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: rows,
      },
    });

    console.log(`[Sheets] Successfully appended ${rows.length} rows to Google Sheet.`);
    return { saved: rows.length, skipped: formattedLeads.length - deduplicatedLeads.length };
  } catch (error) {
    if (error?.message?.startsWith("Error: Failed Google Sheets API call -")) {
      console.error("[Sheets] Google Sheets API call failed:", error.details || error.message);
      throw error;
    }

    const status = typeof error?.code === "number"
      ? error.code
      : error?.response?.status || error?.status || 500;
    const detail = extractSheetsErrorDetail(error);
    console.error("[Sheets] Error saving to Google Sheets:", detail, error?.response?.data || error);
    throw buildSheetsError(detail, status, error);
  }
}
