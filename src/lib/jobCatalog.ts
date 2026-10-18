// The jobs the search has already found and read, kept in the database so that
//  - a search someone already made comes back at once (and does not use up the daily limit of the job boards: Adzuna lets 250 hits a day),
//  - a posting that was read whole (see jobEnrich) is never read again, by anybody,
//  - the same job is the same job on every screen.
// Job boards' terms decide how long their data may be kept, so everything here EXPIRES (the database removes it by itself, see
// migrations): Adzuna one day, the others three days, a finished search half an hour. It is a cache that remembers, not a copy of a board.
import { db } from "@/lib/mongodb";
import { isPartialPosting, type JobListing } from "@/lib/jobSearch";

const HOUR = 60 * 60 * 1000;
/** how long a job of each source stays in the catalog */
export const KEEP: Record<JobListing["source"], number> = { adzuna: 24 * HOUR, remotive: 72 * HOUR, arbeitnow: 72 * HOUR, greenhouse: 72 * HOUR, lever: 72 * HOUR, link: 24 * HOUR };
/** how long the answer to one search is served as it is */
export const QUERY_TTL = 30 * 60 * 1000;

interface CatalogDoc {
  key: string;
  source: JobListing["source"];
  description?: string;
  savedAt: Date;
  expiresAt: Date;
}
interface QueryDoc {
  qkey: string;
  jobs: JobListing[];
  sources: string[];
  bigCity?: string;
  at: Date;
  expiresAt: Date;
}

const catalog = () => db.collection<CatalogDoc>("job_catalog");
const queries = () => db.collection<QueryDoc>("job_queries");

export interface Found {
  jobs: JobListing[];
  sources: string[];
  bigCity?: string;
}

/** The answer to a search made a moment ago, or null. Any problem with the database means "not found": the search just runs. */
export async function cachedSearch(qkey: string): Promise<Found | null> {
  try {
    const doc = await queries().findOne({ qkey });
    if (!doc || Date.now() - +new Date(doc.at) > QUERY_TTL || !Array.isArray(doc.jobs)) return null;
    return { jobs: doc.jobs, sources: doc.sources ?? [], bigCity: doc.bigCity };
  } catch {
    return null;
  }
}

/** Remembers a search (its answer) and every job in it. Never fails the search. */
export async function rememberSearch(qkey: string, found: Found): Promise<void> {
  try {
    const now = Date.now();
    await queries().updateOne(
      { qkey },
      { $set: { qkey, jobs: found.jobs, sources: found.sources, bigCity: found.bigCity ?? null, at: new Date(now), expiresAt: new Date(now + QUERY_TTL) } as never },
      { upsert: true }
    );
    const ops = found.jobs.map((j) => ({
      updateOne: {
        filter: { key: j.key },
        update: { $set: { key: j.key, source: j.source, description: j.description ?? "", savedAt: new Date(now), expiresAt: new Date(now + KEEP[j.source]) } },
        upsert: true,
      },
    }));
    if (ops.length) await catalog().bulkWrite(ops as never, { ordered: false });
  } catch {
    /* the catalog is a help, not a need */
  }
}

/** The jobs that came cut get the whole text kept from an earlier reading, so they are not read again. */
export async function withKnownText(jobs: JobListing[]): Promise<JobListing[]> {
  const cut = jobs.filter(isPartialPosting);
  if (cut.length === 0) return jobs;
  try {
    const docs = await catalog()
      .find({ key: { $in: cut.map((j) => j.key) } })
      .toArray();
    const known = new Map(docs.filter((d) => d.expiresAt && +new Date(d.expiresAt) > Date.now() && (d.description ?? "").length >= 600).map((d) => [d.key, d.description as string]));
    if (known.size === 0) return jobs;
    return jobs.map((j) => (known.has(j.key) ? { ...j, description: known.get(j.key) } : j));
  } catch {
    return jobs;
  }
}

/** One string for a search, the same for the same search. */
export const searchKey = (parts: unknown[]): string => JSON.stringify(parts.map((p) => (typeof p === "string" ? p.toLowerCase().trim() : p)));
