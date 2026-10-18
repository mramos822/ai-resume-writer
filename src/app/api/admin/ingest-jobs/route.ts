import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { ingestNow } from "@/lib/ingest/schedule";
import { runMigrations } from "@/lib/migrations";

// For a scheduler (a cron on the host, for example every hour): reads every company board and brings the jobs index up to date.
// It needs `Authorization: Bearer <CRON_SECRET>`. Vercel's cron calls it with GET and sends that header by itself (see vercel.json);
// "?only=smartrecruiters" (or the same in the POST body) reads the slow set instead: SmartRecruiters needs one request per new posting.
export const maxDuration = 60; // a full reading takes about twenty seconds

export async function GET(req: Request) {
  return run(req, new URL(req.url).searchParams.get("only") ?? undefined);
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { only?: unknown };
  return run(req, typeof body.only === "string" ? body.only : undefined);
}

async function run(req: Request, only: string | undefined) {
  const secret = process.env.CRON_SECRET || "";
  const given = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  const ok = secret.length >= 16 && given.length === secret.length && timingSafeEqual(Buffer.from(given), Buffer.from(secret));
  if (!ok) return NextResponse.json({ error: "Not allowed." }, { status: 401 });
  try {
    // by default the boards that take seconds; the ones that need a request per posting (SmartRecruiters) are read apart: ?only=smartrecruiters
    const slow = only === "smartrecruiters";
    await runMigrations(); // the indexes of the jobs index exist before anything is written
    const res = await ingestNow({ by: "scheduler", onlyIfDue: false, set: slow ? "slow" : "fast" });
    // The daily cleanup promised in the privacy policy (guest sessions unused for 30 days, old contact messages) rides on the slow call, so the
    // host's free plan (two daily crons) is enough. It also runs by itself when somebody starts a guest session: this makes it exact.
    let cleanup: { guestsRemoved: number; messagesRemoved: number } | undefined;
    if (slow) {
      try {
        const { sweepInactiveGuests, sweepOldMessages } = await import("@/lib/retention");
        cleanup = { guestsRemoved: await sweepInactiveGuests(200), messagesRemoved: await sweepOldMessages() };
      } catch (e) {
        console.error("Cleanup failed", e instanceof Error ? e.message : e);
      }
    }
    return NextResponse.json(res.started ? { ...res.run, ...(cleanup ? { cleanup } : {}) } : { skipped: res.reason, ...(cleanup ? { cleanup } : {}) }, { status: res.started || res.reason === "running" ? 200 : 500 });
  } catch (e) {
    console.error("Ingestion failed", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Ingestion failed." }, { status: 500 });
  }
}
