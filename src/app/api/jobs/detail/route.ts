import { NextResponse } from "next/server";
import { authUid, errorResponse, HttpError } from "@/lib/apiAuth";
import { fetchJobAdText } from "@/lib/jobAdText";
import { describe, readPosting } from "@/lib/jobDigest";
import { cleanListing } from "@/lib/jobSearch";
import { isSafePublicUrl } from "@/lib/safeUrl";
import { limitedShared } from "@/lib/rateLimit";

// The whole job, for the page of a job: the posting itself is read (job boards only share its first lines) and turned into a short
// summary plus the sections of the job. If the page can't be read, the text the board gave is organized instead.
// What was read is kept for a while, so opening the same job again is instant.
const cache = new Map<string, { at: number; text: string }>();
const TTL = 6 * 60 * 60 * 1000;

export async function POST(req: Request) {
  const tooMany = await limitedShared(req, "job-detail", 60, 10 * 60 * 1000);
  if (tooMany) return tooMany;
  try {
    await authUid(req);
    const body = (await req.json().catch(() => ({}))) as { job?: unknown };
    const job = cleanListing(body.job as never);
    if (!job) throw new HttpError(400, "That job could not be read.");

    const hit = cache.get(job.key);
    if (hit && Date.now() - hit.at < TTL) return NextResponse.json({ text: hit.text });

    const have = (job.description || job.snippet || "").trim();
    // the posting's own page has the whole text; the board's text is the fallback
    const page = job.url && isSafePublicUrl(job.url) ? await fetchJobAdText(job.url, true, 1) : null;
    const source = page && page.length > have.length * 0.8 ? page : have;
    if (source.length < 80) return NextResponse.json({ text: null });

    const raw = await readPosting(`Title: ${job.title}\nCompany: ${job.company}\nLocation: ${job.location}\n\n${source}`);
    const text = describe(raw);
    if (text.length < 80) return NextResponse.json({ text: null });
    if (cache.size > 300) cache.delete(cache.keys().next().value as string);
    cache.set(job.key, { at: Date.now(), text });
    return NextResponse.json({ text });
  } catch (err) {
    return errorResponse(err, "We couldn't load the full posting.");
  }
}
