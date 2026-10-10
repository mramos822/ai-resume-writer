// How much experience a job asks for, so people are not shown roles they are far from qualifying for.
import type { JobListing } from "@/lib/jobSearch";

export interface JobLevel {
  /** the label to show, when the level is clear: "Senior", "Lead", "Entry level"... */
  label: string;
  /** years of experience the job asks for (stated in the posting, or typical for its level) */
  years: number;
}

const WORDS = (s: string) => s.toLowerCase();

/** Years of experience the posting states ("5+ years of experience", "3-5 years"): the smallest number it asks for. */
function statedYears(text: string): number | null {
  const t = WORDS(text);
  let best: number | null = null;
  const re = /(\d{1,2})\s*(?:\+|plus)?\s*(?:-|–|to)?\s*(?:\d{1,2})?\s*(?:\+)?\s*years?(?:['’]s)?\s*(?:of\s+)?(?:relevant\s+|professional\s+|related\s+|hands-on\s+|work\s+|industry\s+|proven\s+)*(?:experience|exp)/g;
  for (const m of t.matchAll(re)) {
    const n = Number(m[1]);
    if (n > 0 && n <= 20) best = best === null ? n : Math.min(best, n);
  }
  return best;
}

/** The level of a listing from its title, and the years it asks for. */
export function levelOf(job: Pick<JobListing, "title" | "description" | "snippet">): JobLevel {
  const title = WORDS(job.title);
  const stated = statedYears(`${job.description ?? ""} ${job.snippet ?? ""}`);
  let label = "";
  let typical = 0;
  if (/\b(intern|internship|trainee|apprentice|working student|werkstudent)\b/.test(title)) {
    label = "Internship";
    typical = 0;
  } else if (/\b(entry[- ]level|junior|jr\.?|graduate|new grad|associate)\b/.test(title)) {
    label = "Entry level";
    typical = 0;
  } else if (/\b(chief|vp|vice president|head of|director)\b/.test(title)) {
    label = "Director";
    typical = 10;
  } else if (/\b(principal|staff|architect)\b/.test(title)) {
    label = "Principal";
    typical = 8;
  } else if (/\b(lead|manager)\b/.test(title)) {
    label = /manager/.test(title) ? "Manager" : "Lead";
    typical = 6;
  } else if (/\b(senior|sr\.?)\b/.test(title)) {
    label = "Senior";
    typical = 5;
  }
  // when the posting states the years, that is what counts; the title gives the usual number otherwise
  return { label, years: stated ?? typical };
}

/** True when the job asks for clearly more experience than the person has (more than a year of difference). */
export function aboveLevel(job: Pick<JobListing, "title" | "description" | "snippet">, myYears: number): boolean {
  return levelOf(job).years > myYears + 1;
}
