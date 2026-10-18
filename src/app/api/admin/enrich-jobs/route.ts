import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { enrichBatch } from "@/lib/ingest/enrich";
import { readsPerDay } from "@/lib/jobFactsStore";

// For a scheduler: reads with the AI a batch of the jobs of the index that nobody has read yet (see lib/ingest/enrich), so the exact fit is
// there before the person looks. It needs `Authorization: Bearer <CRON_SECRET>`. Each call works for up to 45 seconds; the scheduler calls it
// every few minutes (.github/workflows/enrich-jobs.yml) and the day's budget (JOB_FACTS_PER_DAY) is what limits the total.
export const maxDuration = 60;

export async function GET(req: Request) {
  return run(req);
}
export async function POST(req: Request) {
  return run(req);
}

async function run(req: Request) {
  const secret = process.env.CRON_SECRET || "";
  const given = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  const ok = secret.length >= 16 && given.length === secret.length && timingSafeEqual(Buffer.from(given), Buffer.from(secret));
  if (!ok) return NextResponse.json({ error: "Not allowed." }, { status: 401 });
  try {
    const result = await enrichBatch();
    return NextResponse.json({ ...result, dailyBudget: readsPerDay() });
  } catch (e) {
    console.error("Enrichment failed", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Enrichment failed." }, { status: 500 });
  }
}
