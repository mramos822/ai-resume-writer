import { limited } from "@/lib/rateLimit";
import { NextResponse } from "next/server";
import { authUid, ownedProfile, errorResponse, HttpError } from "@/lib/apiAuth";
import { bucket, db } from "@/lib/mongodb";
import { getOpenAIChatCompletion } from "@/lib/openaiClient";
import { AI_MODEL } from "@/lib/aiConfig";
import { renderResumeDetailed } from "@/lib/pdfResume";
import { cleanListing } from "@/lib/jobSearch";
import { profileForReview } from "@/lib/resumeReview";
import { mentionedSkills } from "@/lib/jobSkills";
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
  "coverLetter": "<a cover letter of 130 to 190 words: greeting, why this role and company, 2 concrete real strengths, a closing. Plain text, no placeholders>"
}
Rules:
- Use ONLY facts in the resume. Never invent employers, dates, tools, degrees, numbers or skills the person does not have.
- "skills": only skills that are already in the resume, copied exactly. {{SKILL_RULE}}
- "bullets": include only jobs whose bullets you improve to speak to this posting (use its keywords where they are TRUE for the person). Keep each bullet 25 to 170 characters, start with a strong verb, keep any number that exists, add none.
- The cover letter must not claim anything that is not in the resume.
- Plain language, no emojis, no markdown.`;

const SKILL_ALL = "Skills are a priority: keep nearly all of them.";
const SKILL_RELEVANT = "Choose ONLY the skills that help for THIS job: the ones the posting names or clearly needs, and closely related ones (a framework with its language, a tool of the same kind). Drop skills that have nothing to do with this role. Order them from most to least useful for the job. Keep between 6 and 16.";
const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const sanitize = (x: string) => (x || "").replace(/[^a-z0-9\-_]+/gi, "_").replace(/^_+|_+$/g, "");

export async function POST(req: Request) {
  const tooMany = limited(req, "ai", 40, 10 * 60 * 1000);
  if (tooMany) return tooMany;
  try {
    const uid = await authUid(req);
    const body = (await req.json().catch(() => ({}))) as { profileId?: string; template?: string; job?: unknown; skillMode?: string; extraSkills?: unknown };
    const job = cleanListing(body.job as never);
    if (!job) throw new HttpError(400, "That job could not be read.");
    const template = body.template === "modern" || body.template === "creative" ? body.template : "classic";
    const profile = await ownedProfile(uid, String(body.profileId ?? ""));
    const base = {
      ...(profile.data as ProfileData),
      name: (profile.data as ProfileData)?.name || (/^Profile \d+$/.test(profile.name) ? "John Doe" : profile.name),
    } as ProfileData;

    // what the person chose about skills: keep all of them or only the ones that fit this job, and extra skills they confirmed
    // they really have (the posting asks for them). Extras are never added unless the person ticked them.
    const relevantOnly = body.skillMode === "relevant";
    const extraSkills = Array.from(new Set((Array.isArray(body.extraSkills) ? body.extraSkills : []).map((x) => str(x, 60)).filter(Boolean))).slice(0, 12);

    // 1) the AI tailors the resume and writes the letter
    const posting = [`Title: ${job.title}`, `Company: ${job.company}`, job.location ? `Location: ${job.location}` : "", job.tags.length ? `Tags: ${job.tags.join(", ")}` : "", `Description: ${job.description || job.snippet}`]
      .filter(Boolean)
      .join("\n");
    const completion = await getOpenAIChatCompletion({
      model: AI_MODEL,
      temperature: 0.3,
      max_tokens: 2800,
      messages: [
        { role: "system", content: SYSTEM.replace("{{SKILL_RULE}}", relevantOnly ? SKILL_RELEVANT : SKILL_ALL) },
        { role: "user", content: JSON.stringify({ resume: profileForReview(base), jobPosting: posting }) },
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
    const objective = str(raw.careerObjective, 800);
    if (objective.length >= 120) tailored.careerObjective = objective;
    const title = str(raw.jobTitle, 80);
    if (title) tailored.jobTitle = title;
    const have = new Map((base.skills ?? []).map((s) => [s.toLowerCase(), s]));
    const order = (Array.isArray(raw.skills) ? raw.skills : []).map((s) => have.get(str(s, 60).toLowerCase())).filter((s): s is string => Boolean(s));
    const ordered = Array.from(new Set(order));
    const mine = base.skills ?? [];
    if (relevantOnly) {
      // smart filter: what the AI judged useful, plus every skill the posting literally names (so a keyword is never lost),
      // most useful first; if that leaves too few, the rest of the person's skills fill in up to 6
      const postingText = `${job.title}. ${job.tags.join(", ")}. ${job.description || job.snippet}`;
      const named = mentionedSkills(postingText).map((x) => have.get(x.toLowerCase())).filter((x): x is string => Boolean(x));
      let picked = Array.from(new Set([...named, ...ordered])).slice(0, 16);
      if (picked.length < 6) picked = [...picked, ...mine.filter((x) => !picked.includes(x))].slice(0, 6);
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
    const bulletsById = (raw.bullets && typeof raw.bullets === "object" ? raw.bullets : {}) as Record<string, unknown>;
    tailored.jobHistory = (base.jobHistory ?? []).map((j) => {
      const b = (Array.isArray(bulletsById[j.id]) ? (bulletsById[j.id] as unknown[]) : [])
        .map((x) => str(x, 200))
        .filter((x) => x.length >= 20)
        .slice(0, 5);
      return b.length >= 2 ? { ...j, description: "", accomplishments: b } : j;
    });
    const coverLetter = str(raw.coverLetter, 2500);

    // 3) the tailored resume becomes a PDF kept with the person's other resumes
    const { buffer } = await renderResumeDetailed(tailored, template);
    const filename = `${sanitize(base.name || "resume")}_${sanitize(job.company) || "company"}_${sanitize(job.title).slice(0, 40)}.pdf`;
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
    const previous = await col.findOne<{ fileId?: string }>({ userId: uid, "job.key": job.key });
    await col.updateOne(
      { userId: uid, "job.key": job.key },
      { $set: { userId: uid, job, fileId, coverLetter, template, updatedAt: new Date() }, $setOnInsert: { status: "prepared", createdAt: new Date() } },
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
