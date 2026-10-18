// When the ingestion runs. Two things start it, and both go through here, so two runs never overlap and the index is never read twice in a row:
//  - the host's scheduler (a cron that calls /api/admin/ingest-jobs, see vercel.json),
//  - the job search itself, when the last reading is older than EVERY_MS (so it keeps up to date even if the scheduler is not set up yet).
// Every run is written to `ingest_runs`: what was read, what was closed, what failed.
import { db } from "@/lib/mongodb";
import { BOARDS, type Board } from "@/lib/ingest/boards";
import { runIngestion } from "@/lib/ingest/run";

/** how old the last reading may be before a search starts a new one */
export const EVERY_MS = 6 * 60 * 60 * 1000;
/** a run that started and never finished (the server stopped) is not waited for after this long */
export const STUCK_MS = 15 * 60 * 1000;

export interface RunDoc {
  startedAt: Date;
  finishedAt?: Date;
  by: "scheduler" | "search";
  boards: number;
  jobs?: number;
  closed?: number;
  failed?: number;
  errors?: string[];
}
const runs = () => db.collection<RunDoc>("ingest_runs");

export type Started = { started: true; run: Omit<RunDoc, "startedAt" | "finishedAt" | "by"> & { seconds: number } } | { started: false; reason: "fresh" | "running" | "error" };

/**
 * Reads the boards now, unless another run is going (started less than STUCK_MS ago and not finished) or, when `onlyIfDue`, the last
 * finished reading is newer than EVERY_MS. Never throws.
 */
export async function ingestNow({ by, onlyIfDue, boards = BOARDS, now = new Date() }: { by: RunDoc["by"]; onlyIfDue: boolean; boards?: Board[]; now?: Date }): Promise<Started> {
  try {
    const [last] = await runs().find({}).sort({ startedAt: -1 }).limit(1).toArray();
    if (last && !last.finishedAt && +now - +new Date(last.startedAt) < STUCK_MS) return { started: false, reason: "running" };
    const done = last?.finishedAt ? last : (await runs().find({ finishedAt: { $exists: true } }).sort({ startedAt: -1 }).limit(1).toArray())[0];
    if (onlyIfDue && done?.finishedAt && +now - +new Date(done.finishedAt) < EVERY_MS) return { started: false, reason: "fresh" };

    const startedAt = now;
    await runs().insertOne({ startedAt, by, boards: boards.length } as RunDoc);
    // two callers can pass the check above at the same moment: the one that started first goes on, the other steps back
    const earlier = await runs().findOne({ finishedAt: { $exists: false }, startedAt: { $lt: startedAt, $gt: new Date(+startedAt - STUCK_MS) } });
    if (earlier) {
      await runs().deleteOne({ startedAt, by });
      return { started: false, reason: "running" };
    }
    const result = await runIngestion(boards);
    const errors = result.results.filter((r) => r.error).map((r) => `${r.board}: ${r.error}`).slice(0, 30);
    await runs().updateOne({ startedAt, by }, { $set: { finishedAt: new Date(+startedAt + result.ms), jobs: result.jobs, closed: result.closed, failed: result.failed, errors } });
    return { started: true, run: { boards: boards.length, jobs: result.jobs, closed: result.closed, failed: result.failed, errors, seconds: Math.round(result.ms / 1000) } };
  } catch (e) {
    console.error("Ingestion could not run", e instanceof Error ? e.message : e);
    return { started: false, reason: "error" };
  }
}
