// Reads with the AI the jobs of the index that nobody has read yet, so the exact fit (years, level, skills) is there BEFORE the person looks:
// the most recent first (they are the ones that show first), the ones of the US and the remote ones before the rest. It works in small batches
// that a scheduler calls again and again (see /api/admin/enrich-jobs and .github/workflows/enrich-jobs.yml), always within the day's budget of
// readings (JOB_FACTS_PER_DAY): when the budget is used up it stops, and the next day goes on from where it was.
import { index } from "@/lib/ingest/run";
import { db } from "@/lib/mongodb";
import { MIN_TEXT, readOnce, takeReading } from "@/lib/jobFactsStore";
import type { JobListing } from "@/lib/jobSearch";
import { unpackDescription } from "@/lib/ingest/pack";

const reads = () => db.collection<{ key: string }>("job_reads");

/** The next jobs of the index that have not been read, most recent first (US and remote jobs first). */
export async function pickUnread(limit: number): Promise<JobListing[]> {
  const out: JobListing[] = [];
  const seen = new Set<string>();
  // two passes: the jobs a person in the US sees (US or remote), then the rest
  for (const where of [{ $or: [{ country: "US" }, { remote: true }] }, {}]) {
    for (let skip = 0; out.length < limit && skip < 6000; skip += 100) {
      const docs = (await index()
        .find({ active: true, lang: { $in: ["en", null] }, ...where } as never)
        .sort({ postedAt: -1 })
        .skip(skip)
        .limit(100)
        .project({ _id: 0, board: 0, active: 0, firstSeenAt: 0, lastSeenAt: 0, closedAt: 0, expiresAt: 0, lang: 0, country: 0 })
        .toArray()).map((d) => unpackDescription(d)) as unknown as JobListing[];
      if (docs.length === 0) break;
      const done = new Set((await reads().find({ key: { $in: docs.map((d) => d.key) } }).project({ key: 1 }).toArray()).map((d) => String(d.key)));
      for (const d of docs) {
        if (done.has(d.key) || seen.has(d.key) || (d.description ?? "").length < MIN_TEXT) continue;
        seen.add(d.key);
        out.push(d);
        if (out.length >= limit) break;
      }
    }
  }
  return out;
}

export interface EnrichResult {
  read: number;
  failed: number;
  stopped?: "budget" | "busy" | "time" | "done";
}

/**
 * Reads unread jobs for up to `ms` milliseconds, steadily: `parallel` at a time with `pauseMs` between two readings of the same worker, each one
 * taking a reading from the day's budget. The free key of Gemini sustains about ten readings a minute (one worker, 3 s pause) and answers "busy" to
 * a burst, so the default is one worker; with a paid key raise ENRICH_PARALLEL (and JOB_FACTS_PER_DAY). Stops when the budget is used up, when
 * the AI says it is busy, or when there is nothing left to read.
 */
export async function enrichBatch({
  ms = 45_000,
  parallel = Math.max(1, Number(process.env.ENRICH_PARALLEL) || 1),
  pauseMs = Number.isFinite(Number(process.env.ENRICH_PAUSE_MS)) && process.env.ENRICH_PAUSE_MS ? Number(process.env.ENRICH_PAUSE_MS) : 3000,
  max = 40,
}: { ms?: number; parallel?: number; pauseMs?: number; max?: number } = {}): Promise<EnrichResult> {
  const deadline = Date.now() + ms;
  const queue = await pickUnread(max);
  const result: EnrichResult = { read: 0, failed: 0 };
  if (queue.length === 0) return { ...result, stopped: "done" };
  const worker = async () => {
    for (let job = queue.shift(); job; job = queue.shift()) {
      if (result.stopped) return;
      if (Date.now() > deadline) {
        result.stopped ??= "time";
        return;
      }
      if (!(await takeReading())) {
        result.stopped ??= "budget";
        return;
      }
      try {
        await readOnce(job);
        result.read++;
      } catch (e) {
        if ((e as { status?: number })?.status === 429) {
          result.stopped ??= "busy";
          return;
        }
        result.failed++;
      }
      if (queue.length > 0 && pauseMs > 0) await new Promise((r) => setTimeout(r, pauseMs));
    }
  };
  await Promise.all(Array.from({ length: parallel }, worker));
  return result;
}
