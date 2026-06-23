import { NextResponse } from "next/server";
import { initiateWarmupSend } from "../../../../lib/warmupScheduler";

export async function POST() {
  try {
    console.log("[WarmupTrigger API] Manually triggering a warmup send...");
    // Override active configuration check to allow manual sends for testing
    // (We temporarily make it active if it wasn't, send, and restore)
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
