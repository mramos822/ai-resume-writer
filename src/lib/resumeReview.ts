// Shared by the review API (server) and the review panel (client): types, the rule-based fallback review,
// the validation of fixes the AI proposes, and the pure function that applies a fix to a profile.
import { asPageGoal, canRunTwoPages } from "@/lib/pageGoal";
import { faithfulBullets } from "@/lib/bulletFidelity";
import type { ProfileData, JobEntry } from "@/context/profileContext";
import { MIN_RECENT_JOBS, evaluateAuto, isRecentJob, newestFirst, scoreOf, type CriterionResult, type PageFit } from "@/lib/reviewRubric";
import { isRelevantJob, resumeText, type RoleProfile } from "@/lib/roleProfile";
import { placeLine } from "@/lib/place";
import { passesPage } from "@/lib/pageRules";

export { dedupeProfile } from "@/lib/profileDedupe";
export type { PageFit, CriterionResult } from "@/lib/reviewRubric";

export type ReviewFix =
  | { type: "objective"; text: string }
  | { type: "jobTitle"; text: string }
  | { type: "bullets"; jobId: string; bullets: string[] }
  | { type: "addSkills"; skills: string[] }
  | { type: "removeJob"; jobId: string }
  | { type: "removeSkills"; skills: string[] }
  | { type: "sortJobs" }
  | { type: "removeJobs"; jobIds: string[] }
  | { type: "atsClean" }
  /** keep all the content and let the resume run to a second page */
  | { type: "twoPages" };

export interface ReviewIssue {
  id: string;
  /** which guideline of the rubric this comes from */
  criterionId?: string;
  title: string;
  detail: string;
  impact: "high" | "medium" | "low";
  /** What can be applied automatically, if anything. */
  fix: ReviewFix | null;
  /** set when the fix was written on demand and needs several changes (for example bullets for 3 jobs) */
  fixes?: ReviewFix[];
  /** another way out the person can choose instead of the fix: for a resume that is too long, keep everything and use two pages */
  alt?: ReviewFix | null;
}

export interface ReviewResult {
  source: "ai" | "basic";
  score: number;
  headline: string;
  strengths: string[];
  /** what the resume was judged against: a general standard for the role, or one specific job */
  target?: { kind: "general" | "job"; role: string; field: string; keywords: string[] };
  /** every guideline with its verdict, so the score is never a mystery */
  criteria: CriterionResult[];
  /** points of every guideline except the layout one (the client re-measures that one when the look changes) */
  atsRest?: { earned: number; total: number };
  issues: ReviewIssue[];
}

export function scoreLabel(score: number): string {
  if (score >= 85) return "Excellent";
  if (score >= 70) return "Strong";
  if (score >= 50) return "Good start";
  return "Needs work";
}

export const isCrowded = (fit?: PageFit | null) => !passesPage(fit);

/** For a resume that is too long: when the look can run to two pages and the person asked for one, offer to keep everything instead of cutting. */
export function twoPagesAlt(criterionId: string | undefined, p: ProfileData, template: string): ReviewFix | null {
  return criterionId === "onePage" && canRunTwoPages(template) && asPageGoal(p.pageGoal) === "one" ? { type: "twoPages" } : null;
}

/** The impact of a guideline depends on how many points it is worth. */
export const impactOf = (weight: number): ReviewIssue["impact"] => (weight >= 8 ? "high" : weight >= 5 ? "medium" : "low");

/** What to say about a failed measurable guideline when the AI is not involved. */
export const AUTO_ADVICE: Record<string, { title: string; detail: string }> = {
  contact: { title: "Complete your contact details", detail: "ATS and recruiters need your name, email, phone and city to contact you." },
  skillsBacked: { title: "Show where you used your skills", detail: "Keep all your skills, the more the better. When a skill is not shown in your jobs, projects or studies, a bullet that uses it makes it more believable to a recruiter." },
  recentExperience: { title: "Keep your most recent jobs", detail: "Recruiters read your latest roles first. Keep at least your 3 most recent jobs listed." },
  chronology: { title: "Put your newest job first", detail: "ATS and recruiters expect reverse chronological order." },
  gaps: { title: "Explain gaps between jobs", detail: "A gap over 6 months stands out to HR. Add what you did in that time (studies, projects, freelance) as an entry." },
  atsLayout: { title: "Optional: a plainer look for ATS portals", detail: "Your look is a good one and you can keep it. Only if you apply through company portals that scan resumes automatically, the Classic look without the photo and skill ratings is the safest to read." },
  role: { title: "Add the job you are aiming for", detail: "A target title tells recruiters in one line what to read you for." },
  summaryLength: { title: "Write your profile as an introduction", detail: "Your profile is your cover letter: three to five sentences (250 to 700 characters) on who you are, your strongest experience and skills, and what you bring." },
  skillsCount: { title: "Fix the number of skills", detail: "Eight or more skills that match the jobs you want give ATS enough keywords. Skills are a priority: only repeats or redundant ones are removed, and only when the list is very long." },
  experience: { title: "Add your experience", detail: "Part-time jobs, volunteering, projects or internships all count." },
  bulletsPerJob: { title: "Give each recent job 3 to 5 bullets", detail: "Short bullets that say what you did are what recruiters scan for." },
  bulletLength: { title: "Keep bullets short and specific", detail: "Between one line and two lines (about 25 to 170 characters)." },
  strongVerbs: { title: "Start bullets with strong verbs", detail: "Replace “Responsible for…” or “Helped with…” with verbs like Led, Built or Served." },
  numbers: { title: "Add numbers to your results", detail: "How many, how often, how much. “Served 100+ customers a day” beats “helped customers”." },
  education: { title: "Add your education", detail: "List your latest school, even if you are still studying." },
  onePage: { title: "Your resume is too long for its page", detail: "The text had to be shrunk to fit. Cut the least relevant things so it is easy to read." },
  noDuplicates: { title: "Remove repeated entries", detail: "The same job, school or skill appears more than once." },
  dates: { title: "Add start dates to your jobs", detail: "Dates let recruiters see how long you stayed and what is most recent." },
};

/**
 * A review that uses only the measurable guidelines. Used when the AI is unavailable. The qualitative guidelines
 * are simply not scored, so the number is still comparable between runs.
 */
/** The review only lists what really matters: points lost below this are details, and they stay out of the list. */
export const MIN_POINTS_AT_STAKE = 2;
export const MAX_ISSUES = 6;
export const worthListing = (c: { weight: number; earned: number }) => c.weight - c.earned >= MIN_POINTS_AT_STAKE;

export function basicReview(p: ProfileData, fit?: PageFit | null, template = "classic", role?: RoleProfile | null): ReviewResult {
  const criteria = evaluateAuto(p, fit, template, role);
  const issues: ReviewIssue[] = criteria
    .filter((c) => c.verdict !== "pass" && worthListing(c))
    // the look is the person's choice: a change of look is always the last thing listed
    .sort((a, b) => Number(a.id === "atsLayout") - Number(b.id === "atsLayout") || b.weight - b.earned - (a.weight - a.earned))
    .slice(0, MAX_ISSUES)
    .map((c, i) => {
      const advice = AUTO_ADVICE[c.id] ?? { title: c.label, detail: c.reason };
      const fix = autoFixFor(c.id, p, role);
      return { id: `b${i + 1}`, criterionId: c.id, title: advice.title, detail: `${advice.detail} ${c.reason}`.trim(), impact: impactOf(c.weight), fix, alt: twoPagesAlt(c.id, p, template) };
    });
  const score = scoreOf(criteria);
  return {
    source: "basic",
    score,
    headline: score >= 70 ? "Your resume covers the essentials." : "A few things would make this resume much stronger.",
    strengths: criteria
      .filter((c) => c.verdict === "pass")
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 3)
      .map((c) => c.reason),
    target: role ? { kind: role.source === "job-ad" ? "job" : "general", role: role.role, field: role.field, keywords: role.keywords } : undefined,
    criteria,
    issues,
  };
}

/**
 * One review serves all three looks. Only the "easy for ATS to read" guideline depends on the look, so when the person
 * switches look it is re-measured here (no AI, no request) and the score is recomputed from the same verdicts.
 */
export function reviewForTemplate(review: ReviewResult, p: ProfileData, template: string): ReviewResult {
  const now = evaluateAuto(p, null, template).find((c) => c.id === "atsLayout");
  if (!now || !review.criteria?.some((c) => c.id === "atsLayout")) return review;
  const criteria = review.criteria.map((c) => (c.id === "atsLayout" ? now : c));
  let issues = review.issues.filter((i) => i.criterionId !== "atsLayout");
  if (now.verdict !== "pass") {
    const advice = AUTO_ADVICE.atsLayout;
    issues = [...issues, { id: "atsLayout", criterionId: "atsLayout", title: advice.title, detail: `${advice.detail} ${now.reason}`.trim(), impact: impactOf(now.weight), fix: { type: "atsClean" } }];
  }
  // the rest of the guidelines come as two totals (their points are not sent), so the score is rebuilt from them
  const rest = review.atsRest;
  const score = rest && rest.total + now.weight > 0 ? Math.round((100 * (rest.earned + now.earned)) / (rest.total + now.weight)) : review.score;
  return { ...review, criteria, issues, score };
}

/**
 * Fixes that need no AI because the answer is mechanical. They never touch your 3 most recent jobs.
 */
export function autoFixFor(criterionId: string, p: ProfileData, role?: RoleProfile | null): ReviewFix | null {
  const skills = p.skills ?? [];
  const text = resumeText(p);
  const clean = (s: string) => s.toLowerCase().replace(/[()]/g, " ").replace(/\s+/g, " ").trim();
  switch (criterionId) {
    case "chronology":
      return { type: "sortJobs" };
    case "role": {
      const t = newestFirst(p.jobHistory ?? []).find((j) => j.title?.trim())?.title.trim();
      return t ? { type: "jobTitle", text: t } : null;
    }
    case "skillsBacked":
    case "skillsFit":
      // skills are a priority: nothing is removed mechanically here (the AI decides, and only for useless ones)
      return null;
    case "skillsCount":
    case "keywordCoverage":
    case "keywordsFit": {
      // only exact repeats are removed (same skill written twice); skills are never cut just to reach a number
      const seen = new Set<string>();
      const repeats = skills.filter((s) => {
        const k = clean(s).replace(/s$/, "");
        if (seen.has(k)) return true;
        seen.add(k);
        return false;
      });
      if (criterionId === "skillsCount" && repeats.length) return { type: "removeSkills", skills: repeats };
      // add role keywords the resume already shows in its text but does not list as a skill (nothing is invented)
      const have = new Set(skills.map(clean));
      const add = (role?.keywords ?? []).filter((k) => !have.has(clean(k)) && text.includes(clean(k))).slice(0, Math.max(1, 12 - skills.length));
      return add.length ? { type: "addSkills", skills: add } : null;
    }
    case "atsLayout":
      return { type: "atsClean" };
    case "onePage": {
      // old jobs beyond the 3 most recent: drop the ones unrelated to the role or more than 10 years old (at least the oldest)
      const older = newestFirst(p.jobHistory ?? []).slice(MIN_RECENT_JOBS);
      if (older.length === 0) return null;
      const cutoff = new Date().getFullYear() - 10;
      const stale = older.filter((j) => !isRelevantJob(p, j, role) || (j.startDate && Number(j.startDate.slice(0, 4)) < cutoff));
      const drop = (stale.length ? stale : [older[older.length - 1]]).map((j) => j.id);
      return { type: "removeJobs", jobIds: drop };
    }
    default:
      return null;
  }
}

/** Compact, photo-free copy of the profile for the AI (and to keep the prompt small). */
export function profileForReview(p: ProfileData) {
  return {
    name: p.name,
    jobTitle: p.jobTitle,
    careerObjective: p.careerObjective,
    skills: p.skills,
    skillLevels: p.skillLevels,
    languages: p.languages,
    links: (p.links ?? []).map((l) => ({ label: l.label, url: l.url })),
    certifications: (p.certifications ?? []).map((c) => ({ name: c.name, issuer: c.issuer, year: c.year })),
    jobHistory: (p.jobHistory ?? []).map((j) => ({
      id: j.id, title: j.title, company: j.company, location: j.location, startDate: j.startDate, endDate: j.endDate,
      current: j.current, description: j.description, bullets: j.accomplishments,
    })),
    education: (p.education ?? []).map((e) => ({
      school: e.school, degree: e.degree, startDate: e.startDate, endDate: e.endDate, gpa: e.gpa, honors: e.honors, coursework: e.coursework,
    })),
    projects: (p.projects ?? []).map((x) => ({ name: x.name, description: x.description, technologies: x.technologies, bullets: x.accomplishments })),
    internships: (p.internships ?? []).map((j) => ({ title: j.title, company: j.company, bullets: j.accomplishments })),
    contact: { hasEmail: Boolean(p.contactInfo?.email), hasPhone: Boolean(p.contactInfo?.phone), hasAddress: Boolean(placeLine(p.contactInfo)) },
  };
}

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

type Raw = Record<string, unknown>;

/** Checks a fix the AI proposed against the real profile: unknown ids, empty or oversized content are dropped. */
export function cleanFix(input: unknown, p: ProfileData): ReviewFix | null {
  if (!input || typeof input !== "object") return null;
  const raw = input as Raw;
  switch (raw.type) {
    case "objective": {
      const text = str(raw.text, 500);
      return text.length >= 30 ? { type: "objective", text } : null;
    }
    case "jobTitle": {
      const text = str(raw.text, 80);
      return text ? { type: "jobTitle", text } : null;
    }
    case "bullets": {
      const jobId = str(raw.jobId, 80);
      const job = (p.jobHistory ?? []).find((j) => j.id === jobId);
      if (!job) return null;
      const proposed = (Array.isArray(raw.bullets) ? raw.bullets : []).map((b: unknown) => str(b, 220)).filter(Boolean).slice(0, 8);
      // a rewrite may say the same better, but not more: a bullet that adds a tool or a number the job never showed goes back as the
      // person wrote it (this is the path of "Fix it for me" in the general review, which saves into the profile)
      const bullets = faithfulBullets(job, proposed).bullets;
      return bullets.length ? { type: "bullets", jobId, bullets } : null;
    }
    case "addSkills": {
      const have = new Set((p.skills ?? []).map((s) => s.toLowerCase()));
      const skills = (Array.isArray(raw.skills) ? raw.skills : [])
        .map((s: unknown) => str(s, 40))
        .filter((s: string) => s && !have.has(s.toLowerCase()))
        .slice(0, 8);
      return skills.length ? { type: "addSkills", skills } : null;
    }
    case "removeJob": {
      const jobId = str(raw.jobId, 80);
      // the 3 most recent jobs are never removed, and neither is a job when only 3 or fewer remain
      if (isRecentJob(p, jobId) || (p.jobHistory?.length ?? 0) <= MIN_RECENT_JOBS) return null;
      return (p.jobHistory ?? []).some((j) => j.id === jobId) ? { type: "removeJob", jobId } : null;
    }
    case "sortJobs":
      return { type: "sortJobs" };
    case "atsClean":
      return { type: "atsClean" };
    case "removeJobs": {
      const all = p.jobHistory ?? [];
      const ids = (Array.isArray(raw.jobIds) ? raw.jobIds : []).map((x: unknown) => str(x, 80)).filter((id: string) => all.some((j) => j.id === id) && !isRecentJob(p, id));
      // always keep the 3 most recent
      const jobIds = ids.slice(0, Math.max(0, all.length - MIN_RECENT_JOBS));
      return jobIds.length ? { type: "removeJobs", jobIds } : null;
    }
    case "removeSkills": {
      const mine = new Map((p.skills ?? []).map((s) => [s.toLowerCase(), s]));
      const skills = (Array.isArray(raw.skills) ? raw.skills : [])
        .map((s: unknown) => mine.get(str(s, 40).toLowerCase()))
        .filter((s: string | undefined): s is string => Boolean(s))
        .slice(0, 15);
      return skills.length ? { type: "removeSkills", skills } : null;
    }
    default:
      return null;
  }
}

export type ProfilePatch = Partial<Pick<ProfileData, "careerObjective" | "jobTitle" | "skills" | "jobHistory" | "photo" | "skillLevels" | "pageGoal">>;

/** Applies several fixes at once and returns only the fields that changed (so one save covers them all). */
export function applyFixes(p: ProfileData, fixes: ReviewFix[]): ProfilePatch {
  const patch: ProfilePatch = {};
  let jobs: JobEntry[] | null = null;
  let skills: string[] | null = null;
  for (const f of fixes) {
    if (f.type === "objective") patch.careerObjective = f.text;
    else if (f.type === "jobTitle") patch.jobTitle = f.text;
    else if (f.type === "addSkills") {
      skills = skills ?? [...(p.skills ?? [])];
      for (const s of f.skills) if (!skills.some((x) => x.toLowerCase() === s.toLowerCase())) skills.push(s);
    } else if (f.type === "removeSkills") {
      const drop = new Set(f.skills.map((x) => x.toLowerCase()));
      skills = (skills ?? [...(p.skills ?? [])]).filter((x) => !drop.has(x.toLowerCase()));
    } else if (f.type === "removeJob") {
      jobs = (jobs ?? (p.jobHistory ?? []).map((j) => ({ ...j }))).filter((j) => j.id !== f.jobId);
    } else if (f.type === "bullets") {
      jobs = jobs ?? (p.jobHistory ?? []).map((j) => ({ ...j }));
      jobs = jobs.map((j) => (j.id === f.jobId ? { ...j, description: "", accomplishments: f.bullets } : j));
    } else if (f.type === "removeJobs") {
      const drop = new Set(f.jobIds);
      jobs = (jobs ?? (p.jobHistory ?? []).map((j) => ({ ...j }))).filter((j) => !drop.has(j.id));
    } else if (f.type === "twoPages") {
      patch.pageGoal = "two";
    } else if (f.type === "atsClean") {
      patch.photo = "";
      patch.skillLevels = {};
    } else if (f.type === "sortJobs") {
      jobs = newestFirst(jobs ?? (p.jobHistory ?? []).map((j) => ({ ...j })));
    }
  }
  if (skills) patch.skills = skills;
  if (jobs) patch.jobHistory = jobs;
  return patch;
}

/** True when applying the patch would really change the profile (a fix can already be in place, and then nothing happens). */
export function patchChangesProfile(p: ProfileData, patch: ProfilePatch): boolean {
  const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
  if ("careerObjective" in patch && !same(patch.careerObjective, p.careerObjective ?? "")) return true;
  if ("jobTitle" in patch && !same(patch.jobTitle, p.jobTitle ?? "")) return true;
  if ("skills" in patch && !same(patch.skills, p.skills ?? [])) return true;
  if ("photo" in patch && !same(patch.photo ?? "", p.photo ?? "")) return true;
  if ("pageGoal" in patch && (patch.pageGoal ?? "one") !== (p.pageGoal ?? "one")) return true;
  if ("skillLevels" in patch && !same(patch.skillLevels ?? {}, p.skillLevels ?? {})) return true;
  if ("jobHistory" in patch && !same(patch.jobHistory, p.jobHistory ?? [])) return true;
  return false;
}

/** The current values of the fields a patch would change, to undo it later. */
export function snapshotFor(p: ProfileData, patch: ProfilePatch): ProfilePatch {
  const snap: ProfilePatch = {};
  if ("careerObjective" in patch) snap.careerObjective = p.careerObjective ?? "";
  if ("jobTitle" in patch) snap.jobTitle = p.jobTitle ?? "";
  if ("skills" in patch) snap.skills = [...(p.skills ?? [])];
  if ("photo" in patch) snap.photo = p.photo ?? "";
  if ("skillLevels" in patch) snap.skillLevels = { ...(p.skillLevels ?? {}) };
  if ("jobHistory" in patch) snap.jobHistory = (p.jobHistory ?? []).map((j) => ({ ...j }));
  if ("pageGoal" in patch) snap.pageGoal = p.pageGoal ?? "one";
  return snap;
}
