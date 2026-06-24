import { NextResponse } from "next/server";
import { initiateWarmupSend } from "../../../../lib/warmupScheduler";

/**
 * This endpoint is called by:
 * 1. Vercel Cron Job (every 30 minutes) — keeps warmup running 24/7 even with laptop off
 * 2. The "Send Test Warmup Email" button in the UI (force=true)
 */
async function handleTrigger(force = false) {
  try {
    console.log(`[WarmupTrigger API] Triggering warmup send (force=${force})...`);
    const result = await initiateWarmupSend(force);

    if (result.success) {
      return NextResponse.json({ success: true, messageId: result.messageId });
    }

    // These are expected "skip" conditions — return 200 so Vercel cron doesn't flag them as errors
    const skipReasons = ["Warmup is inactive", "Daily limit reached", "Duration completed", "Insufficient contacts"];
    if (skipReasons.some(r => result.error?.includes(r))) {
      return NextResponse.json({ success: false, skipped: true, reason: result.error }, { status: 200 });
    }

    // Real failure (e.g. SMTP error, missing credentials)
    return NextResponse.json({ success: false, error: result.error }, { status: 400 });
  } catch (error) {
    console.error("[WarmupTrigger API] Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// Vercel Cron calls GET by default
export async function GET(req) {
  // Check if this is a manual trigger (force=true) or cron trigger
  const { searchParams } = new URL(req.url);
  const force = searchParams.get("force") === "true";
  return handleTrigger(force);
}

export async function POST(req) {
  let force = false;
  try {
    const body = await req.json();
    force = !!body.force;
  } catch (_) {}
  return handleTrigger(force);
}
