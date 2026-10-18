import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { CT_BOARDS } from "@/lib/ingest/boards";
import { ingestNow } from "@/lib/ingest/schedule";
import { runMigrations } from "@/lib/migrations";

// For a scheduler (a cron on the host, for example every hour): reads every company board and brings the jobs index up to date.
// It needs `Authorization: Bearer <CRON_SECRET>`. Vercel's cron calls it with GET and sends that header by itself (see vercel.json);
// "?only=smartrecruiters" (or the same in the POST body) reads the slow set instead: SmartRecruiters needs one request per new posting.
export const maxDuration = 60; // a full reading takes about twenty seconds

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  return run(req, sp.get("only") ?? undefined, sp.get("part") ?? undefined);
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { only?: unknown; part?: unknown };
  return run(req, typeof body.only === "string" ? body.only : undefined, body.part === undefined ? undefined : String(body.part));
}

async function run(req: Request, only: string | undefined, part?: string) {
  const secret = process.env.CRON_SECRET || "";
  const given = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  const ok = secret.length >= 16 && given.length === secret.length && timingSafeEqual(Buffer.from(given), Buffer.from(secret));
  if (!ok) return NextResponse.json({ error: "Not allowed." }, { status: 401 });
  try {
    // by default the boards that take seconds; the ones that need a request per posting (SmartRecruiters) are read apart: ?only=smartrecruiters
    const slow = only === "smartrecruiters";
    // Computrabajo is read one board at a time ("?only=computrabajo&part=3"): slow on purpose, a few dozen new postings per call. Without "part" the day picks it, so a
    // daily call goes round all of them.
    const ct = only === "computrabajo";
    // the feeds of the boards of many companies (Get on Board, USAJOBS, Remote OK, Jobicy, Remotive, Arbeitnow) are one call apart: "?only=feeds"
    const feeds = only === "feeds";
    await runMigrations(); // the indexes of the jobs index exist before anything is written
    const pick = Number.isInteger(Number(part)) && part !== undefined && part !== "" ? Number(part) : Math.floor(Date.now() / 86_400_000);
    const res = ct ? await ingestNow({ by: "scheduler", onlyIfDue: false, set: "ct", boards: [CT_BOARDS[((pick % CT_BOARDS.length) + CT_BOARDS.length) % CT_BOARDS.length]] }) : await ingestNow({ by: "scheduler", onlyIfDue: false, set: feeds ? "feeds" : slow ? "slow" : "fast" });
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
