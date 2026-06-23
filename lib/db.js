import fs from "fs";
import path from "path";

const isVercel = process.env.VERCEL === "1" || process.env.NODE_ENV === "production";
const DB_PATH = isVercel 
  ? path.join("/tmp", "leads_db.json") 
  : path.join(process.cwd(), "data", "leads_db.json");
/**
 * Ensures the database directory and file exist.
 */
function ensureDbExists() {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify({ leads: [] }, null, 2));
  }
}

/**
 * Computes a unique, URL-safe hash based on the lead's name and address.
 * This prevents duplicate entries for the same physical location.
 * @param {string} name 
 * @param {string} address 
 * @returns {string} Hash string
 */
export function computeLeadHash(name, address) {
  const n = typeof name === "string" ? name.trim() : "";
  const a = typeof address === "string" ? address.trim() : "";
  const rawStr = `${n}_${a}`;
  return rawStr.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Fetches all leads from the JSON database.
 * @returns {Array} Array of leads
 */
export function getLeads() {
  try {
    ensureDbExists();
    const data = fs.readFileSync(DB_PATH, "utf8");
    const parsed = JSON.parse(data);
    return Array.isArray(parsed?.leads) ? parsed.leads : [];
  } catch (error) {
    console.error("[DB] Failed to read database:", error);
    return [];
  }
}

/**
 * Saves or updates multiple leads. If a lead already exists by hash, it is merged.
 * @param {Array} newLeads 
 * @returns {number} Count of added/updated leads
 */
export function saveLeads(newLeads) {
  if (!Array.isArray(newLeads) || newLeads.length === 0) return 0;

  try {
    ensureDbExists();
    const currentLeads = getLeads();
    const leadsMap = new Map(currentLeads.map(lead => [lead.hash, lead]));

    let updatedCount = 0;
    for (const lead of newLeads) {
      if (!lead.name) continue;

      const hash = lead.hash || computeLeadHash(lead.name, lead.address);
      const existing = leadsMap.get(hash);

      const updatedLead = {
        hash,
        name: lead.name,
        address: lead.address || "Unknown",
        phone: lead.phone || "N/A",
        rating: lead.rating || "N/A",
        website: lead.website || "No website found",
        category: lead.category || "Unknown",
        location: lead.location || "Unknown",
        dateSaved: existing?.dateSaved || lead.dateSaved || new Date().toISOString(),
        // Enrichments (either new, existing, or N/A)
        ownerName: lead.ownerName || existing?.ownerName || "N/A",
        email: lead.email || existing?.email || "N/A",
        socialLink: lead.socialLink || existing?.socialLink || "N/A",
        priority: lead.priority || existing?.priority || "LOW",
        // CRM tracking
        status: lead.status || existing?.status || "not_contacted", // not_contacted, emailed, replied_interested, mockup_sent, mockup_followup, closed_won, closed_lost
        notes: typeof lead.notes === "string" ? lead.notes : (existing?.notes || ""),
        // Email Campaign tracking
        emailStatus: lead.emailStatus || existing?.emailStatus || "not_sent",
        emailSentAt: lead.emailSentAt || existing?.emailSentAt || null,
        nextFollowUpAt: lead.nextFollowUpAt || existing?.nextFollowUpAt || null,
        campaignId: lead.campaignId || existing?.campaignId || null,
        emailDraft: typeof lead.emailDraft === "string" ? lead.emailDraft : (existing?.emailDraft || ""),
        stepNumber: typeof lead.stepNumber === "number" ? lead.stepNumber : (existing?.stepNumber || 0),
        lastUpdated: new Date().toISOString()
      };

      leadsMap.set(hash, updatedLead);
      updatedCount++;
    }

    fs.writeFileSync(DB_PATH, JSON.stringify({ leads: Array.from(leadsMap.values()) }, null, 2));
    console.log(`[DB] Successfully saved ${updatedCount} leads.`);
    return updatedCount;
  } catch (error) {
    console.error("[DB] Failed to save leads:", error);
    throw error;
  }
}

/**
 * Retrieves a lead by its unique hash.
 * @param {string} hash 
 * @returns {Object|null} Lead object or null
 */
export function getLeadByHash(hash) {
  if (!hash) return null;
  const leads = getLeads();
  return leads.find(lead => lead.hash === hash) || null;
}

/**
 * Updates status and notes for a specific lead.
 * @param {string} hash 
 * @param {Object} updates - { status, notes, ownerName, email, socialLink, priority, emailStatus, emailSentAt, nextFollowUpAt, campaignId, emailDraft, stepNumber }
 * @returns {Object|null} Updated lead or null
 */
export function updateLead(hash, updates) {
  if (!hash || !updates) return null;

  try {
    ensureDbExists();
    const leads = getLeads();
    const index = leads.findIndex(l => l.hash === hash);

    if (index === -1) {
      console.warn(`[DB] Lead with hash ${hash} not found for updates.`);
      return null;
    }

    const current = leads[index];
    const updated = {
      ...current,
      status: updates.status || current.status,
      notes: typeof updates.notes === "string" ? updates.notes : current.notes,
      ownerName: updates.ownerName || current.ownerName,
      email: updates.email || current.email,
      socialLink: updates.socialLink || current.socialLink,
      priority: updates.priority || current.priority,
      // Email Campaign tracking
      emailStatus: updates.emailStatus || current.emailStatus,
      emailSentAt: updates.emailSentAt !== undefined ? updates.emailSentAt : current.emailSentAt,
      nextFollowUpAt: updates.nextFollowUpAt !== undefined ? updates.nextFollowUpAt : current.nextFollowUpAt,
      campaignId: updates.campaignId !== undefined ? updates.campaignId : current.campaignId,
      emailDraft: typeof updates.emailDraft === "string" ? updates.emailDraft : current.emailDraft,
      stepNumber: typeof updates.stepNumber === "number" ? updates.stepNumber : current.stepNumber,
      lastUpdated: new Date().toISOString()
    };

    leads[index] = updated;
    fs.writeFileSync(DB_PATH, JSON.stringify({ leads }, null, 2));
    return updated;
  } catch (error) {
    console.error("[DB] Failed to update lead:", error);
    throw error;
  }
}

/**
 * Deletes a lead by its unique hash.
 * @param {string} hash 
 * @returns {boolean} True if deleted, false if not found
 */
export function deleteLead(hash) {
  if (!hash) return false;

  try {
    ensureDbExists();
    const leads = getLeads();
    const initialLength = leads.length;
    const filtered = leads.filter(l => l.hash !== hash);

    if (filtered.length === initialLength) {
      return false;
    }

    fs.writeFileSync(DB_PATH, JSON.stringify({ leads: filtered }, null, 2));
    return true;
  } catch (error) {
    console.error("[DB] Failed to delete lead:", error);
    throw error;
  }
}
