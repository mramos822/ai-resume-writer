// The facts the AI reads out of a posting (years, level, skills: see jobFacts) are read ONCE per job and kept, so the number of a job is exact
// everywhere without anybody opening it. Who reads them, and when:
//  - the page of a job, when somebody opens it (api/jobs/detail),
//  - "warm", in the background, for the jobs a person has on screen (api/jobs/warm), slowly and within a limit of readings per day.
// The AI is a limited resource (the free key allows few calls): every reading takes from a daily budget, and when it runs out, nothing is read.
import { db } from "@/lib/mongodb";
import { describe, factsOf, readPosting } from "@/lib/jobDigest";
import type { JobFacts } from "@/lib/jobFacts";
import type { JobListing } from "@/lib/jobSearch";

/** readings of the AI per day for this (override with JOB_FACTS_PER_DAY): the free key of Gemini is small */
export const readsPerDay = () => {
  const n = Number(process.env.JOB_FACTS_PER_DAY);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 150;
};
/** the shortest text worth reading: below it there is nothing to find */
export const MIN_TEXT = 300;

interface ReadDoc {
  key: string;
  text: string;
  facts?: JobFacts | null;
  at: Date;
}
const reads = () => db.collection<ReadDoc>("job_reads");
const budget = () => db.collection<{ _id: string; n: number; expireAt: Date }>("ai_budget");

/** The facts already read for these jobs, by key. Never throws. */
export async function storedFacts(keys: string[]): Promise<Record<string, JobFacts>> {
  if (keys.length === 0) return {};
  try {
    const docs = await reads().find({ key: { $in: keys } }).toArray();
    const out: Record<string, JobFacts> = {};
    for (const d of docs) if (d.facts) out[d.key] = d.facts;
    return out;
  } catch {
    return {};
  }
}

/** The jobs with the facts that were already read put in. */
export async function withStoredFacts<T extends Pick<JobListing, "key" | "facts">>(jobs: T[]): Promise<T[]> {
  const known = await storedFacts(jobs.filter((j) => !j.facts).map((j) => j.key));
  return Object.keys(known).length ? jobs.map((j) => (known[j.key] ? { ...j, facts: known[j.key] } : j)) : jobs;
}

/** Takes one reading from today's budget. False when the day's readings are used up (or the budget cannot be known). */
export async function takeReading(now = new Date()): Promise<boolean> {
  const limit = readsPerDay();
  if (limit <= 0) return false;
  const day = now.toISOString().slice(0, 10);
  try {
    // when the day is already full the filter matches nothing and the upsert tries to insert the same _id again: a duplicate key error
    await budget().updateOne({ _id: `facts:${day}`, n: { $lt: limit } }, { $inc: { n: 1 }, $setOnInsert: { expireAt: new Date(+now + 3 * 24 * 60 * 60 * 1000) } }, { upsert: true });
    return true;
  } catch {
    return false;
  }
}

/** Reads one job with the AI and keeps what it found. Returns the facts, or null when there was nothing to read. Throws what the AI throws. */
export async function readOnce(job: JobListing): Promise<JobFacts | null> {
  const source = (job.description || job.snippet || "").trim();
  if (source.length < MIN_TEXT) return null;
  const raw = await readPosting(`Title: ${job.title}\nCompany: ${job.company}\nLocation: ${job.location}\n\n${source}`);
  const text = describe(raw);
  const facts = factsOf(raw);
  if (text.length >= 80) await reads().updateOne({ key: job.key }, { $set: { key: job.key, text, facts: facts ?? null, at: new Date() } }, { upsert: true }).catch(() => {});
  return facts ?? null;
}

/** the jobs being read right now by this server, so two overlapping requests never pay for the same reading twice */
const inflight = new Set<string>();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Reads, one by one and slowly, the jobs that have no facts yet. Stops when the day's budget is used up or the AI says it is busy.
 * `pauseMs` between two readings keeps the free key under its limit per minute.
 */
export async function warm(jobs: JobListing[], pauseMs = 3000): Promise<{ read: number; stopped?: "budget" | "busy" }> {
  // a job that was read (even when the AI found no facts in it) is not read again
  const keyed = await reads().find({ key: { $in: jobs.map((j) => j.key) } }).project({ key: 1 }).toArray().catch(() => []);
  const done = new Set(keyed.map((d) => String(d.key)));
  let read = 0;
  for (const job of jobs) {
    if (done.has(job.key) || inflight.has(job.key) || (job.description || job.snippet || "").trim().length < MIN_TEXT) continue;
    if (!(await takeReading())) return { read, stopped: "budget" };
    inflight.add(job.key);
    try {
      await readOnce(job);
      read++;
    } catch (e) {
      if ((e as { status?: number })?.status === 429) return { read, stopped: "busy" };
    } finally {
      inflight.delete(job.key);
    }
    await sleep(pauseMs);
  }
  return { read };
}
