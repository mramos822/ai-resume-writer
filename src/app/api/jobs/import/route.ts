import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { authUid, errorResponse, HttpError } from "@/lib/apiAuth";
import { fetchJobAdText, JOB_AD_LINK_ERROR } from "@/lib/jobAdText";
import { isSafePublicUrl } from "@/lib/safeUrl";
import { limited } from "@/lib/rateLimit";
import { getOpenAIChatCompletion } from "@/lib/openaiClient";
import { AI_MODEL } from "@/lib/aiConfig";
import { cleanListing, type JobListing } from "@/lib/jobSearch";

// "Add a job": for a posting the job search did not find. The person pastes a link (any site) or the text of the posting and
// it becomes a job like the others: it can be saved, compared with the profile and turned into an application.
// The AI only reads out the facts (title, company, place...). The description is the posting's own text, not a rewrite.

const SYSTEM = `You read a job posting and extract its facts. Reply with ONE JSON object and nothing else:
{
  "title": "<job title>",
  "company": "<employer name, or empty>",
  "location": "<city/state/country, or empty>",
  "remote": <true if the job is remote, else false>,
  "salary": "<pay as written, or empty>",
  "postedAt": "<ISO date YYYY-MM-DD if the posting says when it was posted, else empty>",
  "tags": ["<up to 6 short keywords: employment type, field, main tools>"]
}
Never invent anything that is not in the text. If the text is not a job posting, use an empty title.`;

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export async function POST(req: Request) {
  const tooMany = limited(req, "ai", 40, 10 * 60 * 1000);
  if (tooMany) return tooMany;
  try {
    await authUid(req);
    const body = (await req.json().catch(() => ({}))) as { url?: unknown; text?: unknown };
    const url = str(body.url, 1000);
    let text = str(body.text, 20000);

    if (!url && text.length < 80) throw new HttpError(400, "Paste a link to the job, or the text of the posting.");
    if (url) {
      if (!/^https?:\/\//i.test(url) || !isSafePublicUrl(url)) throw new HttpError(400, "That link can't be opened. Check it, or paste the text of the posting instead.");
      if (!text) {
        text = (await fetchJobAdText(url)) ?? "";
        if (!text) throw new HttpError(422, JOB_AD_LINK_ERROR);
      }
    }

    const completion = await getOpenAIChatCompletion({
      model: AI_MODEL,
      temperature: 0,
      max_tokens: 500,
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: text.slice(0, 9000) },
      ],
    });
    let raw: Record<string, unknown> = {};
    try {
      raw = JSON.parse(completion.content);
    } catch {
      raw = {};
    }
    const title = str(raw.title, 200);
    if (!title) throw new HttpError(422, "That doesn't look like a job posting. Paste the part of the page with the job description.");

    const posted = str(raw.postedAt, 10);
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
      snippet: text.replace(/\s+/g, " ").slice(0, 380),
      description: text.replace(/[ \t]+/g, " ").slice(0, 3500),
    };
    const clean = cleanListing(job);
    if (!clean) throw new HttpError(422, "We couldn't read that posting.");
    return NextResponse.json({ job: clean });
  } catch (err) {
    return errorResponse(err, "We couldn't read that posting. Try pasting its text instead.");
  }
}
