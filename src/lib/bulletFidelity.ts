// A rewritten bullet may say the same thing better, but it must not say MORE: no tool or skill the job did not show and no number
// that was not there. The AI is told this in its prompt, and a small model sometimes ignores it, so it is also checked here, in code.
// A bullet that fails is replaced by the one the person wrote (same position), or left out when there was none.
import type { JobEntry } from "@/context/profileContext";
import { covers, mentionedSkills } from "@/lib/jobSkills";
import { suggestedGroup } from "@/lib/skillCategories";

/** Numbers of a text as written ("40%", "1,200", "3.5"): a year or a count counts like any other number. */
const numbersOf = (text: string): string[] => (text.match(/\d[\d.,]*%?/g) ?? []).map((n) => n.replace(/[.,]+$/, ""));

/** The text a job already says: what a rewrite may draw on. */
export function jobSource(j: Pick<JobEntry, "title" | "company" | "description" | "accomplishments">): string {
  return [j.title, j.company, j.description, ...(j.accomplishments ?? [])].filter(Boolean).join(" \n ");
}

/**
 * What is wrong with a bullet compared with what the job said (and what the person confirmed for it): the skills and the numbers
 * it adds. Empty when it only rewords. Soft skills ("teamwork") are not counted, because rewording often brings them.
 */
export function unsupportedIn(bullet: string, source: string, confirmed = ""): { skills: string[]; numbers: string[] } {
  const known = `${source} \n ${confirmed}`.toLowerCase();
  const knownSkills = mentionedSkills(known);
  const skills = mentionedSkills(bullet).filter((s) => {
    const group = suggestedGroup(s);
    if (group === "Soft skills") return false;
    if (known.includes(s.toLowerCase())) return false;
    return !knownSkills.some((k) => covers(k, s) || covers(s, k));
  });
  const knownNumbers = new Set(numbersOf(known));
  const numbers = numbersOf(bullet).filter((n) => !knownNumbers.has(n));
  return { skills, numbers };
}

/**
 * The proposed bullets of a job with every unfaithful one put back as the person wrote it (same position) or dropped when there was
 * no bullet there. `replaced` says how many were put back.
 */
export function faithfulBullets(job: Pick<JobEntry, "title" | "company" | "description" | "accomplishments">, proposed: string[], confirmed = ""): { bullets: string[]; replaced: number } {
  const source = jobSource(job);
  const original = job.accomplishments ?? [];
  let replaced = 0;
  const out: string[] = [];
  proposed.forEach((b, i) => {
    const bad = unsupportedIn(b, source, confirmed);
    if (bad.skills.length === 0 && bad.numbers.length === 0) {
      out.push(b);
      return;
    }
    replaced++;
    if (original[i]) out.push(original[i]);
  });
  return { bullets: out, replaced };
}
