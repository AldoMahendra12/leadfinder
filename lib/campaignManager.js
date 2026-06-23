import { getLeads } from "./db";

/**
 * Gets all leads that are currently due for an email (either Step 1 or scheduled follow-ups).
 * @returns {Array} List of leads ready to receive email
 */
export function getEmailQueue() {
  const leads = getLeads();
  const now = new Date();

  return leads.filter(lead => {
    // Must have a valid email address
    if (!lead.email || lead.email === "N/A") return false;

    // Skip leads that have replied, bounced, unsubscribed, or completed the sequence
    if (["replied", "bounced", "unsubscribed", "step3_sent"].includes(lead.emailStatus)) {
      return false;
    }

    // Ready for Step 1
    if (lead.emailStatus === "not_sent" || !lead.emailStatus) {
      return true;
    }

    // Ready for Step 2 or Step 3 follow-ups if the scheduled date has passed
    if (lead.nextFollowUpAt) {
      const followUpDate = new Date(lead.nextFollowUpAt);
      return followUpDate <= now;
    }

    return false;
  });
}
