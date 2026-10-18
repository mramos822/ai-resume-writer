// A resume is written for a kind of role, never for one employer: the objective and the bullets must not name the company being applied to
// (an ATS can read it as an employer of the person, and the resume stops being usable for any other job). Only the cover letter names it.

const LEGAL = /\b(inc|llc|ltd|corp|corporation|co|company|gmbh|plc|lp|llp|group|holdings)\b\.?/gi;

/** The name to look for: the company without its legal ending ("Acme Inc." is "Acme"). Empty when it is too short or generic to search. */
export function employerCore(company: string): string {
  const core = (company ?? "").replace(LEGAL, " ").replace(/[,.]/g, " ").replace(/\s+/g, " ").trim();
  return core.length >= 3 ? core : "";
}

const esc = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** True when the text names the company (as a whole word or phrase, any case). */
export function namesEmployer(text: string, company: string): boolean {
  const core = employerCore(company);
  if (!core) return false;
  return new RegExp(`(^|[^\\p{L}\\p{N}])${esc(core)}($|[^\\p{L}\\p{N}])`, "iu").test(text);
}

/** The text without the sentences that name the company (the rest is kept as it is). */
export function withoutEmployer(text: string, company: string): string {
  if (!namesEmployer(text, company)) return text;
  // a sentence ends at . ! or ? followed by a capital letter ("Acme Inc. today" is one sentence)
  const sentences = text.split(/(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÑ0-9"])/);
  return sentences.filter((x) => !namesEmployer(x, company)).join(" ").trim();
}
