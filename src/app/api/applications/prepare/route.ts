import { fromShouting } from "@/lib/nameCase";
import { namesEmployer, withoutEmployer } from "@/lib/employerMention";
import { langRule, resumeLangForJob } from "@/lib/resumeLang";
import { applyTexts, detectResumeLanguage, translatableTexts } from "@/lib/resumeTranslate";
import { translateTexts } from "@/lib/translateTexts";
import { asLevel, LEVEL_LABEL } from "@/lib/experienceLevel";
import { limitedShared } from "@/lib/rateLimit";
import { asTemplateId } from "@/lib/templates";
import { NextResponse } from "next/server";
import { authUid, ownedProfile, errorResponse, HttpError } from "@/lib/apiAuth";
import { bucket, db } from "@/lib/mongodb";
import { getOpenAIChatCompletionWithFallback } from "@/lib/openaiClient";
import { AI_MODEL_STRONG } from "@/lib/aiConfig";
import { renderResumeDetailed, maxPagesFor } from "@/lib/pdfResume";
import { trimToFit } from "@/lib/pageTrim";
import { cleanListing, isPartialPosting, sharesFirstLinesOnly } from "@/lib/jobSearch";
import { wholeJob } from "@/lib/jobEnrich";
import { profileForReview } from "@/lib/resumeReview";
import { cleanAnswers, withDraft } from "@/lib/applicationCoach";
import { evaluateAuto, newestFirst } from "@/lib/reviewRubric";
import { mentionedSkills, simplifyForPosting } from "@/lib/jobSkills";
import { faithfulBullets } from "@/lib/bulletFidelity";
import type { ProfileData } from "@/context/profileContext";

// "Prepare application": for one job, Kaizo writes a resume tailored to it (with the facts already in the profile) and a
// short cover letter, and keeps both together with the job so the person can apply and track it.

const SYSTEM = `You tailor a resume to ONE job posting for a US applicant tracking system (ATS) and recruiters.
You receive the person's resume as JSON and the job posting. Reply with ONE JSON object and nothing else:
{
  "jobTitle": "<the title the resume should show: the person's real target role, worded like the posting when it is the same role>",
  "careerObjective": "<3 to 5 sentences, 250 to 700 characters, no 'I', written for THIS job: who they are, strongest real experience and skills, what they bring>",
  "skills": ["<skills from the resume, reordered so the ones the job asks for come first; you may drop at most 3 clearly irrelevant ones>"],
  "bullets": { "<jobId>": ["<3 to 5 bullets>"] },
  "coverLetter": "<a cover letter of 130 to 190 words: greeting, why this role and company, 2 concrete real strengths, a closing, and the person's name on its own last line after a sign-off (\"Sincerely,\" or the same in the language of the letter). Plain text, no placeholders>"
}
Rules:
- Use ONLY facts in the resume. Never invent employers, dates, tools, degrees, numbers or skills the person does not have.
- "skills": only skills that are already in the resume, copied exactly. {{SKILL_RULE}}
- "bullets": include only jobs whose bullets you improve to speak to this posting (use its keywords where they are TRUE for the person). Keep each bullet 25 to 170 characters, start with a strong verb, keep any number that exists, add none.
- "confirmed" (when present) lists facts the person confirmed are TRUE for them even though the resume does not show them. You may use them in the career objective and the cover letter, and in a bullet only when it clearly belongs to that job. Never turn them into numbers or employers.
- "focus" (when present) lists what a recruiter review asked this resume to do for this job. Follow each item only as far as the facts allow.
- When the data shows what a bullet achieved and by how much, write it as "achieved X, measured by Y, by doing Z" (the XYZ formula) without inventing the measure.
- "level" (when present) is the level the person confirmed and wants stated: say it naturally in the career objective (for example "{level} full stack developer…"). When "level" is absent, do NOT use words like junior, senior, entry-level or mid-level to describe the person anywhere, unless the resume itself says so.
- The cover letter must not claim anything that is not in the resume or in "confirmed". Do not open it with a stock line ("I am excited to apply", "I am writing to express my interest"): start with the strongest real fit for this role. It always ends with the sign-off and the person's name.
- Never name the company the person is applying to, nor the posting, in the career objective or in the bullets: the resume is written for a kind of role, not for one employer, so it works for any similar job. Only the cover letter names the company.
- Plain language, no emojis, no markdown.`;

// What every resume of Kaizo must satisfy, whatever the job: the guidelines of the general review. What the job asks for weighs
// most, but none of these is given up for it: the resume must pass any ATS filter and any recruiter's first scan.
const GLOBAL_CRITERIA = `
GLOBAL CRITERIA (they ALWAYS hold, together with the job's requirements; the job's requirements weigh the most, but never at the cost of these):
- ATS: plain wording, standard terms written the way ATS expect (for example "PostgreSQL", not "Postgres DB"), no abbreviations only insiders know, no first person, no emojis. Use the posting's own keywords wherever they are TRUE for the person.
- Career objective: a short narrative of 3 to 5 sentences, between 250 and 700 characters, tied to the target role; never a one-liner.
- Bullets: for each of the 3 most recent jobs, 3 to 5 bullets of 25 to 170 characters. Start every bullet with a strong action verb (never "Responsible for", "Helped with", "Worked on", "Duties included", "In charge of", "Tasked with"). Keep every number that exists and add none. Where the data shows what was achieved, how much and how, use the XYZ form.
- Tense: the current job in the present, past jobs in the past, consistently.
- Skills: they are a priority; keep at least 8 when the person has them, never drop an important or in-demand one, and drop only repeats.
- Keep the 3 most recent jobs, newest first, with their dates. Never invent anything.
{{PAGE_RULE}}`;

const SKILL_ALL = "Skills are a priority: keep nearly all of them.";
const SKILL_RELEVANT = "Choose ONLY the skills that help for THIS job: the ones the posting names or clearly needs, and closely related ones (a framework with its language, a tool of the same kind). Drop only the skills that clearly have nothing to do with this role: when in doubt, keep the skill, because every skill is potential for the candidate. Order them from most to least useful for the job. Keep at least 20 when the person has that many (all of them if they have fewer).";
const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const sanitize = (x: string) => (x || "").replace(/[^a-z0-9\-_]+/gi, "_").replace(/^_+|_+$/g, "");

export async function POST(req: Request) {
  const tooMany = await limitedShared(req, "ai", 60, 10 * 60 * 1000);
  if (tooMany) return tooMany;
  try {
    const uid = await authUid(req);
    const body = (await req.json().catch(() => ({}))) as { profileId?: string; template?: string; job?: unknown; skillMode?: string; extraSkills?: unknown; lang?: unknown; answers?: unknown; focus?: unknown; truthful?: unknown; draft?: unknown; level?: unknown; mentionLevel?: unknown };
    const listed = cleanListing(body.job as never);
    if (!listed) throw new HttpError(400, "That job could not be read.");
    const job = await wholeJob(listed); // the resume is never written from half a posting
    const template = asTemplateId(body.template);
    const profile = await ownedProfile(uid, String(body.profileId ?? ""));
    // the resume starts from the profile plus the edits the person made for this job (the saved profile is not changed)
    const edited = withDraft(profile.data as ProfileData, body.draft);
    const base = {
      ...edited,
      name: edited?.name || (/^Profile \d+$/.test(profile.name) ? "John Doe" : profile.name),
    } as ProfileData;

    // what the person chose about skills: keep all of them or only the ones that fit this job, and extra skills they confirmed
    // they really have (the posting asks for them). Extras are never added unless the person ticked them.
    const relevantOnly = body.skillMode === "relevant";
    // the resume and the letter are written in the language of the job posting; if that is not clear, in the one of its country, else the language of the app
    const lang = resumeLangForJob(job, body.lang);
    const extraSkills = Array.from(new Set((Array.isArray(body.extraSkills) ? body.extraSkills : []).map((x) => str(x, 60)).filter(Boolean))).slice(0, 12);

    // what the person answered "yes" to in the questions before this step, and what the review of the draft asked for
    const confirmed = cleanAnswers(body.answers).filter((a) => a.yes).map((a) => (a.note ? `${a.question} Yes. ${a.note}` : `${a.question} Yes.`));
    // what the person confirmed goes into the resume as fact: they must have declared it is true (and we keep when they did)
    if ((extraSkills.length > 0 || confirmed.length > 0) && body.truthful !== true) throw new HttpError(400, "Please confirm that what you added is true before the resume is made.");
    const focus = (Array.isArray(body.focus) ? body.focus : []).map((x) => str(x, 260)).filter(Boolean).slice(0, 5);

    // the level goes into the resume only when the person asked for it
    const lv = asLevel(body.level);
    const statedLevel = lv && body.mentionLevel === true ? LEVEL_LABEL[lv] : "";

    // 1) the AI tailors the resume and writes the letter
    const posting = [`Title: ${job.title}`, `Company: ${job.company}`, job.location ? `Location: ${job.location}` : "", job.tags.length ? `Tags: ${job.tags.join(", ")}` : "", `Description: ${job.description || job.snippet}`, sharesFirstLinesOnly(job) && isPartialPosting(job) ? "Note: only the first lines of this posting are available. Use only what is written here: do not assume or invent other requirements, tools or duties." : ""]
      .filter(Boolean)
      .join("\n");
    const pageRule = maxPagesFor(base, template) > 1
      ? base.pageGoal === "any"
        ? "- Aim for ONE page: tight, specific bullets, no filler. Only if the recent jobs hold a lot of strong, relevant material may it run to TWO pages."
        : "- The person accepts up to TWO pages: keep every real achievement of the recent jobs, but still tight, specific bullets and no filler."
      : "- Everything must fit on ONE page: tight, specific bullets, no filler.";
    const system = SYSTEM.replace("{{PAGE_RULE}}", pageRule).replace("{{SKILL_RULE}}", relevantOnly ? SKILL_RELEVANT : SKILL_ALL) + GLOBAL_CRITERIA + langRule(lang, "the career objective, the bullet points and the cover letter", true);
    const userMessage = JSON.stringify({ resume: profileForReview(base), jobPosting: posting, ...(statedLevel ? { level: statedLevel } : {}), ...(confirmed.length ? { confirmed } : {}), ...(focus.length ? { focus } : {}) });
    const postingText = `${job.title}. ${job.tags.join(", ")}. ${job.description || job.snippet}`;

    const tailor = async (fix?: { previous: string; problems: string[] }) => {
      const completion = await getOpenAIChatCompletionWithFallback({
        model: AI_MODEL_STRONG,
        temperature: 0.3,
        max_tokens: 6000,
        messages: [
          { role: "system", content: system },
          { role: "user", content: userMessage },
          ...(fix
            ? [
                { role: "assistant" as const, content: fix.previous },
                { role: "user" as const, content: `Your answer does not meet the global criteria. Fix exactly this and answer again with the same JSON, keeping everything else:\n- ${fix.problems.join("\n- ")}` },
              ]
            : []),
        ],
      });
      let raw: Record<string, unknown> = {};
      try {
        raw = JSON.parse(completion.content);
      } catch {
        raw = {};
      }

      // 2) only valid changes are applied to a COPY of the profile (the saved profile is never touched)
      const tailored: ProfileData = { ...base };
      // (the company is not named: a sentence that does is taken out, and a resume written for one employer is not kept)
      const objective = withoutEmployer(str(raw.careerObjective, 800), job.company);
      if (objective.length >= 120) tailored.careerObjective = objective;
      const title = str(raw.jobTitle, 80);
      if (title) tailored.jobTitle = title;
      const have = new Map((base.skills ?? []).map((s) => [s.toLowerCase(), s]));
      const order = (Array.isArray(raw.skills) ? raw.skills : []).map((s) => have.get(str(s, 60).toLowerCase())).filter((s): s is string => Boolean(s));
      const ordered = Array.from(new Set(order));
      const mine = base.skills ?? [];
      if (relevantOnly) {
        // smart filter: what the AI judged useful, plus every skill the posting literally names (so a keyword is never lost),
        // most useful first; if that leaves fewer than 20, the rest of the person's skills fill in up to 20 (a candidate is never cut down to a few)
        const named = mentionedSkills(postingText).map((x) => have.get(x.toLowerCase())).filter((x): x is string => Boolean(x));
        let picked = Array.from(new Set([...named, ...ordered])).slice(0, 30);
        if (picked.length < 20) picked = [...picked, ...mine.filter((x) => !picked.includes(x))].slice(0, 20);
        tailored.skills = picked;
      } else {
        // the AI's order first, then any skill it left out: skills are a priority, so none of them disappears
        const rest = mine.filter((x) => !ordered.includes(x));
        if (ordered.length > 0) tailored.skills = [...ordered, ...rest];
      }
      // skills the person confirmed: they go right after the ones the job names
      if (extraSkills.length > 0) {
        const now = tailored.skills ?? mine;
        const fresh = extraSkills.filter((x) => !now.some((y) => y.toLowerCase() === x.toLowerCase()));
        tailored.skills = [...now.slice(0, Math.min(now.length, 8)), ...fresh, ...now.slice(8)];
      }
      // the skills are written the way the posting asks for them ("GitHub Actions" shows as "GitHub" for a job that asks for GitHub)
      if (tailored.skills?.length) tailored.skills = simplifyForPosting(tailored.skills, postingText);
      const bulletsById = (raw.bullets && typeof raw.bullets === "object" ? raw.bullets : {}) as Record<string, unknown>;
      tailored.jobHistory = newestFirst(
        (base.jobHistory ?? []).map((j) => {
          const b = (Array.isArray(bulletsById[j.id]) ? (bulletsById[j.id] as unknown[]) : [])
            .map((x) => str(x, 200))
            .filter((x) => x.length >= 20 && !namesEmployer(x, job.company))
            .slice(0, 5);
          if (b.length < 2) return j;
          // a rewritten bullet that adds a tool or a number the job never showed is put back as the person wrote it
          const checked = faithfulBullets(j, b, [...extraSkills, ...confirmed].join(" "));
          return checked.bullets.length >= 2 ? { ...j, description: "", accomplishments: checked.bullets } : j;
        })
      );
      return { tailored, coverLetter: str(raw.coverLetter, 2500), text: completion.content };
    };

    // the general review of Kaizo, measured by code on what was written: if the objective or the bullets break its guidelines,
    // the AI is asked once to fix exactly that
    const MEASURED = ["summaryLength", "bulletLength", "strongVerbs"]; // what the AI writes (the number of bullets depends on what the person has listed)
    let made = await tailor();
    const problems = evaluateAuto(made.tailored, null, template)
      .filter((c) => MEASURED.includes(c.id) && c.verdict !== "pass")
      .map((c) => `${c.label}: ${c.reason}`);
    if (problems.length > 0) {
      try {
        made = await tailor({ previous: made.text, problems });
      } catch {
        /* the first version is still good: it is kept */
      }
    }
    const { coverLetter } = made;
    // The resume of THIS job is in the language of the job: whatever the AI left in the person's language (titles, skills, degrees) is translated
    // here, in this copy only. The saved profile is not touched. If the translation fails, the resume goes out as it was.
    let tailored = made.tailored;
    // (it is the language of the person's own resume that tells: the AI has already written the objective and the bullets in the job's language,
    // so the tailored copy looks like it is in it while the titles, the skills and the studies are still in the other one)
    const writtenIn = detectResumeLanguage(base) ?? detectResumeLanguage(tailored);
    if (writtenIn && writtenIn !== lang) {
      try {
        tailored = applyTexts(tailored, await translateTexts(translatableTexts(tailored), lang)) as typeof tailored;
      } catch {
        /* kept as it was */
      }
    }

    // 3) the tailored resume becomes a PDF kept with the person's other resumes
    // the page filter of a recruiter always has to be passed: if it does not fit on one page at a readable size, the least useful for
    // this job is taken out of THIS resume (never from the saved profile) until it does
    const fitted = await trimToFit(tailored, job, template, lang, extraSkills);
    const { buffer } = await renderResumeDetailed(fitted.profile, template, { lang });
    const filename = `${sanitize(fromShouting(base.name || "resume"))}_${sanitize(job.company) || "company"}_${sanitize(job.title).slice(0, 40)}.pdf`;
    const upload = bucket.openUploadStream(filename, {
      metadata: {
        profileId: String(body.profileId),
        template,
        format: "pdf",
        createdAt: new Date(),
        isGenerated: true,
        origin: "application",
        jobKey: job.key,
        jobTitle: job.title,
        companyName: job.company,
      },
    });
    upload.end(buffer);
    const fileId = await new Promise<string>((resolve, reject) => {
      upload.on("finish", () => (upload.id ? resolve(upload.id.toString()) : reject(new Error("No file id"))));
      upload.on("error", reject);
    });

    // 4) the application is recorded (one per job: preparing it again replaces the earlier resume)
    const col = db.collection("applications");
    const profileId = String(body.profileId);
    const previous = await col.findOne<{ fileId?: string }>({ userId: uid, profileId, "job.key": job.key });
    await col.updateOne(
      { userId: uid, profileId, "job.key": job.key },
      { $set: { userId: uid, profileId, job, fileId, coverLetter, template, updatedAt: new Date(), ...(extraSkills.length > 0 || confirmed.length > 0 ? { truthDeclaredAt: new Date(), confirmedSkills: extraSkills, confirmedFacts: confirmed } : { truthDeclaredAt: null, confirmedSkills: [], confirmedFacts: [] }) }, $setOnInsert: { status: "prepared", createdAt: new Date() } },
      { upsert: true }
    );
    if (previous?.fileId && previous.fileId !== fileId) {
      try {
        const { ObjectId } = await import("mongodb");
        await bucket.delete(new ObjectId(previous.fileId));
      } catch {
        /* the old file may already be gone */
      }
    }

    return NextResponse.json({ fileId, coverLetter, job });
  } catch (err) {
    return errorResponse(err, "We couldn't prepare that application.");
  }
}
