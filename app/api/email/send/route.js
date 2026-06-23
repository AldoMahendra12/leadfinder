import { NextResponse } from "next/server";
import { getLeadByHash, updateLead } from "../../../../lib/db";
import { sendEmail } from "../../../../lib/emailSender";

export async function POST(req) {
  try {
    const { hash, subject: customSubject, body: customBody } = await req.json();
    if (!hash) {
      return NextResponse.json({ error: "Missing lead hash parameter." }, { status: 400 });
    }

    const lead = getLeadByHash(hash);
    if (!lead) {
      return NextResponse.json({ error: "Lead not found." }, { status: 404 });
    }

    if (lead.email === "N/A" || !lead.email) {
      return NextResponse.json({ error: "Lead does not have a valid email address." }, { status: 400 });
    }

    let subject = customSubject;
    let body = customBody;

    // If subject or body is missing, check the saved emailDraft
    if (!subject || !body) {
      if (lead.emailDraft) {
        try {
          const draft = JSON.parse(lead.emailDraft);
          subject = subject || draft.subject;
          body = body || draft.body;
        } catch (e) {
          console.warn("[API/email/send] Failed to parse saved emailDraft, fallback to raw string if present.");
          body = body || lead.emailDraft;
        }
      }
    }

    if (!subject || !body) {
      return NextResponse.json({ error: "No email subject or body draft found. Generate a draft first." }, { status: 400 });
    }

    // Send the email
    const result = await sendEmail({
      to: lead.email,
      subject,
      text: body,
    });

    if (result.success) {
      // Determine what step was just sent
      let newStatus = "step1_sent";
      let stepNumber = 1;
      if (lead.emailStatus === "step1_sent") {
        newStatus = "step2_sent";
        stepNumber = 2;
      } else if (lead.emailStatus === "step2_sent") {
        newStatus = "step3_sent";
        stepNumber = 3;
      }

      // Calculate follow up time (e.g., 3 days for step 1, 4 days for step 2)
      const followUpDays = stepNumber === 1 ? 3 : 4;
      const nextFollowUpAt = stepNumber < 3 
        ? new Date(Date.now() + followUpDays * 24 * 60 * 60 * 1000).toISOString() 
        : null;

      const updated = updateLead(hash, {
        emailStatus: newStatus,
        emailSentAt: new Date().toISOString(),
        nextFollowUpAt,
        stepNumber,
        emailDraft: "", // Clear draft after successful send
      });

      return NextResponse.json({ success: true, lead: updated, messageId: result.messageId });
    } else {
      return NextResponse.json({ error: result.error || "Failed to send email." }, { status: 500 });
    }
  } catch (error) {
    console.error("[API/email/send] Error sending email:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
