// The automatic ingestion: reads every company board and keeps its openings in our own database (collection `jobs_index`), which the search
// then reads. A job that a board stops publishing is marked closed and removed two weeks later (TTL index), so the index follows the boards.
import { db } from "@/lib/mongodb";
import { fetchBoard, type IndexedJob } from "@/lib/ingest/ats";
import type { Board } from "@/lib/ingest/boards";

export const CLOSED_KEPT_MS = 14 * 24 * 60 * 60 * 1000;

export interface IndexDoc extends IndexedJob {
  active: boolean;
  firstSeenAt: Date;
  lastSeenAt: Date;
  closedAt?: Date;
  /** set only when the job is closed: the database removes it then */
  expiresAt?: Date;
}
export const index = () => db.collection<IndexDoc>("jobs_index");

export interface BoardResult {
  board: string;
  jobs: number;
  closed: number;
  error?: string;
}

/** Reads one board and brings the index up to date with it. Never throws: a failing board is reported in its result. */
export async function ingestBoard(b: Board, now = new Date()): Promise<BoardResult> {
  const board = `${b.source}:${b.token}`;
  let jobs: IndexedJob[];
  try {
    jobs = await fetchBoard(b);
  } catch (e) {
    // the board could not be read: nothing is closed (a site that is down must not make its jobs disappear)
    return { board, jobs: 0, closed: 0, error: e instanceof Error ? e.message : String(e) };
  }
  try {
    if (jobs.length > 0) {
      await index().bulkWrite(
        jobs.map((j) => ({
          updateOne: {
            filter: { key: j.key },
            update: {
              $set: { ...j, active: true, lastSeenAt: now },
              $setOnInsert: { firstSeenAt: now },
              $unset: { closedAt: "", expiresAt: "" },
            },
            upsert: true,
          },
        })) as never,
        { ordered: false }
      );
    }
    // what the board published before and no longer publishes is closed. A board that came back EMPTY closes nothing: more likely a
    // problem than a company that closed every opening at once.
    let closed = 0;
    if (jobs.length > 0) {
      const res = await index().updateMany({ board, active: true, lastSeenAt: { $lt: now } }, { $set: { active: false, closedAt: now, expiresAt: new Date(now.getTime() + CLOSED_KEPT_MS) } });
      closed = res.modifiedCount ?? 0;
    }
    return { board, jobs: jobs.length, closed };
  } catch (e) {
    return { board, jobs: jobs.length, closed: 0, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Every board, a few at a time (the boards are other companies' servers: no hurry, no flood). */
export async function runIngestion(boards: Board[], concurrency = 4): Promise<{ results: BoardResult[]; jobs: number; closed: number; failed: number; ms: number }> {
  const started = Date.now();
  const results: BoardResult[] = [];
  const queue = [...boards];
  const worker = async () => {
    for (let b = queue.shift(); b; b = queue.shift()) results.push(await ingestBoard(b, new Date(started)));
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, boards.length) }, worker));
  return { results, jobs: results.reduce((n, r) => n + r.jobs, 0), closed: results.reduce((n, r) => n + r.closed, 0), failed: results.filter((r) => r.error).length, ms: Date.now() - started };
}
