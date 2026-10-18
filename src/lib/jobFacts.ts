// What the AI read out of a posting, once: the years it asks for, its level and the skills it requires or only prefers. It travels with the
// job (saved jobs, applications) so every screen shows the same fit. No server code here: the page imports it too.

export const SENIORITY = ["intern", "entry", "mid", "senior", "staff", "principal", "lead", "manager", "director", "unspecified"] as const;
export type Seniority = (typeof SENIORITY)[number];

export interface JobFacts {
  /** the years of professional experience the job asks for in total (the largest overall figure), null when it states none */
  years: number | null;
  seniority: Seniority;
  /** specific skills the job requires (tools, languages, platforms...) */
  required: string[];
  /** skills that are only a plus */
  preferred: string[];
}

const names = (v: unknown, n: number): string[] => {
  const out: string[] = [];
  for (const x of Array.isArray(v) ? v : []) {
    const s = typeof x === "string" ? x.trim().slice(0, 60) : "";
    if (s.length >= 2 && !out.some((o) => o.toLowerCase() === s.toLowerCase())) out.push(s);
    if (out.length >= n) break;
  }
  return out;
};

/** The facts in the shape stored with a job; undefined when there is nothing usable (then the fit is read from the text by rules). */
export function cleanFacts(v: unknown): JobFacts | undefined {
  if (!v || typeof v !== "object") return undefined;
  const o = v as Record<string, unknown>;
  const yearsRaw = typeof o.years === "number" ? o.years : typeof o.yearsRequired === "number" ? o.yearsRequired : null;
  const years = yearsRaw !== null && Number.isFinite(yearsRaw) && yearsRaw > 0 && yearsRaw <= 25 ? Math.round(yearsRaw) : null;
  const sen = String(o.seniority ?? "").toLowerCase().trim();
  const seniority = (SENIORITY as readonly string[]).includes(sen) ? (sen as Seniority) : "unspecified";
  const required = names(o.required ?? o.skillsRequired, 20);
  const preferred = names(o.preferred ?? o.skillsPreferred, 12).filter((p) => !required.some((r) => r.toLowerCase() === p.toLowerCase()));
  // an answer with no years, no level and no skills says nothing: the rules read the text instead
  if (years === null && seniority === "unspecified" && required.length === 0) return undefined;
  return { years, seniority, required, preferred };
}
