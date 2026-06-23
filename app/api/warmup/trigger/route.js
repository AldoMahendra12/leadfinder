import { NextResponse } from "next/server";
import { initiateWarmupSend } from "../../../../lib/warmupScheduler";

async function handleTrigger() {
  try {
    console.log("[WarmupTrigger API] Triggering a warmup send...");
    const result = await initiateWarmupSend();
    
    if (result.success) {
      return NextResponse.json({ success: true, messageId: result.messageId });
    } else {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }
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

