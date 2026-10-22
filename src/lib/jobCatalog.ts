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
export const KEEP: Record<JobListing["source"], number> = { adzuna: 24 * HOUR, careerjet: 24 * HOUR, jooble: 24 * HOUR, remotive: 72 * HOUR, arbeitnow: 72 * HOUR, greenhouse: 72 * HOUR, lever: 72 * HOUR, ashby: 72 * HOUR, smartrecruiters: 72 * HOUR, workable: 72 * HOUR, recruitee: 72 * HOUR, teamtailor: 72 * HOUR, computrabajo: 72 * HOUR, getonboard: 72 * HOUR, remoteok: 72 * HOUR, jobicy: 72 * HOUR, usajobs: 72 * HOUR, link: 24 * HOUR };
/** how long the answer to one search is served as it is */
export const QUERY_TTL = 30 * 60 * 1000;
/** Adzuna's part of a search (the slowest: its postings are read one by one) is remembered longer: a person who comes back, or the dashboard that asked first, gets it at once */
export const ADZUNA_TTL = 3 * 60 * 60 * 1000;

interface CatalogDoc {
  key: string;
  source: JobListing["source"];
  description?: string;
  /** the pay read from the whole posting (it can be past the part of the text that is kept) */
  salary?: string;
  /** the posting was read for its pay (`salary` empty: it names none) */
  payChecked?: boolean;
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
export async function cachedSearch(qkey: string, ttl: number = QUERY_TTL): Promise<Found | null> {
  try {
    const doc = await queries().findOne({ qkey });
    if (!doc || Date.now() - +new Date(doc.at) > ttl || !Array.isArray(doc.jobs)) return null;
    return { jobs: doc.jobs, sources: doc.sources ?? [], bigCity: doc.bigCity };
  } catch {
    return null;
  }
}

/** Remembers a search (its answer) and every job in it. Never fails the search. */
export async function rememberSearch(qkey: string, found: Found, ttl: number = QUERY_TTL): Promise<void> {
  try {
    const now = Date.now();
    await queries().updateOne(
      { qkey },
      { $set: { qkey, jobs: found.jobs, sources: found.sources, bigCity: found.bigCity ?? null, at: new Date(now), expiresAt: new Date(now + ttl) } as never },
      { upsert: true }
    );
    const ops = found.jobs.map((j) => ({
      updateOne: {
        filter: { key: j.key },
        // a pay that was read from the posting is kept; a job that came without one never erases it
        update: { $set: { key: j.key, source: j.source, description: j.description ?? "", ...(j.salary ? { salary: j.salary, payChecked: true } : {}), savedAt: new Date(now), expiresAt: new Date(now + KEEP[j.source]) } },
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
    const live = docs.filter((d) => d.expiresAt && +new Date(d.expiresAt) > Date.now() && (d.description ?? "").length >= 600);
    const known = new Map(live.map((d) => [d.key, d.description as string]));
    const pay = new Map(live.filter((d) => d.salary).map((d) => [d.key, d.salary as string]));
    if (known.size === 0) return jobs;
    return jobs.map((j) => (known.has(j.key) ? { ...j, description: known.get(j.key), salary: j.salary ?? pay.get(j.key) } : j));
  } catch {
    return jobs;
  }
}

/** Raise it when the shape or the meaning of a stored job changes (a new pay rule...): the searches remembered before are no longer served and expire by themselves. */
const CACHE_VERSION = 3;

/** The pay already read for these jobs: its text, or null when the posting was read and names none. A job not read yet is not in the answer. */
export async function knownPays(keys: string[]): Promise<Record<string, string | null>> {
  const out: Record<string, string | null> = {};
  if (keys.length === 0) return out;
  try {
    const docs = await catalog()
      .find({ key: { $in: keys }, payChecked: true })
      .project({ key: 1, salary: 1, expiresAt: 1 })
      .toArray();
    for (const d of docs) if (d.expiresAt && +new Date(d.expiresAt) > Date.now()) out[d.key as string] = (d.salary as string) || null;
  } catch {
    /* nothing is known: the page asks for the reading */
  }
  return out;
}

/** Remembers the pay read from the posting of each job (null: it names none), so nobody reads that page again. */
export async function rememberPays(items: { key: string; source: JobListing["source"]; pay: string | null }[]): Promise<void> {
  if (items.length === 0) return;
  try {
    const now = Date.now();
    await catalog().bulkWrite(
      items.map((i) => ({
        updateOne: {
          filter: { key: i.key },
          update: { $set: { key: i.key, source: i.source, salary: i.pay ?? "", payChecked: true, savedAt: new Date(now), expiresAt: new Date(now + KEEP[i.source]) } },
          upsert: true,
        },
      })) as never,
      { ordered: false }
    );
  } catch {
    /* a help, not a need */
  }
}

/** The jobs that came without pay get the one already read from their posting. */
export async function withKnownPay(jobs: JobListing[]): Promise<JobListing[]> {
  const lacking = jobs.filter((j) => !j.salary && (j.source === "adzuna" || j.source === "link"));
  if (lacking.length === 0) return jobs;
  const known = await knownPays(lacking.map((j) => j.key));
  return jobs.map((j) => (!j.salary && known[j.key] ? { ...j, salary: known[j.key] as string } : j));
}

/** One string for a search, the same for the same search. */
export const searchKey = (parts: unknown[]): string => JSON.stringify([CACHE_VERSION, ...parts.map((p) => (typeof p === "string" ? p.toLowerCase().trim() : p))]);
