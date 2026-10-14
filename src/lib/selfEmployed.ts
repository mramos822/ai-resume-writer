// A job done for oneself (freelance, own business). It has no employer, so the resume shows "Self-employed" where the company goes,
// or the name of the person's own business when they give one.
const SELF = /^\s*(self[- ]?employed|freelance(r)?|independent( contractor)?|aut[oó]nomo|independiente|trabajador independiente)\s*$/i;

/** True when the text of a company field only says that the person worked for themselves. */
export const isSelfEmployedName = (company?: string): boolean => SELF.test(company ?? "");

// a line that starts by saying it ("Self-employed work scheduled around classes", "Freelance web developer for local shops")
const SELF_START = /^\s*[•\-*–—·]?\s*(self[- ]?employed|freelanc(e|er|ing)|independent contractor|aut[oó]nomo|trabajador independiente|trabajo independiente|por cuenta propia)\b/i;
// a title that says it ("Freelance Web Developer", "Independent Contractor")
const SELF_TITLE = /\b(freelanc(e|er|ing)|self[- ]?employed|independent contractor|aut[oó]nomo)\b/i;

interface SelfJob {
  title?: string;
  company?: string;
  description?: string;
  accomplishments?: string[];
  selfEmployed?: boolean;
}

/**
 * Whether a job was done for oneself. What the person marked wins (true or false). Otherwise it is recognised by the company
 * ("Self-employed", "Freelance"), by a title that says it, or by the intro or the first bullets starting with it.
 */
export function detectSelfEmployed(j: SelfJob): boolean {
  if (typeof j.selfEmployed === "boolean") return j.selfEmployed;
  if (isSelfEmployedName(j.company) || SELF_TITLE.test(j.title ?? "")) return true;
  const lines = [j.description ?? "", ...(j.accomplishments ?? []).slice(0, 2)];
  return lines.some((l) => SELF_START.test(l));
}

const WORD = { en: "Self-employed", es: "Autónomo" } as const;

/**
 * What a resume shows where the company goes for a job done for oneself: "Self-employed" when there is no business name, and
 * "Name (Self-employed)" when there is one. Any other job keeps its company as it is.
 */
export function companyLabel(j: SelfJob, lang: "en" | "es" = "en"): string {
  const company = (j.company ?? "").trim();
  if (!detectSelfEmployed(j)) return company;
  if (!company || isSelfEmployedName(company)) return WORD[lang];
  return `${company} (${WORD[lang]})`;
}

/** The profile with the company of its self-employed jobs written as they must read on a resume. */
export function withSelfEmployed<T extends { jobHistory?: SelfJob[]; internships?: SelfJob[] }>(p: T, lang: "en" | "es" = "en"): T {
  const fix = <J extends SelfJob>(list?: J[]) => (list ? list.map((j) => (detectSelfEmployed(j) ? { ...j, company: companyLabel(j, lang) } : j)) : list);
  return { ...p, jobHistory: fix(p.jobHistory), internships: fix(p.internships) } as T;
}
