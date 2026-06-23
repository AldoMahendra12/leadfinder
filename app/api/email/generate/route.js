import { NextResponse } from "next/server";
import { getLeadByHash, updateLead } from "../../../../lib/db";
import { generateEmailDraft } from "../../../../lib/emailComposer";

export async function POST(req) {
  try {
    const { hash } = await req.json();
    if (!hash) {
      return NextResponse.json({ error: "Missing lead hash parameter." }, { status: 400 });
    }

    const lead = getLeadByHash(hash);
    if (!lead) {
      return NextResponse.json({ error: "Lead not found." }, { status: 404 });
    }

    // Determine the next step. If stepNumber is 0, they start at step 1.
    // Otherwise, we progress them to the next step, max 3.
    let step = 1;
    if (lead.emailStatus === "step1_sent") {
      step = 2;
    } else if (lead.emailStatus === "step2_sent") {
      step = 3;
    }

    console.log(`[API/email/generate] Generating Step ${step} email draft for lead ${lead.name}`);
    const draft = await generateEmailDraft(lead, step);

    // Save the draft back to the database
    const draftString = JSON.stringify(draft);
    const updated = updateLead(hash, {
      emailDraft: draftString,
    });

    return NextResponse.json({ success: true, draft, lead: updated });
  } catch (error) {
    console.error("[API/email/generate] Error generating email:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
