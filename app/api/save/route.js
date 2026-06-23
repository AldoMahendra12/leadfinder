import { NextResponse } from "next/server";
import { saveLeadsToGoogleSheet } from "@/lib/sheets";
import { saveLeads } from "@/lib/db";

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { leads, category, location } = body;

    if (!leads || !Array.isArray(leads) || leads.length === 0) {
      return NextResponse.json(
        { error: "Leads must be a non-empty array." },
        { status: 400 }
      );
    }

    if (!category || !location) {
      return NextResponse.json(
        { error: "Category and location are required." },
        { status: 400 }
      );
    }

    console.log(`[API] Saving ${leads.length} leads locally to database...`);
    const formattedLeads = leads.map(lead => ({
      ...lead,
      category,
      location
    }));
    saveLeads(formattedLeads);

    console.log(`[API] Appending ${leads.length} leads to Google Sheets...`);
    const result = await saveLeadsToGoogleSheet(formattedLeads, category, location);

    return NextResponse.json({
      success: true,
      saved: result?.saved ?? leads.length,
      skipped: result?.skipped ?? 0,
    });
  } catch (error) {
    console.error("[API] /api/save failed:", error);
    return NextResponse.json(
      { error: error.message || "Failed to save leads." },
      { status: 500 }
    );
  }
}
