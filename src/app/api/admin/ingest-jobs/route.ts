import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { BOARDS } from "@/lib/ingest/boards";
import { runIngestion } from "@/lib/ingest/run";
import { runMigrations } from "@/lib/migrations";

// For a scheduler (a cron on the host, for example every hour): reads every company board and brings the jobs index up to date.
// It needs `Authorization: Bearer <CRON_SECRET>`. Optional body: { "only": "greenhouse" | "lever" } to read one system only.
export const maxDuration = 300;

export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET || "";
  const given = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  const ok = secret.length >= 16 && given.length === secret.length && timingSafeEqual(Buffer.from(given), Buffer.from(secret));
  if (!ok) return NextResponse.json({ error: "Not allowed." }, { status: 401 });
  try {
    const body = (await req.json().catch(() => ({}))) as { only?: unknown };
    const boards = BOARDS.filter((b) => !body.only || b.source === body.only);
    await runMigrations(); // the indexes of the jobs index exist before anything is written
    const run = await runIngestion(boards);
    return NextResponse.json({ boards: boards.length, jobs: run.jobs, closed: run.closed, failed: run.failed, seconds: Math.round(run.ms / 1000), errors: run.results.filter((r) => r.error).map((r) => `${r.board}: ${r.error}`) });
  } catch (e) {
    console.error("Ingestion failed", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Ingestion failed." }, { status: 500 });
  }
}
