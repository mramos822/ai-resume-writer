// Turns a resume + the AI's judgement into a ReviewResult that always follows the fixed rubric (reviewRubric.ts).
// The AI only supplies verdicts for the qualitative guidelines and proposed fixes; scoring, ordering and the
// check that a fix does not make anything worse all happen here, in code.
import type { ProfileData } from "@/context/profileContext";
import {
  AI_CRITERIA,
  CRITERIA,
  aiResults,
  autoPoints,
  evaluateAuto,
  rubricForPrompt,
  scoreOf,
  seniorityOf,
  type CriterionResult,
  type PageFit,
  type Verdict,
} from "@/lib/reviewRubric";
import type { RoleProfile } from "@/lib/roleProfile";
import { layoutFacts } from "@/lib/layoutFacts";
import {
  AUTO_ADVICE,
  applyFixes,
  autoFixFor,
  cleanFix,
  impactOf,
  profileForReview,
  type ReviewFix,
  type ReviewIssue,
  type ReviewResult,
  twoPagesAlt,
  worthListing,
  MAX_ISSUES,
} from "@/lib/resumeReview";

/** Bump when the rubric changes, so cached reviews are not reused. */
export const RUBRIC_VERSION = "v6";

export interface PreviousReview {
  verdicts: { id: string; verdict: Verdict }[];
  /** titles of the fixes the person applied since that review */
  applied: string[];
  /** guidelines those fixes were for: they are not raised again just because the AI still would like it "better" */
  appliedCriteria?: string[];
}

export const REVIEW_SYSTEM = `You are a resume reviewer who follows a FIXED rubric. You never invent criteria, and you judge the same text the same way every time.
The rubric encodes what the main applicant tracking systems (ATS) need to read a resume and what HR and recruiters check first. Your priority is that this resume passes both.

You receive: the resume data as JSON, the person's TARGET ROLE and seniority, the LAYOUT facts (look, length chosen, pages used, size of the text), the results of the measurable guidelines (already computed by code, do not re-judge them), and, when this is a re-check, your previous verdicts and what the person changed since.

Reply with ONE JSON object and nothing else:
{
  "headline": one friendly sentence summing up the resume,
  "strengths": up to 3 short strings about what already works,
  "qualitative": [ { "id": "<id>", "verdict": "pass" | "partial" | "fail", "reason": "<one short sentence>" } ],
  "fixes": [ { "criterionId": "<id of a guideline that is NOT passing>", "title": "<max 8 words>", "detail": "<one or two friendly sentences>", "fix": <fix or null> } ]
}

"qualitative" has exactly one entry for EACH of these guidelines, judged only with these exact definitions:
{{RUBRIC}}

A "fix" is exactly one of:
  { "type": "objective", "text": "<2 sentences, no 'I'>" }
  { "type": "jobTitle", "text": "<target job title>" }
  { "type": "bullets", "jobId": "<id from the data>", "bullets": ["<3 to 5 rewritten bullets>"] }
  { "type": "addSkills", "skills": ["<up to 6 skills>"] }
  { "type": "removeJob", "jobId": "<id from the data>" }
  { "type": "removeSkills", "skills": ["<skills exactly as written in the data>"] }

Rules, in order of importance:
1. Judge against the ROLE PROFILE you are given: it is the professional rubric for this role (its keywords, requirements, recruiter priorities and the kind of evidence that impresses). It defines what "relevant" means. When its "kind" is "general", the resume is a general resume for the role, not for one company: do not ask for company-specific details. When it is "job", judge against that one posting.
2. Be consistent. Apply the definitions literally: if the text satisfies a definition it MUST be "pass", even if it could still be better. Do not look for problems outside the guidelines and do not ask for perfection.
3. Re-checks: if the person applied a fix for a guideline you had marked "partial" or "fail", judge it again on the CURRENT text; if it now meets the definition, mark "pass". Never change a verdict when the text did not change.
4. "fixes" only for guidelines that are NOT passing (measurable ones are listed in "measurable" with their verdict). At most one fix per guideline, except "bullets" (one per job). Each fix must make its own guideline pass without breaking another one: keep bullets between 25 and 170 characters, start them with a strong verb, never drop a number that exists, keep 3 to 5 bullets for recent jobs, keep the summary between 250 and 700 characters and keep the skills (never shorten the skills list to make room).
5. Use ONLY facts that are in the data. Never invent employers, dates, tools, degrees, metrics or numbers. If a bullet has no number, improve verb and clarity but do not add one.
6. Experience: the 3 most recent jobs must stay on the resume. NEVER propose removing any of them, and never propose removing a job when 3 or fewer remain. Only older, clearly less relevant jobs can be removed, and only when "onePage" is not passing.
7. The profile (careerObjective) is the person's cover letter: a short narrative of 3 to 5 sentences (250 to 700 characters), never a one-liner. When you rewrite it, keep it in that range, name the target role or field, include their strongest real experience and skills, and say what they bring. Do not make it shorter than the original unless the original is over 700 characters.
8. Skills must be consistent with the rest of the resume: only add skills clearly shown by the person's jobs, projects, education or coursework, and treat skills as a PRIORITY: never remove a skill just because the resume does not mention it or to save space. Important and in-demand skills and languages (programming languages, frameworks, tools, spoken languages) are NEVER removed, and it is never an issue that no job or project shows them: more skills is better. Remove a skill ONLY when it is a repeat of another one (like "JS" and "JavaScript"), very redundant, or clearly useless for any job (for example a joke or an empty word). Suggest removing redundant skills only when the list is very long (over 40); then say in "detail" that the list is long and which ones are redundant. Prefer adding the missing evidence (a bullet that uses the skill) over deleting the skill. For keyword coverage, use the standard terms of the target role, written the way ATS expect (for example "PostgreSQL", not "Postgres DB").
9. ATS and HR: plain wording, standard terms, no first person, consistent tense (current job in present, past jobs in past), no abbreviations that only insiders know.
10. If "onePage" is not passing (more pages than layout.pagesAllowed, or the text smaller than 85%), the fix must remove content: "removeJob" for the oldest or least relevant job (never the most recent one), or a shorter "bullets" rewrite. NEVER remove skills for space. If it is passing, do NOT suggest removing content, even when the resume has two pages: the person chose that.
11. EVERY issue should come with a usable "fix" (the person presses "Fix it for me"): rewrite the bullets, the summary, the skills. Only set "fix" to null when the guideline needs a fact only the person knows (a phone number, an address, a job they never listed); then say exactly what to add in "detail". Never invent employers, dates, degrees or numbers: when a bullet needs a metric you do not have, rewrite it stronger without a made-up number.
12. Plain language, no emojis, no markdown.
14. The target role is what the person is AIMING for. A student (a degree in progress) with a side job that has nothing to do with their field (waiter, cashier, delivery...) is NOT aiming for that job: judge them against the field they study, as an entry-level or student candidate, treat the side job only as evidence of reliability and customer service, and never propose a job title or a summary that presents them as that side job.
15. FORMAT, LENGTH AND ROLE: your opinion must come from THIS person's look, length and target role, never from generic resume advice. "layout" tells you the look ("family": ats-safe, one-column, two-column or form), whether it has a photo or skill ratings, the length the person chose ("lengthChoice": one, two, or kaizo = Kaizo decides), the pages used and how full the last page is.
   - ATS-safe look (family "ats-safe"): do not warn about parsing; spend the advice on keywords, bullets and proof.
   - Designed look (any other family): the code already handles the layout guideline. You advise on CONTENT so an ATS still reads it: the target role's keywords, the contact data and the skills must also appear as plain text in the summary, the skills and the bullets, never only inside a graphic, a rating or a column. Do not suggest changing the look.
   - Length: judge the content for the length the person chose and for the role's norm. Under about 5 years of experience: tight and one page; 10 years or more, or a field that uses long CVs (research, academia, medicine, law, senior engineering and management): two pages are normal, as long as the second page carries real, recent, relevant material. If "pagesNow" is 2 and "lastPageFill" is under 0.3, say the second page is nearly empty and the content should be tightened to one page or strengthened. If the person chose two pages or Kaizo decides, NEVER ask to cut just to reach one page. Never ask to pad a resume with filler.
   - Role: every "title" and "detail" must be specific to the target role and its field, built from the roleProfile (keywords, requirements, recruiterPriorities, strongEvidence). Two different roles must get different advice: a software engineer is asked for stack, scale and latency or cost numbers; a nurse for licenses, units and patient ratios; a salesperson for quota, revenue and pipeline; a teacher for grade levels, outcomes and certifications; a designer for portfolio, tools and shipped work; a finance analyst for models, certifications and amounts managed. Name the role or its field in the headline.
13. The person chose their look (template) on purpose. Respect it: improve the content (summary, bullets, skills, order, length) so the resume works well in THAT look. Never suggest changing the look or removing the photo in your issues or fixes; the layout guideline is handled separately and always comes last.`;

export function reviewSystemPrompt(): string {
  return REVIEW_SYSTEM.replace("{{RUBRIC}}", rubricForPrompt());
}

export interface ReviewContext {
  template: string;
  fit: PageFit | null;
  previous?: PreviousReview;
  /** the professional rubric of the target role (or of one job posting), when available */
  role?: RoleProfile | null;
}

/** Everything the AI is told about the person and the resume. */
export function reviewPayload(p: ProfileData, ctx: ReviewContext, auto: CriterionResult[]) {
  const s = seniorityOf(p);
  return {
    targetRole: ctx.role?.role || p.jobTitle?.trim() || "",
    roleProfile: ctx.role
      ? {
          kind: ctx.role.source === "job-ad" ? "job" : "general",
          field: ctx.role.field,
          keywords: ctx.role.keywords,
          requirements: ctx.role.requirements,
          recruiterPriorities: ctx.role.priorities,
          strongEvidence: ctx.role.evidence,
        }
      : null,
    seniority: { yearsOfExperience: s.years, level: s.level },
    layout: layoutFacts(p, ctx.template, ctx.fit),
    measurable: auto.map((c) => ({ id: c.id, verdict: c.verdict, reason: c.reason })),
    previous: ctx.previous,
    resume: profileForReview(p),
  };
}

const VERDICTS = new Set(["pass", "partial", "fail"]);
const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/**
 * Builds the final review from the AI's raw answer. Returns null when the answer is unusable.
 * `measureFit` re-measures the page for a patched resume (used only for fixes that change how much content there is).
 */
export async function interpretAi(
  input: unknown,
  p: ProfileData,
  ctx: ReviewContext,
  measureFit?: (patched: ProfileData) => Promise<PageFit | null>
): Promise<ReviewResult | null> {
  if (!input || typeof input !== "object") return null;
  const raw = input as Record<string, unknown>;

  const verdicts = (Array.isArray(raw.qualitative) ? raw.qualitative : [])
    .map((q): { id: string; verdict: Verdict; reason: string } | null => {
      const r = (q ?? {}) as Record<string, unknown>;
      const id = str(r.id, 40);
      if (!AI_CRITERIA.some((c) => c.id === id) || !VERDICTS.has(String(r.verdict))) return null;
      return { id, verdict: r.verdict as Verdict, reason: str(r.reason, 180) };
    })
    .filter((x): x is { id: string; verdict: Verdict; reason: string } => Boolean(x));
  if (verdicts.length === 0) return null;

  // The AI can word a verdict differently from one review to the next, which made the score jump (95 to 91) for a resume that got
  // better. So the judgements are kept steady between two reviews of the same resume:
  //  - something the person had fixed for them counts as done (the fix was checked against the same rubric before it was offered);
  //  - a guideline never gets worse than it was last time just because the AI phrased it differently. It can only go up.
  // (a measurable guideline is judged by code, so it is never touched here: it moves only when the resume really changes)
  const fixedBefore = new Set(ctx.previous?.appliedCriteria ?? []);
  const before = new Map((ctx.previous?.verdicts ?? []).map((x) => [x.id, x.verdict] as const));
  const rank: Record<Verdict, number> = { fail: 0, partial: 1, pass: 2 };
  for (const v of verdicts) {
    if (fixedBefore.has(v.id) && v.verdict !== "pass") {
      v.verdict = "pass";
      v.reason = "You fixed this earlier.";
      continue;
    }
    const was = before.get(v.id);
    if (was && rank[was] > rank[v.verdict]) {
      v.verdict = was;
      v.reason = "Same as in your last review.";
    }
  }

  const auto = evaluateAuto(p, ctx.fit, ctx.template, ctx.role);
  const criteria = [...auto, ...aiResults(verdicts)];
  const failing = new Map(criteria.filter((c) => c.verdict !== "pass").map((c) => [c.id, c]));
  const autoBefore = autoPoints(auto);

  // 1) the AI's proposed fixes, each checked against the same rubric before it is offered
  const proposed = (Array.isArray(raw.fixes) ? raw.fixes : []).slice(0, 12);
  const issues: ReviewIssue[] = [];
  const covered = new Set<string>();
  for (const item of proposed) {
    const f = (item ?? {}) as Record<string, unknown>;
    const criterionId = str(f.criterionId, 40);
    const crit = failing.get(criterionId);
    if (!crit) continue; // nothing to fix there: a passing guideline is never "improved"
    const title = str(f.title, 90) || AUTO_ADVICE[criterionId]?.title || crit.label;
    const detail = str(f.detail, 280) || crit.reason;

    let fix: ReviewFix | null = cleanFix(f.fix, p) ?? autoFixFor(criterionId, p, ctx.role);
    if (fix) {
      const patched: ProfileData = { ...p, ...applyFixes(p, [fix]) };
      const needsFit = fix.type === "removeJob" || fix.type === "removeJobs" || fix.type === "atsClean" || fix.type === "removeSkills" || fix.type === "bullets" || fix.type === "addSkills";
      const fitAfter = needsFit && measureFit ? await measureFit(patched) : ctx.fit;
      const after = evaluateAuto(patched, fitAfter, ctx.template, ctx.role);
      const regressed = autoPoints(after) < autoBefore - 1e-9;
      const targetAfter = after.find((c) => c.id === criterionId);
      const stillFailsMeasurable = crit.kind === "auto" && targetAfter !== undefined && targetAfter.earned <= crit.earned + 1e-9;
      if (regressed || stillFailsMeasurable) fix = null; // would make something worse, or would not even fix its own guideline
    }
    issues.push({ id: `a${issues.length + 1}`, criterionId, title, detail, impact: impactOf(crit.weight), fix, alt: twoPagesAlt(criterionId, p, ctx.template) });
    covered.add(criterionId);
  }

  // 2) every other failing guideline still gets an entry, in the rubric's own words
  for (const crit of failing.values()) {
    if (covered.has(crit.id)) continue;
    const advice = AUTO_ADVICE[crit.id];
    issues.push({
      id: `a${issues.length + 1}`,
      criterionId: crit.id,
      title: advice?.title ?? crit.label,
      detail: `${advice?.detail ?? ""} ${crit.reason}`.trim(),
      impact: impactOf(crit.weight),
      fix: autoFixFor(crit.id, p, ctx.role),
      alt: twoPagesAlt(crit.id, p, ctx.template),
    });
  }

  // 3) most points at stake first
  const lost = (id?: string) => {
    const c = failing.get(id ?? "");
    return c ? c.weight - c.earned : 0;
  };
  // the look is the person's choice: improving the resume in that look comes first, so a change of look is always the last thing listed
  issues.sort((a, b) => Number(a.criterionId === "atsLayout") - Number(b.criterionId === "atsLayout") || lost(b.criterionId) - lost(a.criterionId));
  // only what matters: details worth less than 2 points stay out, and the list is short enough to act on
  const worth = issues.filter((i) => {
    const c = failing.get(i.criterionId ?? "");
    return c ? worthListing(c) : true;
  });
  const final = worth.slice(0, MAX_ISSUES).map((i, n) => ({ ...i, id: `a${n + 1}` }));

  const strengths = (Array.isArray(raw.strengths) ? raw.strengths : []).map((s: unknown) => str(s, 140)).filter(Boolean).slice(0, 3);
  return {
    source: "ai",
    target: ctx.role ? { kind: ctx.role.source === "job-ad" ? "job" : "general", role: ctx.role.role, field: ctx.role.field, keywords: ctx.role.keywords } : undefined,
    score: scoreOf(criteria),
    headline: str(raw.headline, 160) || "Here is what I found.",
    strengths: strengths.length ? strengths : criteria.filter((c) => c.verdict === "pass").sort((a, b) => b.weight - a.weight).slice(0, 3).map((c) => c.reason),
    criteria,
    issues: final,
  };
}

/** Which guideline ids exist (used to sanitize what the client sends back as "previous"). */
export const CRITERION_IDS = new Set(CRITERIA.map((c) => c.id));

export function cleanPrevious(input: unknown): PreviousReview | undefined {
  if (!input || typeof input !== "object") return undefined;
  const r = input as Record<string, unknown>;
  const verdicts = (Array.isArray(r.verdicts) ? r.verdicts : [])
    .map((v): { id: string; verdict: Verdict } | null => {
      const x = (v ?? {}) as Record<string, unknown>;
      return CRITERION_IDS.has(String(x.id)) && VERDICTS.has(String(x.verdict)) ? { id: String(x.id), verdict: x.verdict as Verdict } : null;
    })
    .filter((x): x is { id: string; verdict: Verdict } => Boolean(x));
  const applied = (Array.isArray(r.applied) ? r.applied : []).map((a: unknown) => str(a, 90)).filter(Boolean).slice(0, 12);
  const appliedCriteria = (Array.isArray(r.appliedCriteria) ? r.appliedCriteria : []).map((a: unknown) => String(a)).filter((a) => CRITERION_IDS.has(a)).slice(0, 30);
  return verdicts.length || applied.length ? { verdicts, applied, appliedCriteria } : undefined;
}
