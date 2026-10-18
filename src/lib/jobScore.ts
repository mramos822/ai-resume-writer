// How ready a resume is for ONE job, as a number from 0 to 100. It is measured by code, never by the AI: the same resume and the same job
// always give the same number, and fixing something can only raise it. The AI only writes the explanation.
// The job decides most of it: its position (against the roles the person wants and has held), the skills it asks for, the experience and
// the education it requires. The general quality of the resume (ATS, recruiters) is a small part (15%), so a well written resume cannot
// look ready for a job it does not fit.
import type { ProfileData } from "@/context/profileContext";
import { isPartialPosting, type JobListing } from "@/lib/jobSearch";
export { isPartialPosting };
import { levelFactor, roleSimilarity } from "@/lib/jobFit";
import { levelOf } from "@/lib/jobLevel";
import { covers, mentionedSkills, skillGap, type SkillGap } from "@/lib/jobSkills";
import type { JobFacts } from "@/lib/jobFacts";
import { resumeText } from "@/lib/roleProfile";
import { evaluateAuto, scoreOf } from "@/lib/reviewRubric";
import { yearsFor } from "@/lib/experienceLevel";

export interface JobScore {
  /** 0 to 100 */
  score: number;
  /** the skills the job names that the resume covers, out of the ones it names */
  skills: { have: number; total: number };
  /** the general checks of a good resume (ATS and recruiters), 0 to 100 */
  basics: number;
  /** 0 to 100: how well the level of the person matches what the job asks */
  level: number;
  /** 0 to 100: how close the position is to the roles the person wants or has held */
  role: number;
  /** 0 to 100: the education the job asks for against the one the resume shows */
  education: number;
  /** 0 to 100: the keywords of this job (the skills it names that the person has, and the ones the review asked to work in) that the objective and the bullets really say */
  narrative: number;
}

/** What the resume SAYS about the person's work: the objective and the bullets (the list of skills is not part of it). Lower case. */
export function narrativeText(p: ProfileData): string {
  return [
    p.careerObjective,
    ...(p.jobHistory ?? []).flatMap((j) => [j.description, ...(j.accomplishments ?? [])]),
    ...(p.internships ?? []).flatMap((j) => [j.description, ...(j.accomplishments ?? [])]),
    ...(p.projects ?? []).flatMap((x) => [x.description, ...(x.technologies ?? []), ...(x.accomplishments ?? [])]),
  ]
    .filter(Boolean)
    .join(" \n ")
    .toLowerCase();
}

const esc = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** True when the narrative says the term (a skill as a whole word, or a phrase as it is written). */
export const saysTerm = (narrative: string, term: string): boolean => {
  const t = term.trim().toLowerCase();
  if (!t) return true;
  return new RegExp(`(^|[^a-z0-9+#])${esc(t)}($|[^a-z0-9+#])`).test(narrative);
};

const DEGREE = /\b(bachelor'?s?|master'?s?|ph\.?d|doctorate|b\.?s\.?c?|m\.?s\.?c?|university degree|college degree|degree in|licenciatura|ingenier[ií]a|grado)\b/i;
const NO_DEGREE = /\b(no degree|degree (is )?not required|degree or equivalent|or equivalent experience)\b/i;

/**
 * `extra` are skills the person confirmed for this job: they count as covered. `targets` are the keywords the review of the resume asked
 * to work into it (checked by code to be in the posting and true for the person): the number rises when the resume says them.
 */
/** What a job asks for compared with the person's skills, from the skills the AI read out of the posting. */
function factsGap(facts: JobFacts, mine: string[], resume: string): SkillGap {
  const text = resume.toLowerCase();
  const shown = mentionedSkills(resume);
  const has = (s: string) => mine.some((m) => covers(m, s)) || shown.some((t) => covers(t, s)) || saysTerm(text, s);
  const asked = [...facts.required, ...facts.preferred];
  return { matched: asked.filter(has), missing: asked.filter((s) => !has(s)) };
}

/** How well the resume is written, 0 to 100: it does not depend on the job, so a list of jobs works it out once and passes it to `jobScore`. */
export function profileBasics(profile: ProfileData, template = "classic"): number {
  return scoreOf(evaluateAuto(profile, null, template, null));
}

/**
 * THE number of a job, everywhere it is shown (the list, the page of the job, the dashboard and the two screens of the application): how
 * well this person fits this job, as a percentage. (The score of the resume itself, which does not depend on a job, is another thing and
 * is called "Resume score".)
 */
export function jobScore(profile: ProfileData, job: JobListing, extra: string[] = [], _template = "classic", targets: string[] = [], basicsKnown?: number): JobScore {
  const body = job.description || job.snippet || "";
  const posting = `${job.title}. ${job.tags.join(", ")}. ${body}`;

  // the requirements: the skills the posting names (what the AI read from the whole posting when there is, else the keyword list on its text)
  const mine = [...(profile.skills ?? []), ...extra];
  const gap = job.facts && job.facts.required.length + job.facts.preferred.length > 0 ? factsGap(job.facts, mine, resumeText(profile)) : skillGap(posting, mine, resumeText(profile));
  const weight = (s: string) => (job.facts?.preferred.some((p) => p.toLowerCase() === s.toLowerCase()) ? 0.4 : 1); // a plus counts less than a requirement
  const total = gap.matched.length + gap.missing.length;
  const have = gap.matched.length;
  // a skill shown in the work (jobs, projects, studies) counts fully; one that is only in the list of skills counts less, and so does
  // one the person confirmed for this job (a recruiter reads the experience, not the list)
  const evidenceRaw = [
    ...(profile.jobHistory ?? []).flatMap((j) => [j.title, j.description, ...(j.accomplishments ?? [])]),
    ...(profile.internships ?? []).flatMap((j) => [j.title, j.description, ...(j.accomplishments ?? [])]),
    ...(profile.projects ?? []).flatMap((x) => [x.name, x.description, ...(x.technologies ?? []), ...(x.accomplishments ?? [])]),
    ...(profile.education ?? []).flatMap((e) => [e.degree, e.coursework]),
    ...(profile.certifications ?? []).map((c) => c.name),
  ].join(" \n ");
  const evidence = mentionedSkills(evidenceRaw);
  const evidenceText = evidenceRaw.toLowerCase();
  const shown = (s: string) => evidence.some((t) => covers(t, s)) || saysTerm(evidenceText, s);
  const wTotal = [...gap.matched, ...gap.missing].reduce((n, s) => n + weight(s), 0);
  const credit = gap.matched.reduce((n, s) => n + weight(s) * (shown(s) ? 1 : 0.6), 0);
  const raw = wTotal === 0 ? 0.5 : credit / wTotal; // a posting that names nothing known says nothing either way
  // an entry level job expects to train people: the specific skills weigh less there
  const coverage = ["Entry level", "Internship"].includes(levelOf(job).label) ? 0.35 + 0.65 * raw : raw;

  // the position: the best match between the job title and the role the person wants or any job they held
  const roles = [profile.jobTitle, ...(profile.jobHistory ?? []).map((j) => j.title)].map((r) => (r ?? "").trim()).filter(Boolean);
  const role = roles.length ? Math.max(...roles.map((r) => roleSimilarity(job.title, r))) : 0.5;

  // the experience the job asks for
  const level = levelFactor(job, yearsFor(profile));

  // the education the job asks for
  const asksDegree = DEGREE.test(`${job.title} ${body}`) && !NO_DEGREE.test(body);
  const hasDegree = (profile.education ?? []).some((e) => (e.degree ?? "").trim() || (e.school ?? "").trim());
  const education = !asksDegree ? 1 : hasDegree ? 1 : 0.4;

  // what the resume says (not only lists): the job's keywords that the person has, plus the ones the review asked to work in
  const narrativeNow = narrativeText(profile);
  // (a skill the person just confirmed for this job is not held against the number for not being in a bullet yet: confirming can only raise it)
  const keywords = Array.from(new Set([...gap.matched.filter((m) => weight(m) === 1 && !extra.some((e) => covers(e, m))), ...targets].map((t) => t.trim()).filter(Boolean)));
  const narrative = keywords.length === 0 ? 0.5 : keywords.filter((t) => saysTerm(narrativeNow, t)).length / keywords.length;

  // (the look the person chose is not part of how well they fit a job: the same number whatever the look)
  const basics = basicsKnown ?? profileBasics(profile);
  // the job decides 90% (position, requirements, experience, education and the keywords the resume says); how well the resume is
  // written (what "Fix all" improves) is 10%
  // the experience the job asks for scales the whole number (like in the list's first estimate): a Staff job for someone with two years
  // is not "78% ready" because the title looks alike
  // The number has to tell a good fit from a bad one, not sit around the same middle value for every job:
  //  - what decides is the position (45%), the skills the job asks for (40%) and, when the job names keywords the person has, whether the
  //    resume SAYS them (15%);
  //  - a posting that names no skills says nothing about them, but that is no reason to give credit to a job that is not the person's field:
  //    the unknown counts half of the position's match, so an unrelated job gets nothing from what is not known;
  //  - the education and how well the resume is written only adjust the result (a missing degree the job asks for, a resume that can improve),
  //    they are not points every job gets.
  const coverageNow = wTotal === 0 ? 0.5 * role : coverage;
  const core = (0.45 * role + 0.4 * coverageNow + (keywords.length > 0 ? 0.15 * narrative : 0)) / (keywords.length > 0 ? 1 : 0.85);
  const base = core * (0.7 + 0.3 * education) * (0.85 + 0.15 * (basics / 100));
  // A job far BELOW the person is not a good fit either: an internship or an entry level job for someone with years of experience.
  const myYears = yearsFor(profile);
  const jobLabel = levelOf(job).label;
  const over = jobLabel === "Internship" ? (myYears >= 2 ? 0.5 : 1) : jobLabel === "Entry level" ? (myYears >= 5 ? 0.7 : myYears >= 3 ? 0.85 : 1) : 1;
  const score = Math.round(100 * base * (0.35 + 0.65 * level) * over);
  return {
    score: Math.max(0, Math.min(100, score)),
    skills: { have, total },
    basics: Math.round(basics),
    level: Math.round(100 * level),
    role: Math.round(100 * role),
    education: Math.round(100 * education),
    narrative: Math.round(100 * narrative),
  };
}
