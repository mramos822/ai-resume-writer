// How much experience a job asks for, so people are not shown roles they are far from qualifying for.
import type { JobListing } from "@/lib/jobSearch";
import type { Seniority } from "@/lib/jobFacts";

export interface JobLevel {
  /** the label to show, when the level is clear: "Senior", "Lead", "Entry level"... */
  label: string;
  /** years of experience the job asks for (stated in the posting, or typical for its level) */
  years: number;
}

const WORDS = (s: string) => s.toLowerCase();

/** The text without its "preferred / a plus / nice to have" part: what is only a plus is not what the job asks for. */
export function withoutPlus(text: string): string {
  const mark = /^[ \t#*-]*(a plus|preferred qualifications?|preferred|nice[- ]to[- ]have|bonus points?|desirable|pluses|good to have)\b[^\n]{0,40}:?\s*$/i;
  const heading = /^(##\s|[ \t]*(about the (job|role|company|team)|responsibilities|what you('| wi)ll do|what they offer|benefits|minimum qualifications|requirements)\b)/i;
  const bullet = /^\s*([-•*]|\d+[.)])\s/;
  const lines = text.split("\n");
  const out: string[] = [];
  for (let i = 0; i < lines.length; ) {
    if (!mark.test(lines[i])) {
      out.push(lines[i++]);
      continue;
    }
    // only what sits right under the heading is "a plus": its block, then the bullet list that follows (and the blank lines between); a later
    // paragraph or list ("Requirements: 10+ years...") belongs to the job and stays
    i++;
    while (i < lines.length && lines[i].trim() !== "" && !heading.test(lines[i])) i++;
    while (i < lines.length && (lines[i].trim() === "" || bullet.test(lines[i])) && !heading.test(lines[i])) i++;
  }
  return out.join("\n");
}

/**
 * Years of experience the posting states ("5+ years of experience", "3-5 years", "3+ years of professional full-stack development
 * experience", "at least 4 years' hands-on Python experience"): the largest number it asks for as a requirement (a posting that wants "8 years of software development" and "1 year of mobile" asks for 8; what is only a plus does not count). Up to six plain words may sit between
 * "years" and "experience" (no punctuation: a full stop ends the sentence, so "10 years of growth. Experience..." is not a requirement).
 */
function statedYears(text: string): number | null {
  const t = WORDS(withoutPlus(text));
  let best: number | null = null;
  const re = /(\d{1,2})\s*(?:\+|plus)?\s*(?:-|–|to)?\s*(?:\d{1,2})?\s*(?:\+)?\s*years?(?:['’]s)?\s*(?:of\s+|in\s+)?(?:[\w+#/'’-]+\s+){0,6}?(?:experience|exp)\b/g;
  for (const m of t.matchAll(re)) {
    const n = Number(m[1]);
    if (n > 0 && n <= 20) best = best === null ? n : Math.max(best, n);
  }
  return best;
}

/** The level of a listing from its title, and the years it asks for. */
const FROM_FACTS: Record<Exclude<Seniority, "unspecified">, { label: string; typical: number }> = {
  intern: { label: "Internship", typical: 0 },
  entry: { label: "Entry level", typical: 0 },
  mid: { label: "Mid level", typical: 3 },
  senior: { label: "Senior", typical: 5 },
  staff: { label: "Principal", typical: 8 },
  principal: { label: "Principal", typical: 8 },
  lead: { label: "Lead", typical: 6 },
  manager: { label: "Manager", typical: 6 },
  director: { label: "Director", typical: 10 },
};

export function levelOf(job: Pick<JobListing, "title" | "description" | "snippet" | "facts">): JobLevel {
  const rules = levelByRules(job);
  const f = job.facts;
  if (!f) return rules;
  // what the AI read from the whole posting wins over the rules: its level, and the years it found (or the usual ones for that level)
  const known = f.seniority === "unspecified" ? null : FROM_FACTS[f.seniority];
  const label = known?.label ?? rules.label;
  const years = label === "Entry level" || label === "Internship" ? Math.min(f.years ?? 0, 2) : f.years ?? (known ? known.typical : rules.years);
  return { label, years };
}

function levelByRules(job: Pick<JobListing, "title" | "description" | "snippet">): JobLevel {
  const title = WORDS(job.title);
  const stated = statedYears(`${job.description ?? ""} ${job.snippet ?? ""}`);
  let label = "";
  let typical = 0;
  if (/\b(intern|internship|trainee|apprentice|working student|werkstudent)\b/.test(title)) {
    label = "Internship";
    typical = 0;
  } else if (/\b(entry[- ]level|early[- ]career|early[- ]talent|junior|jr\.?|graduate|undergraduate|undergrad|new[- ]?grad|recent grad|university|campus|student|co-?op|placement|apprentice|associate)\b/.test(title) || /\b(engineer|developer|analyst|designer|scientist)\s+(i|1)\b/.test(title)) {
    label = "Entry level";
    typical = 0;
  } else if (/\b(chief|vp|vice president|head of|director)\b/.test(title)) {
    label = "Director";
    typical = 10;
  } else if (/\b(principal|staff|architect)\b/.test(title)) {
    label = "Principal";
    typical = 8;
  } else if (/\b(senior|sr\.?)\s+(?:[\w&/,-]+\s+){1,3}manager\b/.test(title) && !/\b(engineering|software|technical|data|it|group|general|head)\b/.test(title)) {
    // "Senior Product Manager" is a senior individual role; a "Senior Manager" (the two words together) is the step above a manager
    label = "Senior";
    typical = 5;
  } else if (/\b(lead|manager)\b/.test(title)) {
    label = /manager/.test(title) ? "Manager" : "Lead";
    // "Product Manager", "Account Manager", "Marketing Manager" are mid level roles; the manager of engineers, data, IT or a group is a senior one
    typical = /manager/.test(title) && !/\b(engineering|software|technical|data|it|group|general|senior|sr\.?|lead|head)\b/.test(title) ? 3 : 6;
  } else if (/\b(senior|sr\.?)\b/.test(title)) {
    label = "Senior";
    typical = 5;
  } else if (/\b(iii|iv|v)\b|\b[a-z]+\s+(3|4)\s*$/.test(title)) {
    // "Software Engineer III": the third rung of the ladder is a senior role (IV and above, more so)
    label = "Senior";
    typical = /\b(iv|v)\b|\s4\s*$/.test(title) ? 7 : 5;
  } else if (/\b(ii)\b|\b[a-z]+\s+2\s*$/.test(title)) {
    label = "Mid level";
    typical = 3;
  }
  // when the posting states the years, that is what counts; the title gives the usual number otherwise.
  // An entry level job never asks for more than a couple of years (a number elsewhere in the text is about other roles or "nice to have")
  // A years figure in the text can be about one tool ("2 years of Python"): a Senior, Staff or Director title never asks for less than two years
  // below its usual number.
  const years = label === "Entry level" || label === "Internship" ? Math.min(stated ?? 0, 2) : stated === null ? typical : Math.max(stated, Math.max(typical - 2, 0));
  return { label, years };
}

/** True when the job asks for clearly more experience than the person has (more than a year of difference). */
export function aboveLevel(job: Pick<JobListing, "title" | "description" | "snippet" | "facts">, myYears: number): boolean {
  return levelOf(job).years > myYears + 1;
}
