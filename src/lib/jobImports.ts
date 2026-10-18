// The postings people add with "Add a job" from a LINK, kept on the server for a while:
//  - the next person who pastes the same link gets the job at once, without the page being downloaded and read by the AI again (that read is the
//    slow and costly part, and the free AI budget of the day is small),
//  - the job keeps a stable key, so a link inside the app (/home/job-ads?job=<key>) can open it,
//  - if the posting is taken down from its site, it can still be seen here for a while.
// It is a cache, not a board: these jobs never appear in anybody's search. They expire (see migrations). Only what the SERVER read from a public
// page is kept: the text a person pastes by hand is never stored or shared (it may hold private data).
import { createHash } from "crypto";
import { db } from "@/lib/mongodb";
import { index } from "@/lib/ingest/run";
import { runMigrations } from "@/lib/migrations";
import { cleanListing, type JobListing } from "@/lib/jobSearch";

/** how long a posting added by link is kept */
export const IMPORT_KEPT_MS = 14 * 24 * 60 * 60 * 1000;

interface ImportDoc {
  key: string;
  url: string;
  job: JobListing;
  savedAt: Date;
  expiresAt: Date;
}
const imports = () => db.collection<ImportDoc>("job_imports");

// the marks that say where a click came from: they change the address and not the posting
const TRACKING = /^(utm_.*|fbclid|gclid|mc_cid|mc_eid|trk|trackingid|refid|lc)$/i;

/** The address without what does not make it another posting: the "#" part, the tracking marks, a final slash, the case of the site's name. */
export function normalizeUrl(url: string): string | null {
  try {
    const u = new URL(url.trim());
    if (!/^https?:$/.test(u.protocol)) return null;
    u.hash = "";
    // Adzuna's addresses carry a different mark of every search (se, v...): the posting is the number in the path
    if (/(^|\.)adzuna\./i.test(u.hostname)) u.search = "";
    else for (const k of [...u.searchParams.keys()]) if (TRACKING.test(k)) u.searchParams.delete(k);
    u.searchParams.sort();
    const path = u.pathname.length > 1 ? u.pathname.replace(/\/+$/, "") : u.pathname;
    return `${u.protocol}//${u.hostname.toLowerCase()}${path}${u.search}`;
  } catch {
    return null;
  }
}

/** The key of the job added from this link: the same link (however it was copied) is always the same job. */
export function importKey(url: string): string {
  return `link:${createHash("sha1").update(normalizeUrl(url) ?? url).digest("hex").slice(0, 16)}`;
}

/** The job already read from this link, or null. Any problem with the database means "not found": the link is simply read. */
export async function cachedImport(url: string): Promise<JobListing | null> {
  try {
    const doc = await imports().findOne({ key: importKey(url) });
    if (!doc || !(+new Date(doc.expiresAt) > Date.now())) return null;
    return cleanListing(doc.job as never);
  } catch {
    return null;
  }
}

/** Keeps the job read from this link. Never fails what the person is doing. */
export async function rememberImport(url: string, job: JobListing): Promise<void> {
  try {
    await runMigrations(); // the index that makes it expire exists before the first one is written
    const now = Date.now();
    const key = importKey(url);
    await imports().updateOne({ key }, { $set: { key, url: normalizeUrl(url) ?? url, job: { ...job, key }, savedAt: new Date(now), expiresAt: new Date(now + IMPORT_KEPT_MS) } }, { upsert: true });
  } catch {
    /* a cache */
  }
}

/** A job of the index or one added by link, by its key (for a link inside the app); null when there is none. Jobs of Adzuna are not kept: they are found by searching. */
export async function jobByKey(key: string): Promise<JobListing | null> {
  try {
    if (key.startsWith("link:")) {
      const doc = await imports().findOne({ key });
      return doc && +new Date(doc.expiresAt) > Date.now() ? cleanListing(doc.job as never) : null;
    }
    const doc = await index().findOne({ key, active: true }, { projection: { _id: 0, board: 0, active: 0, firstSeenAt: 0, lastSeenAt: 0, closedAt: 0, expiresAt: 0 } });
    return doc ? cleanListing(doc as never) : null;
  } catch {
    return null;
  }
}
