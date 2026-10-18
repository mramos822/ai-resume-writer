// The automatic ingestion: reads every company board and keeps its openings in our own database (collection `jobs_index`), which the search
// then reads. A job that a board stops publishing is marked closed and removed two weeks later (TTL index), so the index follows the boards.
import { db } from "@/lib/mongodb";
import { fetchBoard, fetchSmartRecruiters, type IndexedJob } from "@/lib/ingest/ats";
import { fetchComputrabajo } from "@/lib/ingest/computrabajo";
import type { Board } from "@/lib/ingest/boards";
import { detectLanguage, type PostingLang } from "@/lib/ingest/language";

export const CLOSED_KEPT_MS = 14 * 24 * 60 * 60 * 1000;

export interface IndexDoc extends IndexedJob {
  active: boolean;
  /** the language the posting is written in (a job without it, from before, counts as English) */
  lang?: PostingLang;
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
  let alsoOpen: string[] = []; // postings the index already has that the company still publishes (not read again)
  let remoteOf: Record<string, boolean> = {};
  try {
    if (b.source === "smartrecruiters") {
      const had = await index().find({ board }).project({ key: 1, _id: 0 }).toArray();
      const read = await fetchSmartRecruiters(b, new Set(had.map((d) => String(d.key))));
      jobs = read.jobs;
      alsoOpen = read.seen;
      remoteOf = read.remoteOf;
    } else if (b.source === "computrabajo") {
      // what the portal's country already has in the index, whatever group of searches found it: it is not read again
      const had = await index().find({ source: "computrabajo", key: { $regex: `^computrabajo:${b.token.split(":")[0]}:` } }).project({ key: 1, _id: 0 }).toArray();
      const read = await fetchComputrabajo(b, new Set(had.map((d) => String(d.key))));
      jobs = read.jobs;
      alsoOpen = read.seen;
      remoteOf = read.remoteOf;
    } else {
      jobs = await fetchBoard(b);
    }
  } catch (e) {
    // the board could not be read: nothing is closed (a site that is down must not make its jobs disappear)
    return { board, jobs: 0, closed: 0, error: e instanceof Error ? e.message : String(e) };
  }
  try {
    if (jobs.length > 0) {
      await index().bulkWrite(
        jobs.map((j) => {
          const doc: Record<string, unknown> = { ...j, lang: detectLanguage(`${j.title} ${j.description ?? ""}`), active: true, lastSeenAt: now };
          // a field with no value (the pay or the country, when the posting says none) is taken out, not saved as null
          const empty = Object.keys(doc).filter((k) => doc[k] === undefined);
          empty.forEach((k) => delete doc[k]);
          return {
            updateOne: {
              filter: { key: j.key },
              update: { $set: doc, $setOnInsert: { firstSeenAt: now }, $unset: { closedAt: "", expiresAt: "", ...Object.fromEntries(empty.map((k) => [k, ""])) } },
              upsert: true,
            },
          };
        }) as never,
        { ordered: false }
      );
    }
    // what the board published before and no longer publishes is closed. A board that came back EMPTY closes nothing: more likely a
    // problem than a company that closed every opening at once.
    if (alsoOpen.length > 0) {
      // still open, and with the place as the list says it today
      await index().bulkWrite(
        alsoOpen.map((key) => ({
          updateOne: { filter: { key }, update: { $set: { active: true, lastSeenAt: now, ...(key in remoteOf ? { remote: remoteOf[key] } : {}) }, $unset: { closedAt: "", expiresAt: "" } } },
        })) as never,
        { ordered: false }
      );
    }
    let closed = 0;
    if (jobs.length > 0 || alsoOpen.length > 0) {
      // a portal read through searches (Computrabajo) lists only the newest postings of each: one that is not on the list today may still be open, so it
      // is closed only when it has not been seen for ten days
      const unseenSince = b.source === "computrabajo" ? new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000) : now;
      const res = await index().updateMany({ board, active: true, lastSeenAt: { $lt: unseenSince } }, { $set: { active: false, closedAt: now, expiresAt: new Date(now.getTime() + CLOSED_KEPT_MS) } });
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
