import { createHash } from "crypto";
import { after, NextResponse } from "next/server";
import { authUid, errorResponse, HttpError } from "@/lib/apiAuth";
import { fetchJobAdText, JOB_AD_LINK_ERROR } from "@/lib/jobAdText";
import { isSafePublicUrl } from "@/lib/safeUrl";
import { offerOfListLink } from "@/lib/ingest/computrabajo";
import { limitedShared } from "@/lib/rateLimit";
import { describe, factsOf, JOB_LIST_ERROR, looksLikeJobList, readPosting, str } from "@/lib/jobDigest";
import { cleanListing, type JobListing } from "@/lib/jobSearch";
import { cachedImport, importKey, rememberImport, shareImport } from "@/lib/jobImports";
import { addComputrabajoOffer } from "@/lib/ingest/addOffer";

// "Add a job": for a posting the job search did not find. The person pastes a link (any site) or the text of the posting and
// it becomes a job like the others: it can be saved, compared with the profile and turned into an application.
// The AI only reads out the facts (title, company, place...). The description is the posting's own text, not a rewrite.

export async function POST(req: Request) {
  const tooMany = await limitedShared(req, "ai", 40, 10 * 60 * 1000);
  if (tooMany) return tooMany;
  try {
    const uid = await authUid(req);
    const body = (await req.json().catch(() => ({}))) as { url?: unknown; text?: unknown };
    let url = str(body.url, 1000);
    let text = str(body.text, 20000);
    let fromPage = false; // the text was read by the server from a public page (and not typed or pasted by the person)

    if (!url && text.length < 80) throw new HttpError(400, "Paste a link to the job, or the text of the posting.");
    if (url) {
      if (!/^https?:\/\//i.test(url) || !isSafePublicUrl(url)) throw new HttpError(400, "That link can't be opened. Check it, or paste the text of the posting instead.");
      // a link copied from a company page of Computrabajo with one offer open names that offer after the "#": the offer itself is read, not the list
      url = (await offerOfListLink(url)) ?? url;
      // the same link already read by somebody: it comes back at once (no download, no AI), and it is kept the same for everybody
      if (!text) {
        // a Computrabajo offer goes into the search for everybody at once (read from its own data, no AI); it is the same job the scheduled reading brings
        const offer = await addComputrabajoOffer(url);
        const added = offer && cleanListing(offer as never);
        if (added) return NextResponse.json({ job: added, shared: true });
        const known = await cachedImport(url);
        if (known) {
          // the second person to add the same link shares it with everybody: one person alone cannot
          if (known.by && known.by !== uid) after(() => shareImport(url, known.job).then(() => undefined));
          return NextResponse.json({ job: known.job, cached: true });
        }
        text = (await fetchJobAdText(url, true)) ?? "";
        if (!text) throw new HttpError(422, JOB_AD_LINK_ERROR);
        fromPage = true;
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
      key: url ? importKey(url) : `link:${createHash("sha1").update(text.slice(0, 2000)).digest("hex").slice(0, 16)}`,
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
    // kept for the next person who adds the same link; what a person pastes by hand is never kept
    if (fromPage && url) after(() => rememberImport(url, clean, uid));
    return NextResponse.json({ job: clean });
  } catch (err) {
    return errorResponse(err, "We couldn't read that posting. Try pasting its text instead.");
  }
}
