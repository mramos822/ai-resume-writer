import { NextResponse } from "next/server";
import { authUid, ownedProfile, errorResponse, HttpError } from "@/lib/apiAuth";
import { limited } from "@/lib/rateLimit";
import { cleanListing } from "@/lib/jobSearch";
import { asResumeLang } from "@/lib/resumeLang";
import { asTemplateId } from "@/lib/templates";
import { cleanAnswers, cutSuggestions, pageNote, withDraft, clip } from "@/lib/applicationCoach";
import { isTightPage } from "@/lib/pageRules";
import { measure } from "@/lib/reviewServer";
import { adviseLooks } from "@/lib/templateAdvice";
import type { ProfileData } from "@/context/profileContext";

// How the resume of a job (the profile plus the person's edits for it) sits on the page, with the look chosen. When it is crowded, what
// could be taken out FOR THIS JOB. Nothing is saved and the saved profile is never touched: the person decides what to apply.
export async function POST(req: Request) {
  const tooMany = limited(req, "page-fit", 150, 10 * 60 * 1000);
  if (tooMany) return tooMany;
  try {
    const uid = await authUid(req);
    const body = (await req.json().catch(() => ({}))) as { profileId?: string; job?: unknown; draft?: unknown; template?: unknown; extraSkills?: unknown; answers?: unknown; lang?: unknown; mode?: unknown };
    const job = cleanListing(body.job as never);
    if (!job) throw new HttpError(400, "That job could not be read.");
    const profile = await ownedProfile(uid, String(body.profileId ?? ""));
    const saved = profile.data as ProfileData;
    const data = {
      ...withDraft(saved, body.draft),
      name: (withDraft(saved, body.draft).name || (/^Profile \d+$/.test(profile.name) ? "John Doe" : profile.name)) as string,
    } as ProfileData;
    cleanAnswers(body.answers); // (the answers are not needed to measure; validated for shape only)
    const keep = (Array.isArray(body.extraSkills) ? body.extraSkills : []).map((x) => clip(x, 60)).filter(Boolean);

    // looks that suit this job, each measured with this resume (asked for by the person, since it renders several)
    if (body.mode === "looks") return NextResponse.json(await adviseLooks(data, job, asTemplateId(body.template), asResumeLang(body.lang)));

    const note = pageNote(await measure(data, asTemplateId(body.template), asResumeLang(body.lang)));
    if (!note) return NextResponse.json({ pages: null, scale: null, crowded: false, cut: { skills: [], jobs: [], review: [] } });
    // what could go: when it is crowded; and, when it is only tight, just the skills worth reviewing (the rest is not needed yet)
    const wide = note.crowded ? cutSuggestions(data, job, keep) : isTightPage(note) ? { ...cutSuggestions(data, job, keep), skills: [], jobs: [] } : { skills: [], jobs: [], review: [] };
    return NextResponse.json({ ...note, cut: wide });
  } catch (err) {
    return errorResponse(err, "We couldn't measure the page.");
  }
}
