import { NextResponse } from "next/server";
import { getEmailQueue } from "../../../../lib/campaignManager";

export async function GET(req) {
  try {
    const queue = getEmailQueue();
    return NextResponse.json({ success: true, count: queue.length, queue });
  } catch (error) {
    console.error("[API/email/queue] Error getting email queue:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
