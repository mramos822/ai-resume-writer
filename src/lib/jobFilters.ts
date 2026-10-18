// The filters a person chooses in the job search, and how a job passes them. Nothing here is decided for the person: the list shows what
// they choose (the order too), and says how many jobs the filters leave.
import { levelOf } from "@/lib/jobLevel";
import type { JobListing } from "@/lib/jobSearch";

export interface JobFilters {
  /** "recent": the most recent first, and among the ones of the same age the best fit; "fit": the best fit first */
  sort: "recent" | "fit";
  /** posted within this many days; 0 = any time */
  posted: 0 | 1 | 3 | 7 | 14 | 30;
  level: "any" | "entry" | "mid" | "senior";
  /** only jobs that say what they pay */
  pay: boolean;
  /** "auto": the language of the app (English; also Spanish when the app is in Spanish); "all": every language */
  lang: "auto" | "all";
}

export const NO_FILTERS: JobFilters = { sort: "recent", posted: 0, level: "any", pay: false, lang: "auto" };

const DAY = 24 * 60 * 60 * 1000;

/** Where a job is in experience: what it asks for (its years, its level). "unknown" when the posting says nothing about it. */
export function levelBand(job: Pick<JobListing, "title" | "description" | "snippet" | "facts">): "entry" | "mid" | "senior" | "unknown" {
  const l = levelOf(job);
  if (l.label === "Entry level" || l.label === "Internship") return "entry";
  if (!l.label && l.years === 0) return "unknown";
  return l.years >= 5 ? "senior" : l.years >= 2 ? "mid" : "entry";
}

/** True when the job passes the filters (the order and the language are not decided here). */
export function matchesFilters(job: JobListing, f: JobFilters, now: number = Date.now()): boolean {
  if (f.posted) {
    const t = Date.parse(job.postedAt);
    if (!t || now - t > f.posted * DAY) return false;
  }
  if (f.level !== "any") {
    const band = levelBand(job);
    // a job that says nothing about the experience it asks for can fit an entry or a mid level search, but not a senior one
    if (band === "unknown" ? f.level === "senior" : band !== f.level) return false;
  }
  if (f.pay && !job.salary) return false;
  return true;
}

/** How many filters are on (the order is not a filter). */
export const activeFilters = (f: JobFilters) => (f.posted ? 1 : 0) + (f.level !== "any" ? 1 : 0) + (f.pay ? 1 : 0) + (f.lang !== "auto" ? 1 : 0);
