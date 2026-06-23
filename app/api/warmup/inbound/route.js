import { NextResponse } from "next/server";
import { updateWarmupLog } from "../../../../lib/warmupStore";
import { sendWarmupReply } from "../../../../lib/warmupReply";

export async function POST(req) {
  try {
    const payload = await req.json();
    console.log("[WarmupInbound] Webhook received payload:", JSON.stringify(payload));

    const envelope = payload.envelope || {};
    const from = envelope.from;
    const to = envelope.to && envelope.to[0] ? envelope.to[0] : null;
    const subject = payload.subject || "";
    const messageId = payload.headers?.["Message-ID"] || null;

    if (!from || !to) {
      console.warn("[WarmupInbound] Inbound webhook missing sender or recipient. Envelope:", envelope);
      return NextResponse.json({ success: false, error: "Invalid envelope" }, { status: 400 });
    }

    const isReply = /^Re:/i.test(subject);

    if (isReply) {
      // 1. If it's a reply (e.g. from recipient back to sender), update the original log entry
      console.log(`[WarmupInbound] Received reply from ${from} to ${to} for subject "${subject}"`);
      
      const updated = updateWarmupLog(messageId, {
        repliedAt: new Date().toISOString(),
        status: "replied",
        subject // will use subject to locate thread if messageId differs
      });

      if (updated) {
        console.log(`[WarmupInbound] Updated thread to 'replied' state in logs.`);
      } else {
        console.log(`[WarmupInbound] Thread log entry not found in database.`);
      }
    } else {
      // 2. If it's the initial email sent to a virtual address, treat it as "opened/received"
      console.log(`[WarmupInbound] Received initial email to ${to} from ${from}. Marking as opened.`);
      
      const updated = updateWarmupLog(messageId, {
        openedAt: new Date().toISOString(),
        status: "opened",
        subject
      });

      if (updated) {
        console.log(`[WarmupInbound] Updated thread to 'opened' state in logs.`);
      }

      // Trigger the automated reply back
      await sendWarmupReply(payload);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[WarmupInbound] Error processing webhook:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
