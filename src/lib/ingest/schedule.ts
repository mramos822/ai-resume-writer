// When the ingestion runs. Two things start it, and both go through here, so two runs never overlap and the index is never read twice in a row:
//  - the host's scheduler (a cron that calls /api/admin/ingest-jobs, see vercel.json),
//  - the job search itself, when the last reading is older than EVERY_MS (so it keeps up to date even if the scheduler is not set up yet).
// Every run is written to `ingest_runs`: what was read, what was closed, what failed.
import { db } from "@/lib/mongodb";
import { FAST_BOARDS, SLOW_BOARDS, type Board } from "@/lib/ingest/boards";
import { runIngestion } from "@/lib/ingest/run";

/** how old the last reading may be before a search starts a new one */
export const EVERY_MS = 6 * 60 * 60 * 1000;
/** a run that started and never finished (the server stopped) is not waited for after this long */
export const STUCK_MS = 15 * 60 * 1000;

export interface RunDoc {
  startedAt: Date;
  finishedAt?: Date;
  by: "scheduler" | "search";
  /** "fast" (one request per board) or "slow" (SmartRecruiters: one request per new posting) */
  set?: "fast" | "slow";
  boards: number;
  jobs?: number;
  closed?: number;
  failed?: number;
  errors?: string[];
}
const runs = () => db.collection<RunDoc>("ingest_runs");

/** The ingestion does not write when the database holds this much (MB): the free plan holds 512, and a full database stops accepting any write, the app's own included. */
export const STOP_AT_MB = 380;

/** What the database holds now, in MB (data and indexes); null when it cannot be known (then the ingestion goes on). */
export async function usedMb(): Promise<number | null> {
  try {
    const s = (await db.command({ dbStats: 1, scale: 1024 * 1024 })) as { dataSize?: number; indexSize?: number };
    return typeof s.dataSize === "number" ? s.dataSize + (s.indexSize ?? 0) : null;
  } catch {
    return null;
  }
}

export type Started = { started: true; run: Omit<RunDoc, "startedAt" | "finishedAt" | "by"> & { seconds: number } } | { started: false; reason: "fresh" | "running" | "error" | "full" };

/**
 * Reads the boards now, unless another run is going (started less than STUCK_MS ago and not finished) or, when `onlyIfDue`, the last
 * finished reading is newer than EVERY_MS. Never throws.
 */
export async function ingestNow({ by, onlyIfDue, set = "fast", boards, now = new Date() }: { by: RunDoc["by"]; onlyIfDue: boolean; set?: "fast" | "slow"; boards?: Board[]; now?: Date }): Promise<Started> {
  boards = boards ?? (set === "slow" ? SLOW_BOARDS : FAST_BOARDS);
  // the runs of the other set are not this one's business (a run from before sets existed has no set: it was a fast one)
  const mine = (set === "slow" ? { set: "slow" } : { set: { $ne: "slow" } }) as Record<string, unknown>;
  const filter = (extra: Record<string, unknown> = {}) => ({ ...mine, ...extra }) as never;
  try {
    const [last] = await runs().find(filter()).sort({ startedAt: -1 }).limit(1).toArray();
    if (last && !last.finishedAt && +now - +new Date(last.startedAt) < STUCK_MS) return { started: false, reason: "running" };
    const done = last?.finishedAt ? last : (await runs().find(filter({ finishedAt: { $exists: true } })).sort({ startedAt: -1 }).limit(1).toArray())[0];
    if (onlyIfDue && done?.finishedAt && +now - +new Date(done.finishedAt) < EVERY_MS) return { started: false, reason: "fresh" };

    const used = await usedMb();
    if (used !== null && used > STOP_AT_MB) {
      console.error(`Ingestion stopped: the database holds ${Math.round(used)} MB (limit ${STOP_AT_MB})`);
      return { started: false, reason: "full" };
    }

    const startedAt = now;
    await runs().insertOne({ startedAt, by, set, boards: boards.length } as RunDoc);
    // two callers can pass the check above at the same moment: the one that started first goes on, the other steps back
    const earlier = await runs().findOne(filter({ finishedAt: { $exists: false }, startedAt: { $lt: startedAt, $gt: new Date(+startedAt - STUCK_MS) } }));
    if (earlier) {
      await runs().deleteOne({ startedAt, by });
      return { started: false, reason: "running" };
    }
    // the fast boards are many different servers (8 at a time keeps the whole reading well under a minute); the slow ones are one company each
    const result = await runIngestion(boards, set === "slow" ? 4 : 8);
    const errors = result.results.filter((r) => r.error).map((r) => `${r.board}: ${r.error}`).slice(0, 30);
    await runs().updateOne({ startedAt, by }, { $set: { finishedAt: new Date(+startedAt + result.ms), jobs: result.jobs, closed: result.closed, failed: result.failed, errors } });
    return { started: true, run: { boards: boards.length, jobs: result.jobs, closed: result.closed, failed: result.failed, errors, seconds: Math.round(result.ms / 1000) } };
  } catch (e) {
    console.error("Ingestion could not run", e instanceof Error ? e.message : e);
    return { started: false, reason: "error" };
  }
}
