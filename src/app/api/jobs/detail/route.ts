import { NextResponse } from "next/server";
import { authUid, errorResponse, HttpError } from "@/lib/apiAuth";
import { fetchJobAdText } from "@/lib/jobAdText";
import { describe, factsOf, readPosting } from "@/lib/jobDigest";
import type { JobFacts } from "@/lib/jobFacts";
import { db } from "@/lib/mongodb";
import { cleanListing } from "@/lib/jobSearch";
import { isSafePublicUrl } from "@/lib/safeUrl";
import { limitedShared } from "@/lib/rateLimit";

// The whole job, for the page of a job: the posting itself is read (job boards only share its first lines) and turned into a short
// summary plus the sections of the job. If the page can't be read, the text the board gave is organized instead.
// What was read is kept for a while, so opening the same job again is instant.
const cache = new Map<string, { at: number; text: string; facts?: JobFacts }>();
const TTL = 6 * 60 * 60 * 1000;
// the same posting is read once for everybody: the answer is kept for a week
const KEPT = 7 * 24 * 60 * 60 * 1000;
const kept = () => db.collection("job_reads");

export async function POST(req: Request) {
  const tooMany = await limitedShared(req, "job-detail", 60, 10 * 60 * 1000);
  if (tooMany) return tooMany;
  try {
    await authUid(req);
    const body = (await req.json().catch(() => ({}))) as { job?: unknown };
    const job = cleanListing(body.job as never);
    if (!job) throw new HttpError(400, "That job could not be read.");

    const hit = cache.get(job.key);
    if (hit && Date.now() - hit.at < TTL) return NextResponse.json({ text: hit.text, facts: hit.facts });
    const stored = await kept().findOne({ key: job.key }).catch(() => null);
    if (stored && typeof stored.text === "string" && Date.now() - +new Date(stored.at) < KEPT) {
      cache.set(job.key, { at: Date.now(), text: stored.text, facts: stored.facts });
      return NextResponse.json({ text: stored.text, facts: stored.facts });
    }

    const have = (job.description || job.snippet || "").trim();
    // the posting's own page has the whole text; the board's text is the fallback
    const page = job.url && isSafePublicUrl(job.url) ? await fetchJobAdText(job.url, true, 1) : null;
    const source = page && page.length > have.length * 0.8 ? page : have;
    if (source.length < 80) return NextResponse.json({ text: null });

    const raw = await readPosting(`Title: ${job.title}\nCompany: ${job.company}\nLocation: ${job.location}\n\n${source}`);
    const text = describe(raw);
    if (text.length < 80) return NextResponse.json({ text: null });
    const facts = factsOf(raw);
    if (cache.size > 300) cache.delete(cache.keys().next().value as string);
    cache.set(job.key, { at: Date.now(), text, facts });
    await kept().updateOne({ key: job.key }, { $set: { key: job.key, text, facts: facts ?? null, at: new Date() } }, { upsert: true }).catch(() => {});
    return NextResponse.json({ text, facts });
  } catch (err) {
    return errorResponse(err, "We couldn't load the full posting.");
  }
}
