import { NextResponse } from "next/server";
import { runPreCallAudit } from "@/lib/audit";

export async function POST(request) {
  console.log("[API] Received POST /api/audit request.");

  try {
    const body = await request.json().catch(() => ({}));
    const { lead } = body;

    if (!lead || typeof lead !== "object" || !lead.name) {
      return NextResponse.json(
        { error: "A valid lead object with at least a name field is required." },
        { status: 400 }
      );
    }

    const auditResult = await runPreCallAudit(lead);

    return NextResponse.json({ success: true, audit: auditResult });
  } catch (error) {
    const message = error?.message || "Audit failed unexpectedly.";
    console.error("[API] /api/audit failed:", message, error);
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
