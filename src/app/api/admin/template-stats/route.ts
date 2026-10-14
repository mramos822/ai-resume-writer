import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { errorResponse } from "@/lib/apiAuth";
import { readTemplateCounts } from "@/lib/resumeCounter";
import { TEMPLATE_IDS } from "@/lib/templates";

// For the people who run Kaizo: how many resumes were made with each look (registered accounts only), most used first.
export async function GET(req: Request) {
  try {
    await requireAdmin(req);
    const counts = await readTemplateCounts();
    const rows = [...new Set([...TEMPLATE_IDS, ...Object.keys(counts)])].map((id) => ({ template: id, resumes: counts[id] ?? 0 })).sort((a, b) => b.resumes - a.resumes);
    return NextResponse.json({ templates: rows, total: rows.reduce((n, r) => n + r.resumes, 0) });
  } catch (err) {
    return errorResponse(err, "We couldn't load the look counts.");
  }
}
