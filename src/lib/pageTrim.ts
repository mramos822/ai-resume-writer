// Makes a resume pass the page filter (see pageRules) by taking out, step by step, the least useful for the job, measuring after each
// step and stopping as soon as it passes. The order is the one a recruiter would choose: first the detail of old jobs, then the skills
// that are surely not needed, then (when the list is long) the least necessary or repeated ones, then the oldest jobs, and only then
// the bullets of the recent ones. The 3 most recent jobs always stay.
// It works on a copy: the saved profile is never changed.
import type { ProfileData, JobEntry } from "@/context/profileContext";
import type { ResumeLang } from "@/lib/dateFormat";
import type { JobListing } from "@/lib/jobSearch";
import { renderResumeDetailed } from "@/lib/pdfResume";
import { cutSuggestions } from "@/lib/applicationCoach";
import { MIN_RECENT_JOBS, newestFirst } from "@/lib/reviewRubric";
import { passesPage } from "@/lib/pageRules";

export interface TrimStep {
  id: "olderBullets" | "recentBullets" | "skills" | "reviewSkills" | "job" | "fewBullets";
  /** how many things the step took out (skills) */
  n?: number;
  /** the job a step took out */
  title?: string;
}

const cap = (p: ProfileData, which: (j: JobEntry) => boolean, max: number): ProfileData => ({
  ...p,
  jobHistory: (p.jobHistory ?? []).map((j) => (which(j) && (j.accomplishments?.length ?? 0) > max ? { ...j, accomplishments: j.accomplishments.slice(0, max) } : j)),
});
const same = (a: ProfileData, b: ProfileData) => JSON.stringify(a.jobHistory) === JSON.stringify(b.jobHistory) && JSON.stringify(a.skills) === JSON.stringify(b.skills);

export async function trimToFit(profile: ProfileData, job: JobListing, template: string, lang: ResumeLang, keep: string[] = []): Promise<{ profile: ProfileData; steps: TrimStep[]; passes: boolean }> {
  const fits = async (p: ProfileData) => {
    try {
      const r = await renderResumeDetailed(p, template, { lang });
      return passesPage({ pages: r.pages, scale: r.scale, maxPages: r.maxPages });
    } catch {
      return true; // if it cannot be measured it is left as it is
    }
  };
  let cur = profile;
  const steps: TrimStep[] = [];
  if (await fits(cur)) return { profile: cur, steps, passes: true };

  const recent = new Set(newestFirst(cur.jobHistory ?? []).slice(0, MIN_RECENT_JOBS).map((j) => j.id));
  const attempt = async (next: ProfileData, step: TrimStep): Promise<boolean> => {
    if (same(next, cur)) return false;
    cur = next;
    steps.push(step);
    return fits(cur);
  };

  // 1. the detail of the old jobs: two bullets each
  if (await attempt(cap(cur, (j) => !recent.has(j.id), 2), { id: "olderBullets" })) return { profile: cur, steps, passes: true };
  // 2. at most four bullets in the recent jobs
  if (await attempt(cap(cur, (j) => recent.has(j.id), 4), { id: "recentBullets" })) return { profile: cur, steps, passes: true };
  // 3. the skills the job does not need (never fewer than 20, and never the ones the person confirmed)
  const out = cutSuggestions(cur, job, keep).skills;
  if (out.length > 0) {
    const gone = new Set(out.map((x) => x.toLowerCase()));
    if (await attempt({ ...cur, skills: (cur.skills ?? []).filter((x) => !gone.has(x.toLowerCase())) }, { id: "skills", n: out.length })) return { profile: cur, steps, passes: true };
  }
  // 3b. a long list of skills (more than LONG_SKILL_LIST): the ones that repeat another or are the least necessary for this job, in rounds
  // (a few at a time) until the page passes or the list is down to LONG_SKILL_LIST
  let took = 0;
  for (let round = 0; round < 6; round++) {
    const least = cutSuggestions(cur, job, keep).review.map((r) => r.skill);
    if (least.length === 0) break;
    const gone = new Set(least.map((x) => x.toLowerCase()));
    took += least.length;
    const next = { ...cur, skills: (cur.skills ?? []).filter((x) => !gone.has(x.toLowerCase())) };
    const stepsBefore = steps.length;
    const fitsNow = await attempt(next, { id: "reviewSkills", n: took });
    // one step in the list for all the rounds: it says how many skills went in total
    if (steps.length - stepsBefore > 0 && stepsBefore > 0 && steps[stepsBefore - 1].id === "reviewSkills") steps.splice(stepsBefore - 1, 1);
    if (fitsNow) return { profile: cur, steps, passes: true };
  }
  // 4. the oldest jobs, one at a time (the 3 most recent stay)
  for (const j of newestFirst(cur.jobHistory ?? []).slice(MIN_RECENT_JOBS).reverse()) {
    if (await attempt({ ...cur, jobHistory: (cur.jobHistory ?? []).filter((x) => x.id !== j.id) }, { id: "job", title: j.title })) return { profile: cur, steps, passes: true };
  }
  // 5. last: three bullets in the recent jobs
  const done = await attempt(cap(cur, () => true, 3), { id: "fewBullets" });
  return { profile: cur, steps, passes: done };
}
