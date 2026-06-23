import { NextResponse } from "next/server";
import { initiateWarmupSend } from "../../../../lib/warmupScheduler";

async function handleTrigger() {
  try {
    console.log("[WarmupTrigger API] Triggering a warmup send...");
    const result = await initiateWarmupSend(true);

    if (result.success) {
      return NextResponse.json({ success: true, messageId: result.messageId });
    }

    // These are expected "skip" conditions — return 200 so cron-job.org doesn't flag them as errors
    const skipReasons = ["Warmup is inactive", "Daily limit reached", "Duration completed"];
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

export async function POST() {
  return handleTrigger();
}

export async function GET() {
  return handleTrigger();
}

