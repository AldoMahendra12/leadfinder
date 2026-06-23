import { NextResponse } from "next/server";
import { getLeads, updateLead, deleteLead, saveLeads } from "@/lib/db";

export async function GET() {
  try {
    const leads = getLeads();
    return NextResponse.json({ leads });
  } catch (error) {
    console.error("[API] GET /api/leads failed:", error);
    return NextResponse.json(
      { error: "Failed to fetch leads from database." },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { lead } = body;

    if (!lead || !lead.name) {
      return NextResponse.json(
        { error: "Invalid lead payload." },
        { status: 400 }
      );
    }

    saveLeads([lead]);
    return NextResponse.json({ success: true, lead });
  } catch (error) {
    console.error("[API] POST /api/leads failed:", error);
    return NextResponse.json(
      { error: "Failed to save lead." },
      { status: 500 }
    );
  }
}

export async function PUT(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { hash, updates } = body;

    if (!hash || !updates) {
      return NextResponse.json(
        { error: "Hash and updates are required." },
        { status: 400 }
      );
    }

    const leadUpdates = { ...updates };
    if (leadUpdates.status === "replied_interested" || leadUpdates.status === "closed_won" || leadUpdates.status === "closed_lost") {
      leadUpdates.emailStatus = "replied";
      leadUpdates.nextFollowUpAt = null;
    }

    const updated = updateLead(hash, leadUpdates);
    if (!updated) {
      return NextResponse.json(
        { error: "Lead not found or update failed." },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, lead: updated });
  } catch (error) {
    console.error("[API] PUT /api/leads failed:", error);
    return NextResponse.json(
      { error: "Failed to update lead." },
      { status: 500 }
    );
  }
}

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const hash = searchParams.get("hash");

    if (!hash) {
      return NextResponse.json(
        { error: "Hash parameter is required." },
        { status: 400 }
      );
    }

    const success = deleteLead(hash);
    if (!success) {
      return NextResponse.json(
        { error: "Lead not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[API] DELETE /api/leads failed:", error);
    return NextResponse.json(
      { error: "Failed to delete lead." },
      { status: 500 }
    );
  }
}
