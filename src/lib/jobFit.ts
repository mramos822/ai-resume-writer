import type { JobListing } from "@/lib/jobSearch";
import { EN, type Tr } from "@/i18n/translate";
import { levelOf } from "@/lib/jobLevel";
import { baseSkills, covers, mentionedSkills } from "@/lib/jobSkills";
import { resumeText } from "@/lib/roleProfile";
import type { ProfileData } from "@/context/profileContext";

/**
 * How much the level of the job lowers the fit: nothing when it asks for the experience the person has (or one year more),
 * then half for each extra year. A person without experience gets very low fits for senior jobs.
 */
export function levelFactor(job: Pick<JobListing, "title" | "description" | "snippet" | "facts">, myYears: number): number {
  const gap = levelOf(job).years - myYears;
  return gap <= 1 ? 1 : Math.max(0.1, 0.5 ** (gap - 1));
}

// Words of a job title that say the level or the place, not the kind of work, and the words that mean the same kind of work.
const LEVEL_WORDS = new Set(["senior", "sr", "junior", "jr", "lead", "principal", "staff", "intern", "internship", "associate", "early", "career", "entry", "level", "new", "grad", "graduate", "university", "campus", "remote", "hybrid", "full", "time", "part", "contract", "i", "ii", "iii", "iv", "1", "2", "3", "the", "and", "of", "for", "a", "an", "in", "at", "to", "with"]);
const SAME_WORK: Record<string, string> = { developer: "engineer", engineer: "engineer", programmer: "engineer", swe: "engineer", sde: "engineer", coder: "engineer", engineering: "engineer", development: "engineer", software: "software", web: "software", application: "software", applications: "software", platform: "software", mobile: "software", app: "software" };

/** The kind of work a title says, as a set of words ("Full Stack Developer" and "Software Engineer" are the same: software, engineer). */
function workWords(title: string): Set<string> {
  const t = title.toLowerCase().replace(/full[\s-]?stack|front[\s-]?end|back[\s-]?end/g, " software ");
  const out = new Set<string>();
  for (const w of t.split(/[^a-z0-9+#]+/)) {
    if (w.length < 1 || LEVEL_WORDS.has(w)) continue;
    out.add(SAME_WORK[w] ?? w);
  }
  return out;
}

/** 0 to 1: how much the role the person wants is the kind of work of the job title. Unknown when the person has no role. */
export function roleSimilarity(jobTitle: string, role: string): number {
  const want = workWords(role);
  if (want.size === 0) return 0.5;
  const have = workWords(jobTitle);
  let hit = 0;
  for (const w of want) if (have.has(w)) hit++;
  return hit / want.size;
}

/**
 * The skills of a person for the fit with a job: the ones in their list plus the ones their resume shows in a job, a project or a study
 * without being in the list. Every place that shows a fit uses this, so the number is the same in the search, in the job and when
 * its resume is made.
 */
export function skillsForFit(p: ProfileData): string[] {
  const listed = (p.skills ?? []).filter(Boolean);
  const shown = mentionedSkills(resumeText(p)).filter((s) => !listed.some((l) => covers(l, s)));
  return [...listed, ...shown];
}

/**
 * How well a listing fits the profile (0 to 100). Half is the kind of work (the role the person wants against the job title, with
 * synonyms), half is how many of the skills the posting names the person has (the whole posting is read, not only its first lines).
 * It is lowered a lot when the job asks for much more experience than the person has (`myYears`, when known).
 * `matched` are the skills of the person that the posting mentions.
 */
export function fitOf(job: JobListing, skills: string[], role: string, myYears?: number): { pct: number; matched: string[] } {
  const text = `${job.title} ${job.tags.join(" ")} ${job.description || job.snippet}`;
  const hay = text.toLowerCase();
  // a skill counts when the job names it or the skill it is built on ("GitHub Actions" counts for a job that asks for GitHub)
  const clean = (s: string) => s.toLowerCase().replace(/[()]/g, "").trim();
  const matched = skills.filter((s) => s.trim() && [s, ...baseSkills(s)].some((t) => hay.includes(clean(t))));
  const named = mentionedSkills(text);
  const covered = named.filter((n) => skills.some((s) => covers(s, n))).length;
  // what the posting names and the person has; when the posting names nothing known, the skills of the person it mentions
  const skillRaw = named.length > 0 ? covered / named.length : skills.length ? Math.min(1, matched.length / 3) : 0;
  // an entry level job (early career, new grad, internship) expects to train people: the specific skills weigh less there
  const entry = ["Entry level", "Internship"].includes(levelOf(job).label);
  const skillPart = entry ? 0.35 + 0.65 * skillRaw : skillRaw;
  const roleHit = roleSimilarity(job.title, role);
  const base = 100 * (0.5 * roleHit + 0.5 * skillPart);
  const pct = Math.round(base * (myYears === undefined ? 1 : levelFactor(job, myYears)));
  return { pct: Math.max(0, Math.min(100, pct)), matched: matched.slice(0, 5) };
}

export const ago = (iso: string, tr: Tr = EN) => {
  const t = +new Date(iso);
  if (!t) return "";
  const days = Math.floor((Date.now() - t) / 86_400_000);
  if (days <= 0) return tr("Today");
  if (days === 1) return tr("Yesterday");
  if (days < 30) return tr("{days} days ago", { days });
  const m = Math.floor(days / 30);
  return m > 1 ? tr("{m} months ago", { m }) : tr("{m} month ago", { m });
};
