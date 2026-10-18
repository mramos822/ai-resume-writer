import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { authUid, errorResponse, HttpError } from "@/lib/apiAuth";
import { fetchJobAdText, JOB_AD_LINK_ERROR } from "@/lib/jobAdText";
import { isSafePublicUrl } from "@/lib/safeUrl";
import { offerOfListLink } from "@/lib/ingest/computrabajo";
import { limitedShared } from "@/lib/rateLimit";
import { describe, factsOf, JOB_LIST_ERROR, looksLikeJobList, readPosting, str } from "@/lib/jobDigest";
import { cleanListing, type JobListing } from "@/lib/jobSearch";

// "Add a job": for a posting the job search did not find. The person pastes a link (any site) or the text of the posting and
// it becomes a job like the others: it can be saved, compared with the profile and turned into an application.
// The AI only reads out the facts (title, company, place...). The description is the posting's own text, not a rewrite.

export async function POST(req: Request) {
  const tooMany = await limitedShared(req, "ai", 40, 10 * 60 * 1000);
  if (tooMany) return tooMany;
  try {
    await authUid(req);
    const body = (await req.json().catch(() => ({}))) as { url?: unknown; text?: unknown };
    let url = str(body.url, 1000);
    let text = str(body.text, 20000);

    if (!url && text.length < 80) throw new HttpError(400, "Paste a link to the job, or the text of the posting.");
    if (url) {
      if (!/^https?:\/\//i.test(url) || !isSafePublicUrl(url)) throw new HttpError(400, "That link can't be opened. Check it, or paste the text of the posting instead.");
      // a link copied from a company page of Computrabajo with one offer open names that offer after the "#": the offer itself is read, not the list
      url = (await offerOfListLink(url)) ?? url;
      if (!text) {
        text = (await fetchJobAdText(url, true)) ?? "";
        if (!text) throw new HttpError(422, JOB_AD_LINK_ERROR);
      }
    }

    // a page of many jobs is not a posting: said at once, without asking the AI to make one job out of it
    if (looksLikeJobList(url, text)) throw new HttpError(422, JOB_LIST_ERROR);
    const raw = await readPosting(text);
    if (raw.isList === true) throw new HttpError(422, JOB_LIST_ERROR);
    const title = str(raw.title, 200);
    if (!title) throw new HttpError(422, "That doesn't look like a job posting. Paste the part of the page with the job description.");

    const posted = str(raw.postedAt, 10);
    const tidy = describe(raw);
    const description = tidy.length >= 80 ? tidy : text.replace(/[ \t]+/g, " ").slice(0, 3500); // if the AI gave nothing usable, the text itself
    const job: Partial<JobListing> = {
      key: `link:${createHash("sha1").update(url || text.slice(0, 2000)).digest("hex").slice(0, 16)}`,
      source: "link",
      title,
      company: str(raw.company, 200),
      location: str(raw.location, 200),
      remote: raw.remote === true,
      url,
      postedAt: /^\d{4}-\d{2}-\d{2}$/.test(posted) ? posted : "",
      salary: str(raw.salary, 80) || undefined,
      tags: (Array.isArray(raw.tags) ? raw.tags : []).map((t) => str(t, 40)).filter(Boolean).slice(0, 6),
      snippet: (str(raw.summary, 380) || description.replace(/\s+/g, " ")).slice(0, 380),
      description,
      facts: factsOf(raw),
    };
    const clean = cleanListing(job);
    if (!clean) throw new HttpError(422, "We couldn't read that posting.");
    return NextResponse.json({ job: clean });
  } catch (err) {
    return errorResponse(err, "We couldn't read that posting. Try pasting its text instead.");
  }
}
