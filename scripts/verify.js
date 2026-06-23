// Database and Enrichment verification script
import { computeLeadHash, getLeads, saveLeads, getLeadByHash, updateLead, deleteLead } from "../lib/db.js";
import { enrichLead } from "../lib/enrichment.js";

async function verify() {
  console.log("=== LeadFinder AI Verification ===");

  // 1. Test database helpers
  console.log("\n[1] Testing Database operations...");
  const mockLeads = [
    {
      name: "Verification Cafe",
      address: "789 Verify St, Seattle",
      phone: "555-0199",
      rating: "4.8",
      website: "http://verifycafe.com",
      category: "cafe",
      location: "Seattle",
      priority: "HIGH",
      ownerName: "Bob",
      email: "bob@verifycafe.com",
      socialLink: "https://facebook.com/verifycafe"
    }
  ];

  const count = saveLeads(mockLeads);
  console.log(`- Saved mock leads count: ${count}`);

  const allLeads = getLeads();
  console.log(`- Total leads in DB: ${allLeads.length}`);

  const hash = computeLeadHash("Verification Cafe", "789 Verify St, Seattle");
  const retrieved = getLeadByHash(hash);
  if (retrieved && retrieved.name === "Verification Cafe") {
    console.log("- Database read: SUCCESS");
  } else {
    console.error("- Database read: FAILED");
  }

  const updated = updateLead(hash, { status: "replied_interested", notes: "Interested in free mockup" });
  if (updated && updated.status === "replied_interested") {
    console.log("- Database update: SUCCESS");
  } else {
    console.error("- Database update: FAILED");
  }

  // 2. Test lead enrichment fallback query structure
  console.log("\n[2] Testing Enrichment function interface...");
  const leadToEnrich = {
    name: "Verification Cafe",
    address: "789 Verify St, Seattle",
    phone: "555-0199",
    rating: "4.8",
    website: "http://verifycafe.com",
  };

  console.log("- Invoking enrichLead (will test API logic or return defaults)...");
  // Wrap in try-catch in case API keys are not valid or not available
  try {
    const enriched = await enrichLead(leadToEnrich, "Seattle");
    console.log(`- Enrichment response: Email="${enriched.email}", OwnerName="${enriched.ownerName}", Social="${enriched.socialLink}"`);
    console.log("- Enrichment module interface test: SUCCESS");
  } catch (error) {
    console.log(`- Enrichment error (expected if APIs not configured): ${error.message}`);
  }

  // Clean up test lead
  deleteLead(hash);
  console.log("\n- Cleared test data.");
  console.log("=== Verification Finished ===");
}

verify().catch(console.error);
