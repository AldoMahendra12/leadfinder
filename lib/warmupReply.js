import { sendEmail } from "./emailSender";
import { getRandomReply } from "./warmupTemplates";
import { addWarmupLog } from "./warmupStore";

/**
 * Sends a simulated reply from the recipient of a warmup email back to the sender.
 * @param {Object} inboundPayload - The parsed inbound email payload from Brevo webhook.
 */
export async function sendWarmupReply(inboundPayload) {
  const envelope = inboundPayload.envelope || {};
  const to = envelope.to && envelope.to[0] ? envelope.to[0] : null;
  const from = envelope.from;
  const subject = envelope.subject || "Reply";
  
  if (!to || !from) {
    console.error("[WarmupReply] Missing from/to in envelope:", envelope);
    return { success: false, error: "Invalid envelope data" };
  }

  // To prevent infinite loops, check if this is already a reply.
  // In our flow, if the subject starts with "Re:", it means the reply has already been sent,
  // and we should not reply again.
  if (/^Re:/i.test(subject)) {
    console.log(`[WarmupReply] Incoming email is already a reply ("${subject}"). Stopping loop.`);
    return { success: true, message: "Loop stopped" };
  }

  const replyText = getRandomReply();
  const replySubject = `Re: ${subject}`;

  console.log(`[WarmupReply] Simulating reply from ${to} to ${from} for subject "${subject}"`);

  // Temporarily set the sender email to the recipient's address to send from it
  const originalSenderEmail = process.env.SENDER_EMAIL;
  process.env.SENDER_EMAIL = to;

  try {
    const result = await sendEmail({
      to: from,
      subject: replySubject,
      text: replyText
    });

    if (result.success) {
      addWarmupLog({
        messageId: result.messageId,
        from: to,
        to: from,
        subject: replySubject,
        sentAt: new Date().toISOString(),
        status: "sent",
        isReply: true
      });
      console.log(`[WarmupReply] Reply sent successfully from ${to} to ${from}`);
      return { success: true, messageId: result.messageId };
    } else {
      console.error("[WarmupReply] Failed to send reply email:", result.error);
      return { success: false, error: result.error };
    }
  } catch (err) {
    console.error("[WarmupReply] Error sending reply:", err);
    return { success: false, error: err.message };
  } finally {
    // Restore original sender email
    process.env.SENDER_EMAIL = originalSenderEmail;
  }
}
