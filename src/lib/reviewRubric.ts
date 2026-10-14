// The fixed menu of guidelines every resume review is measured against.
// They encode (1) what applicant tracking systems (ATS) need in order to read a resume, and (2) what HR and
// recruiters check first in a quick scan. Measurable guidelines ("auto") are scored by code, so the same resume
// always gets the same score and fixing something can only raise it. Subjective ones ("ai") are judged by the AI
// against the written definitions below, never against rules it invents on the spot.
import { TWO_COLUMN } from "@/lib/templates";
import { passesPage } from "@/lib/pageRules";
import type { ProfileData, JobEntry } from "@/context/profileContext";
import { dedupeProfile } from "@/lib/profileDedupe";
import { placeLine } from "@/lib/place";
import { ALL_SKILLS } from "@/lib/skills";
import { isRelevantJob, keywordCoverage, type RoleProfile } from "@/lib/roleProfile";

/** The standard skills and languages of the big list, in lower case. */
const KNOWN_SKILLS = new Set(ALL_SKILLS.map((s) => s.toLowerCase()));

export type Verdict = "pass" | "partial" | "fail";

export interface Criterion {
  id: string;
  label: string;
  weight: number;
  kind: "auto" | "ai";
  /** What "pass", "partial" and "fail" mean. For AI criteria this exact text is given to the AI. */
  guideline: string;
}

export interface CriterionResult {
  id: string;
  label: string;
  weight: number;
  kind: "auto" | "ai";
  verdict: Verdict;
  /** points earned out of `weight` */
  earned: number;
  reason: string;
}

export interface PageFit {
  pages: number;
  scale: number;
}

/** How many of the most recent jobs a resume should always keep. */
export const MIN_RECENT_JOBS = 3;

export const CRITERIA: Criterion[] = [
  // ---------- measured by code: ATS and HR basics ----------
  { id: "contact", label: "Complete contact details", weight: 10, kind: "auto", guideline: "pass: name, email, phone and location. partial: name and email. fail: less." },
  { id: "role", label: "Target job title", weight: 5, kind: "auto", guideline: "pass: a target job title is set (ATS and recruiters match on it). fail: empty." },
  {
    id: "summaryLength",
    label: "Profile is a real introduction",
    weight: 7,
    kind: "auto",
    guideline: "The profile is the cover letter of the resume, not a tagline. pass: 250 to 700 characters (about 3 to 5 sentences). partial: 120 to 249 or 701 to 900. fail: shorter or longer.",
  },
  { id: "skillsCount", label: "Enough skills for keyword matching", weight: 6, kind: "auto", guideline: "Skills are a priority for ATS: the more real skills and languages, the better. pass: 8 to 40 skills. partial: 5 to 7 or 41 to 60. fail: fewer than 5 or more than 60." },
  {
    id: "skillsBacked",
    label: "Skills are backed by your experience",
    weight: 6,
    kind: "auto",
    guideline: "Share of listed skills that appear in the jobs, projects, education or coursework, or that are standard, in-demand skills (those never count against you). pass: 50% or more. partial: 30% or more. fail: less.",
  },
  {
    id: "keywordCoverage",
    label: "Role keywords an ATS searches for",
    weight: 8,
    kind: "auto",
    guideline: "Share of the role's standard keywords (from its professional rubric) that appear on the resume. pass: 60% or more. partial: 35% or more. fail: less.",
  },
  { id: "experience", label: "Experience listed", weight: 8, kind: "auto", guideline: "pass: at least one job. partial: no job but projects or internships. fail: none." },
  {
    id: "recentExperience",
    label: "Recent experience is kept (3 jobs)",
    weight: 8,
    kind: "auto",
    guideline: "Recruiters read the most recent roles first. pass: 3 or more jobs listed (2 or more entries when entry-level). partial: one fewer. fail: fewer.",
  },
  { id: "chronology", label: "Reverse chronological order", weight: 3, kind: "auto", guideline: "ATS and recruiters expect the most recent job first. pass: jobs are newest first. fail: not." },
  { id: "gaps", label: "No unexplained gaps", weight: 3, kind: "auto", guideline: "HR notices gaps. pass: no gap over 6 months between jobs. partial: one. fail: more." },
  { id: "bulletsPerJob", label: "3 to 5 bullets per recent job", weight: 8, kind: "auto", guideline: "Looks at the 3 most recent jobs that relate to the target role (jobs unrelated to it can have few or no bullets). pass: every one has 3 to 5 bullets. partial: at least half. fail: fewer." },
  { id: "bulletLength", label: "Bullets are short and specific", weight: 4, kind: "auto", guideline: "pass: every bullet is 25 to 170 characters. partial: up to 20% are not. fail: more." },
  { id: "strongVerbs", label: "Bullets start with strong verbs", weight: 5, kind: "auto", guideline: 'No bullet starts with a weak phrase ("Responsible for", "Helped with", "Worked on", "Duties included", "In charge of", "Tasked with", "I"). pass: none. partial: up to 25%. fail: more.' },
  { id: "numbers", label: "Results with numbers", weight: 6, kind: "auto", guideline: "Share of bullets in the 3 most recent jobs that contain a number. pass: 30% or more. partial: 10% or more. fail: less." },
  { id: "education", label: "Education listed", weight: 5, kind: "auto", guideline: "pass: at least one school. fail: none." },
  { id: "onePage", label: "Fits on one page", weight: 8, kind: "auto", guideline: "pass: one page without shrinking the text below 85% (a recruiter skips small print). partial: 70% to 85%. fail: smaller or more than one page." },
  {
    id: "atsLayout",
    label: "Easy for ATS to read",
    weight: 6,
    kind: "auto",
    guideline: "ATS read single-column plain text best; photos, skill bars/dots and two-column layouts can break parsing, and a photo can also trigger bias concerns in the US. pass: Classic look, no photo, no skill ratings. partial: one of those issues. fail: more than one.",
  },
  { id: "noDuplicates", label: "No repeated entries", weight: 3, kind: "auto", guideline: "pass: no repeated job, school, skill or language. fail: some." },
  { id: "dates", label: "Jobs have start dates", weight: 3, kind: "auto", guideline: "pass: every job has a start date. partial: most. fail: few." },
  // ---------- judged by the AI, against these exact definitions ----------
  {
    id: "summaryFit",
    label: "Profile reads as a strong introduction",
    weight: 10,
    kind: "ai",
    guideline:
      "The profile is the person's cover letter. pass: it reads as a short narrative that says who they are (role or field), their strongest experience or skills, and what they bring or look for, tied to the target role. partial: relevant but generic or missing one of those parts. fail: vague (like 'I want a job'), a bare list, or unrelated to the target role.",
  },
  {
    id: "skillsFit",
    label: "Skills match the role and the rest of the resume",
    weight: 6,
    kind: "ai",
    guideline:
      "A skill is relevant when it is important or in demand for the target role or its field, even if no job, project or study shows it: it is NEVER a problem that a skill is not used in the experience. pass: about 70% or more of the skills are relevant to the target role or field, with no filler. partial: 40% to 70%. fail: under 40%, or the list is mostly filler or jokes.",
  },
  {
    id: "roleRequirements",
    label: "Shows what this role requires",
    weight: 6,
    kind: "ai",
    guideline:
      "Judged against the role's professional rubric (requirements and recruiter priorities). pass: the resume shows the credentials or proof the role normally expects (degree, license, certification, portfolio, scope of work) and covers what recruiters in the field check first. partial: shows some. fail: the main expectations of the role are missing.",
  },
  {
    id: "experienceFit",
    label: "Experience supports the target role",
    weight: 6,
    kind: "ai",
    guideline:
      "pass: the most recent experience supports the target role (or clearly shows transferable value) and nothing irrelevant takes noticeable space. partial: some irrelevant or very old items. fail: mostly unrelated to the target role. Recent jobs are never a reason to fail this.",
  },
  {
    id: "bulletsQuality",
    label: "Bullets show impact",
    weight: 5,
    kind: "ai",
    guideline: "pass: bullets say what was done AND its result or scale, specifically. partial: a mix of specific and generic. fail: mostly generic duties ('handled customers').",
  },
  {
    id: "writing",
    label: "Clean, consistent writing",
    weight: 4,
    kind: "ai",
    guideline:
      "pass: no typos or grammar mistakes, past tense for past jobs and present tense for the current one, no first-person pronouns ('I', 'my'). partial: a few slips. fail: many.",
  },
];

export const AI_CRITERIA = CRITERIA.filter((c) => c.kind === "ai");
const byId = new Map(CRITERIA.map((c) => [c.id, c]));

const POINTS: Record<Verdict, number> = { pass: 1, partial: 0.5, fail: 0 };
const WEAK = /^(responsible for|helped with|worked on|duties included|tasked with|in charge of|i\s)/i;

const bulletsOf = (j: JobEntry) => (j.accomplishments ?? []).map((b) => b.trim()).filter(Boolean);
const startKey = (j: JobEntry) => (/^\d{4}-\d{2}$/.test(j.startDate ?? "") ? j.startDate : "");

/** Jobs from the most recent to the oldest by start date (jobs without a date keep the order they were listed in). */
export function newestFirst(jobs: JobEntry[]): JobEntry[] {
  return jobs
    .map((j, i) => ({ j, i }))
    .sort((a, b) => {
      const ka = startKey(a.j);
      const kb = startKey(b.j);
      if (ka && kb) return ka < kb ? 1 : ka > kb ? -1 : a.i - b.i;
      return a.i - b.i;
    })
    .map((x) => x.j);
}

const topJobs = (p: ProfileData) => newestFirst(p.jobHistory ?? []).slice(0, 3);

/** True when the job is one of the 3 most recent: those are never removed. */
export function isRecentJob(p: ProfileData, jobId: string): boolean {
  return newestFirst(p.jobHistory ?? []).slice(0, MIN_RECENT_JOBS).some((j) => j.id === jobId);
}

function months(j: JobEntry): number {
  const m = /^(\d{4})-(\d{2})$/;
  const s = m.exec(j.startDate ?? "");
  if (!s) return 0;
  const now = new Date();
  const e = j.current || !j.endDate ? null : m.exec(j.endDate);
  const endY = e ? Number(e[1]) : now.getFullYear();
  const endM = e ? Number(e[2]) : now.getMonth() + 1;
  return Math.max(0, (endY - Number(s[1])) * 12 + (endM - Number(s[2])));
}

/** Rough seniority from the dates of the listed jobs, used as context for the AI. */
export function seniorityOf(p: ProfileData): { years: number; level: "entry-level" | "mid-level" | "senior" } {
  const total = (p.jobHistory ?? []).reduce((n, j) => n + months(j), 0) / 12;
  const years = Math.round(total * 10) / 10;
  return { years, level: years < 2 ? "entry-level" : years < 6 ? "mid-level" : "senior" };
}

const norm = (s?: string) => (s ?? "").toLowerCase();

/** Everything written about the person's work and studies, used to check that the skills are backed up. */
function evidenceText(p: ProfileData): string {
  return norm(
    [
      ...(p.jobHistory ?? []).flatMap((j) => [j.title, j.company, j.description, ...(j.accomplishments ?? [])]),
      ...(p.internships ?? []).flatMap((j) => [j.title, j.company, j.description, ...(j.accomplishments ?? [])]),
      ...(p.projects ?? []).flatMap((x) => [x.name, x.description, ...(x.technologies ?? []), ...(x.accomplishments ?? [])]),
      ...(p.education ?? []).flatMap((e) => [e.degree, e.coursework, e.honors]),
      ...(p.certifications ?? []).map((c) => c.name),
      p.careerObjective,
    ].join(" \n ")
  );
}

type Auto = { verdict: Verdict; reason: string } | null; // null = does not apply to this resume

function evalAuto(id: string, p: ProfileData, fit?: PageFit | null, template = "classic", role?: RoleProfile | null): Auto {
  const jobs = topJobs(p);
  const all = jobs.flatMap(bulletsOf);
  const every = (p.jobHistory ?? []).flatMap(bulletsOf);
  switch (id) {
    case "contact": {
      const has = [p.name?.trim(), p.contactInfo?.email?.trim(), p.contactInfo?.phone?.trim(), placeLine(p.contactInfo).trim()].map(Boolean);
      const missing = ["name", "email", "phone", "location"].filter((_, i) => !has[i]);
      if (missing.length === 0) return { verdict: "pass", reason: "Name, email, phone and location are there." };
      const core = has[0] && has[1];
      return { verdict: core ? "partial" : "fail", reason: `Missing: ${missing.join(", ")}.` };
    }
    case "role":
      return p.jobTitle?.trim() ? { verdict: "pass", reason: "You say which job you want." } : { verdict: "fail", reason: "No target job title." };
    case "summaryLength": {
      const n = (p.careerObjective ?? "").trim().length;
      if (n >= 250 && n <= 700) return { verdict: "pass", reason: `${n} characters: a proper introduction.` };
      if ((n >= 120 && n < 250) || (n > 700 && n <= 900)) return { verdict: "partial", reason: `${n} characters; aim for 250 to 700 (3 to 5 sentences).` };
      return { verdict: "fail", reason: n === 0 ? "No profile written." : `${n} characters; aim for 250 to 700 (3 to 5 sentences).` };
    }
    case "skillsCount": {
      const n = p.skills?.length ?? 0;
      if (n >= 8 && n <= 40) return { verdict: "pass", reason: `${n} skills.` };
      if (n > 40) return n <= 60 ? { verdict: "partial", reason: `${n} skills; the list is very long, so repeated or redundant ones can go.` } : { verdict: "fail", reason: `${n} skills; the list is very long, so repeated or redundant ones can go.` };
      if (n >= 5) return { verdict: "partial", reason: `${n} skills; aim for 8 or more.` };
      return { verdict: "fail", reason: `${n} skills; aim for 8 or more.` };
    }
    case "skillsBacked": {
      const skills = (p.skills ?? []).filter(Boolean);
      if (skills.length === 0) return null;
      const text = evidenceText(p);
      if (text.trim().length < 40) return null; // nothing written to check against
      // a standard skill of the big list counts as supported even if no job or project names it: it is never held against the person
      const backed = skills.filter((s) => text.includes(norm(s).replace(/[()]/g, "").trim()) || KNOWN_SKILLS.has(s.trim().toLowerCase())).length;
      const share = backed / skills.length;
      const verdict: Verdict = share >= 0.5 ? "pass" : share >= 0.3 ? "partial" : "fail";
      return { verdict, reason: `${backed} of your ${skills.length} skills are standard skills or show up in your experience, projects or studies.` };
    }
    case "keywordCoverage": {
      if (!role || role.keywords.length === 0) return null;
      const k = keywordCoverage(p, role.keywords);
      const pct = Math.round(k.share * 100);
      const verdict: Verdict = k.share >= 0.6 ? "pass" : k.share >= 0.35 ? "partial" : "fail";
      return {
        verdict,
        reason:
          verdict === "pass"
            ? `${pct}% of the keywords for ${role.role || "this role"} are on your resume.`
            : `${pct}% of the keywords for ${role.role || "this role"}. Missing: ${k.missing.slice(0, 5).join(", ")}.`,
      };
    }
    case "experience": {
      if ((p.jobHistory?.length ?? 0) > 0) return { verdict: "pass", reason: "Jobs are listed." };
      if ((p.projects?.length ?? 0) + (p.internships?.length ?? 0) > 0) return { verdict: "partial", reason: "No jobs, but projects or internships." };
      return { verdict: "fail", reason: "No experience listed." };
    }
    case "recentExperience": {
      const entries = (p.jobHistory?.length ?? 0) + (p.internships?.length ?? 0) + (seniorityOf(p).level === "entry-level" ? p.projects?.length ?? 0 : 0);
      const need = seniorityOf(p).level === "entry-level" ? 2 : MIN_RECENT_JOBS;
      if (entries >= need) return { verdict: "pass", reason: `${entries} experience entries kept.` };
      if (entries === need - 1) return { verdict: "partial", reason: `Only ${entries}; keep your ${need} most recent roles.` };
      return { verdict: "fail", reason: `Only ${entries}; keep your ${need} most recent roles.` };
    }
    case "chronology": {
      const list = p.jobHistory ?? [];
      if (list.length < 2 || list.some((j) => !startKey(j))) return null;
      const sorted = newestFirst(list);
      const inOrder = list.every((j, i) => j.id === sorted[i].id);
      return inOrder ? { verdict: "pass", reason: "Newest job first." } : { verdict: "fail", reason: "Jobs are not ordered from newest to oldest." };
    }
    case "gaps": {
      const list = newestFirst(p.jobHistory ?? []).filter((j) => startKey(j));
      if (list.length < 2) return null;
      let gaps = 0;
      for (let i = 0; i < list.length - 1; i++) {
        const newer = list[i];
        const older = list[i + 1];
        const olderEnd = /^\d{4}-\d{2}$/.exec(older.endDate ?? "");
        if (older.current || !olderEnd) continue;
        const [y1, m1] = [Number(olderEnd[1]), Number(olderEnd[2])];
        const [y2, m2] = [Number(newer.startDate.slice(0, 4)), Number(newer.startDate.slice(5, 7))];
        if ((y2 - y1) * 12 + (m2 - m1) > 6) gaps++;
      }
      return gaps === 0 ? { verdict: "pass", reason: "No gaps over 6 months." } : { verdict: gaps === 1 ? "partial" : "fail", reason: `${gaps} gap${gaps > 1 ? "s" : ""} over 6 months between jobs.` };
    }
    case "bulletsPerJob": {
      if (jobs.length === 0) return null;
      // a job that has little to do with the target role only needs to be listed: it is fine with few bullets
      const need = jobs.filter((j) => isRelevantJob(p, j, role));
      if (need.length === 0) return null;
      const ok = need.filter((j) => bulletsOf(j).length >= 3 && bulletsOf(j).length <= 5).length;
      const verdict: Verdict = ok === need.length ? "pass" : ok * 2 >= need.length ? "partial" : "fail";
      return { verdict, reason: `${ok} of your ${need.length} recent jobs related to ${p.jobTitle?.trim() || "your target role"} have 3 to 5 bullets.` };
    }
    case "bulletLength": {
      if (every.length === 0) return null;
      const bad = every.filter((b) => b.length < 25 || b.length > 170).length;
      const verdict: Verdict = bad === 0 ? "pass" : bad / every.length <= 0.2 ? "partial" : "fail";
      return { verdict, reason: bad === 0 ? "All bullets are a good length." : `${bad} of ${every.length} bullets are too short or too long.` };
    }
    case "strongVerbs": {
      if (every.length === 0) return null;
      const weak = every.filter((b) => WEAK.test(b)).length;
      const verdict: Verdict = weak === 0 ? "pass" : weak / every.length <= 0.25 ? "partial" : "fail";
      return { verdict, reason: weak === 0 ? "Bullets start with action." : `${weak} bullet${weak > 1 ? "s" : ""} start with a weak phrase.` };
    }
    case "numbers": {
      if (all.length === 0) return null;
      const share = all.filter((b) => /\d/.test(b)).length / all.length;
      const verdict: Verdict = share >= 0.3 ? "pass" : share >= 0.1 ? "partial" : "fail";
      return { verdict, reason: `${Math.round(share * 100)}% of your recent bullets contain a number.` };
    }
    case "education":
      return (p.education?.length ?? 0) > 0 ? { verdict: "pass", reason: "Education is listed." } : { verdict: "fail", reason: "No education listed." };
    case "onePage": {
      if (!fit) return null;
      if (passesPage(fit)) return { verdict: "pass", reason: "Fits on one page at a comfortable size." };
      if (fit.pages <= 1 && fit.scale >= 0.7) return { verdict: "partial", reason: "It fits, but the text is shrunk a bit." };
      return { verdict: "fail", reason: "Too much content: the text has to be very small to fit." };
    }
    case "atsLayout": {
      const problems: string[] = [];
      const twoColumn = (TWO_COLUMN as readonly string[]).includes(template);
      if (twoColumn) problems.push("two-column layout");
      if (p.photo) problems.push("photo");
      if (twoColumn && Object.keys(p.skillLevels ?? {}).length > 0) problems.push("skill rating graphics");
      if (problems.length === 0) return { verdict: "pass", reason: "Single column, plain text: ATS can read all of it." };
      return { verdict: problems.length === 1 ? "partial" : "fail", reason: `ATS may struggle with: ${problems.join(", ")}.` };
    }
    case "noDuplicates": {
      const d = dedupeProfile(p).removed;
      return d === 0 ? { verdict: "pass", reason: "Nothing is repeated." } : { verdict: "fail", reason: `${d} repeated entr${d > 1 ? "ies" : "y"}.` };
    }
    case "dates": {
      const list = p.jobHistory ?? [];
      if (list.length === 0) return null;
      const ok = list.filter((j) => j.startDate).length;
      const verdict: Verdict = ok === list.length ? "pass" : ok * 2 >= list.length ? "partial" : "fail";
      return { verdict, reason: `${ok} of ${list.length} jobs have a start date.` };
    }
    default:
      return null;
  }
}

/** Scores every measurable guideline. Guidelines that do not apply (for example "bullets" when there are no jobs) are left out. */
export function evaluateAuto(p: ProfileData, fit?: PageFit | null, template = "classic", role?: RoleProfile | null): CriterionResult[] {
  const out: CriterionResult[] = [];
  for (const c of CRITERIA) {
    if (c.kind !== "auto") continue;
    const r = evalAuto(c.id, p, fit, template, role);
    if (!r) continue;
    out.push({ id: c.id, label: c.label, weight: c.weight, kind: "auto", verdict: r.verdict, earned: c.weight * POINTS[r.verdict], reason: r.reason });
  }
  return out;
}

/** Turns the AI's verdicts for the qualitative guidelines into results. Missing ones are left out (not scored). */
export function aiResults(verdicts: { id: string; verdict: Verdict; reason: string }[]): CriterionResult[] {
  const out: CriterionResult[] = [];
  for (const c of AI_CRITERIA) {
    const v = verdicts.find((x) => x.id === c.id);
    if (!v) continue;
    out.push({ id: c.id, label: c.label, weight: c.weight, kind: "ai", verdict: v.verdict, earned: c.weight * POINTS[v.verdict], reason: v.reason });
  }
  return out;
}

/** 0 to 100, from the guidelines that apply. Same inputs, same score. */
export function scoreOf(results: CriterionResult[]): number {
  const total = results.reduce((n, r) => n + r.weight, 0);
  if (total === 0) return 0;
  return Math.round((100 * results.reduce((n, r) => n + r.earned, 0)) / total);
}

export const autoPoints = (results: CriterionResult[]) => results.reduce((n, r) => n + r.earned, 0);

export function criterionById(id: string): Criterion | undefined {
  return byId.get(id);
}

/** The qualitative guidelines as plain text, exactly what the AI receives. */
export function rubricForPrompt(): string {
  return AI_CRITERIA.map((c) => `- ${c.id} ("${c.label}"): ${c.guideline}`).join("\n");
}
