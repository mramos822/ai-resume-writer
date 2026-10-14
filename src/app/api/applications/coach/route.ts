import { NextResponse } from "next/server";
import { authUid, ownedProfile, errorResponse, HttpError } from "@/lib/apiAuth";
import { limited } from "@/lib/rateLimit";
import { cleanListing } from "@/lib/jobSearch";
import { asResumeLang } from "@/lib/resumeLang";
import { AiAnswerError, cleanAnswers, cleanMemory, clip, EVALUATE_VERSION, evaluateDraft, fixesFor, groupsForNewSkills, OBJECTIVE_VERSION, objectiveWithLevelAi, pageNote, QUESTIONS_VERSION, questionsFor, SHOWN_VERSION, skillsAlreadyShown, withDraft } from "@/lib/applicationCoach";
import { cachedAi, jobSignature } from "@/lib/aiCache";
import { profileForReview } from "@/lib/resumeReview";
import { asLevel, LEVEL_LABEL } from "@/lib/experienceLevel";
import { measure } from "@/lib/reviewServer";
import { jobScore } from "@/lib/jobScore";
import { trimToFit } from "@/lib/pageTrim";
import { applyFixes, type ReviewFix } from "@/lib/resumeReview";
import { asTemplateId } from "@/lib/templates";
import { levelOf } from "@/lib/jobLevel";
import type { ProfileData } from "@/context/profileContext";

// Before a resume is made for a job, in two steps:
//  - action "questions": what the person may have that the resume does not show (yes/no questions that raise the fit)
//  - action "evaluate":  the draft judged for this job (requirements, ATS, XYZ bullets), counting what the person confirmed
export async function POST(req: Request) {
  const tooMany = limited(req, "ai", 60, 10 * 60 * 1000);
  if (tooMany) return tooMany;
  try {
    const uid = await authUid(req);
    const body = (await req.json().catch(() => ({}))) as { action?: string; profileId?: string; job?: unknown; missingSkills?: unknown; extraSkills?: unknown; answers?: unknown; draft?: unknown; newSkills?: unknown; improvements?: unknown; level?: unknown; lang?: unknown; targets?: unknown; previous?: unknown; refresh?: unknown };
    const job = cleanListing(body.job as never);
    if (!job) throw new HttpError(400, "That job could not be read.");
    const profile = await ownedProfile(uid, String(body.profileId ?? ""));
    const data = withDraft(profile.data as ProfileData, body.draft); // what the person is editing for this job, if anything
    const lang = asResumeLang(body.lang);
    const names = (v: unknown) => (Array.isArray(v) ? v : []).map((x) => clip(x, 60)).filter(Boolean).slice(0, 20);

    // The answers that only READ the resume and the job are kept by what the AI was given (see lib/aiCache): the same resume for the same
    // job gives the same answer at once, and a different one is asked again. What changes the resume (fix, trim, group) is never kept.
    const sig = jobSignature(job);
    const resume = profileForReview(data);

    if (body.action === "questions") {
      const missing = names(body.missingSkills);
      const { value, cached } = await cachedAi("questions", uid, { v: QUESTIONS_VERSION, job: sig, resume, missing, lang }, () => questionsFor(data, job, missing, lang), (q) => q.length > 0); // an empty list may be a failed call: only a real one is kept
      return NextResponse.json({ questions: value }, { headers: { "X-Cache": cached ? "hit" : "miss" } });
    }
    if (body.action === "group") {
      // new skills of the draft: each goes in the group of skills the resume already has that fits it
      return NextResponse.json({ placements: await groupsForNewSkills(data, names(body.newSkills)) });
    }
    if (body.action === "trim") {
      // make the draft pass the page filter: the page applies the result live (and can undo it)
      const trimmed = await trimToFit(data, job, asTemplateId((body as { template?: unknown }).template), lang, names(body.extraSkills));
      return NextResponse.json({ skills: trimmed.profile.skills ?? [], jobHistory: trimmed.profile.jobHistory ?? [], steps: trimmed.steps, passes: trimmed.passes });
    }
    if (body.action === "shown") {
      // before asking "do you have these skills?": which of them the resume already shows
      const missing = names(body.missingSkills);
      const { value, cached } = await cachedAi("shown", uid, { v: SHOWN_VERSION, resume, missing }, () => skillsAlreadyShown(data, missing), (v) => v.length > 0);
      return NextResponse.json({ shown: value }, { headers: { "X-Cache": cached ? "hit" : "miss" } });
    }
    if (body.action === "objective") {
      // the objective rewritten with the person's level inside it (the level they confirmed)
      const lv = asLevel(body.level);
      if (!lv) throw new HttpError(400, "Level not provided.");
      const { value, cached } = await cachedAi("objective", uid, { v: OBJECTIVE_VERSION, job: sig, resume, level: lv, lang }, () => objectiveWithLevelAi(data, job, LEVEL_LABEL[lv], lang), (o) => !!o);
      return NextResponse.json({ objective: value }, { headers: { "X-Cache": cached ? "hit" : "miss" } });
    }
    if (body.action === "fix") {
      // "fix all": structured changes for what the review asked for, to be applied to the draft in the page
      const answers = cleanAnswers(body.answers).filter((a) => a.yes);
      const improvements = (Array.isArray(body.improvements) ? body.improvements : []).map((x) => clip(x, 260)).filter(Boolean).slice(0, 5);
      if (improvements.length === 0) return NextResponse.json({ fixes: [] });
      const fit = await measure(data, asTemplateId((body as { template?: unknown }).template), lang);
      const extra = names(body.extraSkills);
      const targets = names(body.targets);
      const proposed = await fixesFor(data, job, improvements, { skills: extra, facts: answers.map((a) => (a.note ? `${a.question} Yes. ${a.note}` : `${a.question} Yes.`)) }, lang, pageNote(fit), targets);
      // a fix is kept only if it does not really lower the score of the resume for this job (one point of rounding is allowed, so a
      // better written bullet is not thrown away for it)
      const template = asTemplateId((body as { template?: unknown }).template);
      let cur = data;
      const fixes: ReviewFix[] = [];
      for (const f of proposed) {
        const next = { ...cur, ...applyFixes(cur, [f]) } as ProfileData;
        if (jobScore(next, job, extra, template, targets).score >= jobScore(cur, job, extra, template, targets).score - 1) {
          fixes.push(f);
          cur = next;
        }
      }
      return NextResponse.json({ fixes });
    }
    if (body.action === "evaluate") {
      const answers = cleanAnswers(body.answers).filter((a) => a.yes);
      const lv = levelOf(job);
      const template = asTemplateId((body as { template?: unknown }).template);
      const confirmed = { skills: names(body.extraSkills), facts: answers.map((a) => (a.note ? `${a.question} Yes. ${a.note}` : `${a.question} Yes.`)) };
      const level = lv.label ? `${lv.label}${lv.years ? `, about ${lv.years} years` : ""}` : lv.years ? `about ${lv.years} years` : "not stated";
      const memory = cleanMemory(body.previous, data);
      // The page fit (how many pages, how small the text) follows from the resume and the look, so it needs no key of its own, and a
      // kept answer skips even the measuring. The memory is part of the key: what was already fixed changes what is worth saying.
      const { value, cached } = await cachedAi(
        "evaluate",
        uid,
        { v: EVALUATE_VERSION, job: sig, resume, confirmed, level, lang, template, memory: memory ?? null },
        async () => {
          const fit = await measure(data, template, lang);
          return evaluateDraft(data, job, confirmed, level, lang, pageNote(fit), memory);
        },
        (ev) => ev.headline.length > 0, // an empty answer is a failed call: it is never kept
        body.refresh === true // "Check again": a new reading on purpose
      );
      if (!value.headline) throw new HttpError(502, "The review could not be written this time."); // an empty answer is a failed call, not a blank panel
      return NextResponse.json(value, { headers: { "X-Cache": cached ? "hit" : "miss" } });
    }
    throw new HttpError(400, "Unknown action.");
  } catch (err) {
    // the AI answered with something that cannot be used: the page says so and offers to try again (it is not "nothing to say")
    if (err instanceof AiAnswerError) return errorResponse(new HttpError(502, "We couldn't get an answer this time. Try again in a moment."));
    return errorResponse(err, "We couldn't check your fit for this job.");
  }
}
