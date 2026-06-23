import { NextResponse } from "next/server";
import { enrichLead } from "@/lib/enrichment";

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { lead, location } = body;

    if (!lead || !lead.name) {
      return NextResponse.json(
        { error: "Lead object with a name is required." },
        { status: 400 }
      );
    }

    console.log(`[API] Manually enriching lead: "${lead.name}"`);
    const enrichedLead = await enrichLead(lead, location || "Unknown");

    return NextResponse.json({ success: true, lead: enrichedLead });
  } catch (error) {
    console.error("[API] /api/leads/enrich failed:", error);
    return NextResponse.json(
      { error: error.message || "Failed to enrich lead." },
      { status: 500 }
    );
  }
}
