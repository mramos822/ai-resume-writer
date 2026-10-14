// The level of a person (entry level, junior, mid-level or senior). Kaizo guesses it from the profile and the person confirms it:
// the confirmed level is what filters the job search and ranks the fit, so nobody depends on the dates of their jobs being exact.
import type { ProfileData } from "@/context/profileContext";
import { seniorityOf } from "@/lib/reviewRubric";

export const LEVELS = ["entry", "junior", "mid", "senior"] as const;
export type Level = (typeof LEVELS)[number];

export const LEVEL_LABEL: Record<Level, string> = { entry: "Entry level", junior: "Junior", mid: "Mid-level", senior: "Senior" };

/** The years of experience a level stands for, used to compare with what a job asks for. */
export const LEVEL_YEARS: Record<Level, number> = { entry: 0, junior: 1, mid: 4, senior: 8 };

export const asLevel = (v: unknown): Level | null => (LEVELS as readonly string[]).includes(String(v)) ? (v as Level) : null;

const SENIOR_TITLE = /\b(senior|sr\.?|lead|principal|staff|head of|manager|director|architect)\b/i;
const ENTRY_TITLE = /\b(intern|internship|trainee|apprentice|assistant|graduate)\b/i;

export interface LevelGuess {
  level: Level;
  /** years the jobs add up to */
  years: number;
  /** why, as a sentence with {years} / {title} to fill in */
  reason: string;
  title?: string;
}

/** What Kaizo thinks the level is, from the jobs listed (their length and the titles). */
export function inferLevel(p: ProfileData): LevelGuess {
  const years = seniorityOf(p).years;
  const titles = [...(p.jobHistory ?? []), ...(p.internships ?? [])].map((j) => j.title ?? "").filter(Boolean);
  const senior = titles.find((t) => SENIOR_TITLE.test(t));
  if (senior && years >= 3) return { level: "senior", years, title: senior, reason: "One of your jobs is “{title}” and your jobs add up to about {years} years." };
  if ((p.jobHistory ?? []).length === 0 || (titles.length > 0 && titles.every((t) => ENTRY_TITLE.test(t)))) {
    return { level: "entry", years, reason: "You have little or no work experience listed yet." };
  }
  if (years < 1) return { level: "entry", years, reason: "Your jobs add up to less than a year." };
  if (years < 2.5) return { level: "junior", years, reason: "Your jobs add up to about {years} years." };
  if (years < 6) return { level: "mid", years, reason: "Your jobs add up to about {years} years." };
  return { level: "senior", years, reason: "Your jobs add up to about {years} years." };
}

/** True when the level a posting states (its label: "Entry level", "Senior", "Lead"...) is the level of the person. */
export function levelMatchesJob(level: Level, jobLabel: string): boolean {
  if (!jobLabel) return false;
  if (level === "entry") return /entry|intern/i.test(jobLabel);
  if (level === "junior") return /entry/i.test(jobLabel);
  if (level === "senior") return /senior|lead|principal|director|manager/i.test(jobLabel);
  return false;
}

/** The years to compare with a job: those of the level the person confirmed, or else the ones their jobs add up to. */
export function yearsFor(p: ProfileData): number {
  const level = asLevel(p.experienceLevel);
  return level ? LEVEL_YEARS[level] : seniorityOf(p).years;
}
