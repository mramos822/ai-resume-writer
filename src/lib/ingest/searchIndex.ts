// The search of OUR index: the jobs the ingestion keeps in the database. It is one more source of the job search, and the fastest.
import type { JobListing, JobQuery } from "@/lib/jobSearch";
import { index } from "@/lib/ingest/run";

const STOP = new Set(["the", "and", "for", "with", "a", "an", "of", "in", "at", "to", "job", "jobs"]);

/** The jobs of the index for a search: by the words typed (title, company, area), only open ones, remote only when asked. */
export async function searchIndex(q: JobQuery, limit = 80): Promise<JobListing[]> {
  const words = q.q
    .toLowerCase()
    .split(/[^a-z0-9+#.]+/)
    .filter((w) => w.length > 1 && !STOP.has(w));
  const filter: Record<string, unknown> = { active: true };
  if (words.length) filter.$text = { $search: words.join(" ") };
  if (q.remoteOnly) filter.remote = true;
  else if (q.location.trim()) {
    // the jobs in that place (any word of it: "Hillside, New Jersey"), plus remote ones, which can be done from there
    const place = q.location.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2);
    if (place.length) filter.$or = [{ remote: true }, { location: { $regex: place.join("|"), $options: "i" } }];
  }
  const cursor = index().find(filter as never, { projection: { _id: 0, board: 0, active: 0, firstSeenAt: 0, lastSeenAt: 0, closedAt: 0, expiresAt: 0, ...(words.length ? { score: { $meta: "textScore" } } : {}) } as never });
  const rows = words.length ? await cursor.sort({ score: { $meta: "textScore" }, postedAt: -1 } as never).limit(limit).toArray() : await cursor.sort({ postedAt: -1 }).limit(limit).toArray();
  return rows.map((r) => {
    const { score: _score, ...job } = r as unknown as JobListing & { score?: number };
    void _score;
    return job;
  });
}
