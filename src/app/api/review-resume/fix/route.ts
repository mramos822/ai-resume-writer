import { limitedShared } from "@/lib/rateLimit";
import { detectResumeLanguage } from "@/lib/resumeTranslate";
import { asResumeLang } from "@/lib/resumeLang";
import { NextResponse } from "next/server";
import { authUid, ownedProfile, errorResponse } from "@/lib/apiAuth";
import { getOpenAIChatCompletionWithFallback } from "@/lib/openaiClient";
import { AI_MODEL_STRONG } from "@/lib/aiConfig";
import { applyFixes, autoFixFor, cleanFix, profileForReview, type ReviewFix } from "@/lib/resumeReview";
import { autoPoints, criterionById, evaluateAuto, newestFirst } from "@/lib/reviewRubric";
import { isRelevantJob, targetRoleOf } from "@/lib/roleProfile";
import { loadRoleProfile, measure } from "@/lib/reviewServer";
import type { ProfileData } from "@/context/profileContext";

const FIX_SYSTEM = `You are an expert resume writer fixing ONE problem of a resume, for a US applicant tracking system (ATS) and recruiters. Write every new or rewritten text in the same language as the resume (if it is in Spanish, in neutral Spanish).
You receive the resume as JSON, the role profile (keywords, requirements, priorities), and the guideline that is not passing with its reason.
Reply with ONE JSON object and nothing else: { "fixes": [ <fix>, ... ] } where each fix is exactly one of:
  { "type": "objective", "text": "<3 to 5 sentences, 250 to 700 characters, no 'I'>" }
  { "type": "jobTitle", "text": "<target job title>" }
  { "type": "bullets", "jobId": "<id from the data>", "bullets": ["<rewritten or new bullets>"] }
  { "type": "addSkills", "skills": ["<skills>"] }
  { "type": "removeSkills", "skills": ["<skills exactly as in the data>"] }
Rules:
- Fix ONLY the given guideline, and do not make any other guideline worse.
- Use only facts present in the data. Never invent employers, dates, tools, degrees, metrics or numbers. If a bullet has no number, make the verb and the result clearer without adding one.
- Bullets: 25 to 170 characters, start with a strong past-tense verb (present tense for the current job), no first person. Provide the FULL replacement list for each job you touch.
- Jobs that have little to do with the target role only need 1 or 2 bullets; do not pad them. Recent jobs related to the role get 3 to 5.
- Skills are a PRIORITY. More skills and languages is better: never remove an important or in-demand skill because the resume does not mention it or to save space. Remove one ONLY if it is a repeat of another skill (like "JS" and "JavaScript"), very redundant, or clearly useless, and only when the list is very long (over 40). Adding skills is allowed only when the jobs, projects or studies show them.
- Plain language, no emojis, no markdown.`;

/** The text written for the resume goes in the language of the resume itself (the person's own words), whatever language the site is in. */
function languageRule(data: ProfileData, siteLang?: string): string {
  const lang = detectResumeLanguage(data) ?? asResumeLang(siteLang);
  return lang === "es"
    ? "\nLANGUAGE: the resume is in Spanish. Write every piece of text of your answer in neutral Latin American Spanish (use \"tú\"), keeping names, companies, products and JSON keys exactly as they are."
    : "\nLANGUAGE: write every piece of text of your answer in English, keeping names, companies, products and JSON keys exactly as they are.";
}

export async function POST(req: Request) {
  const tooMany = await limitedShared(req, "ai", 60, 10 * 60 * 1000);
  if (tooMany) return tooMany;
  try {
    const uid = await authUid(req);
    const body = (await req.json()) as { profileId?: string; template?: string; criterionId?: string; lang?: string };
    const profileId = String(body.profileId ?? "");
    const criterionId = String(body.criterionId ?? "");
    const template = typeof body.template === "string" && body.template ? body.template : "classic";
    const crit = criterionById(criterionId);
    if (!crit) return NextResponse.json({ error: "Unknown guideline" }, { status: 400 });

    const profile = await ownedProfile(uid, profileId);
    const data = { ...(profile.data as ProfileData), name: (profile.data as ProfileData)?.name || profile.name } as ProfileData;
    const role = await loadRoleProfile(targetRoleOf(data), undefined);
    const fit = await measure(data, template);
    const before = evaluateAuto(data, fit, template, role);
    const mine = before.find((c) => c.id === criterionId);

    // mechanical fixes need no AI
    const mech = autoFixFor(criterionId, data, role);
    if (mech) return NextResponse.json({ fixes: [mech] });

    const jobs = newestFirst(data.jobHistory ?? []).map((j, i) => ({ id: j.id, rank: i + 1, relatedToRole: isRelevantJob(data, j, role) }));
    const completion = await getOpenAIChatCompletionWithFallback({
      model: AI_MODEL_STRONG,
      temperature: 0,
      max_tokens: 5000,
      messages: [
        { role: "system", content: FIX_SYSTEM + languageRule(data, body.lang) },
        {
          role: "user",
          content: JSON.stringify({
            guideline: { id: crit.id, label: crit.label, definition: crit.guideline, whyItFails: mine?.reason ?? "" },
            targetRole: targetRoleOf(data),
            roleProfile: role ? { field: role.field, keywords: role.keywords, requirements: role.requirements, recruiterPriorities: role.priorities } : null,
            jobsNewestFirst: jobs,
            resume: profileForReview(data),
          }),
        },
      ],
    }, { timeout: 40_000, maxRetries: 0 }); // a slow AI must not leave the person waiting
    let raw: { fixes?: unknown[] } = {};
    try {
      raw = JSON.parse(completion.content);
    } catch {
      raw = {};
    }
    const fixes = (Array.isArray(raw.fixes) ? raw.fixes : []).map((f) => cleanFix(f, data)).filter((f): f is ReviewFix => f !== null).slice(0, 8);
    if (fixes.length === 0) return NextResponse.json({ error: "I couldn't write that fix. Try again in a moment." }, { status: 502 });

    // never offer a fix that makes the measurable score worse
    const patched: ProfileData = { ...data, ...applyFixes(data, fixes) };
    const after = evaluateAuto(patched, await measure(patched, template), template, role);
    if (autoPoints(after) < autoPoints(before) - 1e-9) {
      return NextResponse.json({ error: "That change would lower another part of your score, so I left it alone." }, { status: 409 });
    }
    return NextResponse.json({ fixes });
  } catch (err) {
    return errorResponse(err, "We couldn't write that fix.");
  }
}
