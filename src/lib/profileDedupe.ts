// Merges repeated entries of a profile (same job, school, skill or language), keeping the most complete copy of each.
import type { ProfileData, JobEntry, EducationEntry } from "@/context/profileContext";
import type { LanguageEntry } from "@/lib/languages";

const norm = (s?: string) => (s ?? "").toLowerCase().replace(/\s+/g, " ").trim();

// Words that say nothing about WHICH job or school it is
const GENERIC_JOB_WORDS = new Set([
  "inc", "llc", "ltd", "corp", "corporation", "company", "self", "employed", "selfemployed", "freelance", "the", "and",
  "associate", "assistant", "manager", "sales", "engineer", "software", "developer", "intern", "internship", "driver",
  "barista", "cashier", "server", "clerk", "worker", "team", "member", "lead", "senior", "junior", "remote", "full", "time", "part",
]);
const GENERIC_SCHOOL_WORDS = new Set(["university", "college", "institute", "of", "the", "and", "county", "community", "state", "school", "at", "in"]);

const words = (s?: string) => norm(s).replace(/[^a-z0-9]+/g, " ").split(" ").filter(Boolean);
const jobWords = (j: JobEntry) => new Set([...words(j.title), ...words(j.company)].filter((w) => w.length >= 4 && !GENERIC_JOB_WORDS.has(w)));

/** Same job, even when the company or title is written a little differently (same start date and a shared name). */
function sameJob(a: JobEntry, b: JobEntry): boolean {
  if (norm(a.title) === norm(b.title) && norm(a.company) === norm(b.company) && (a.startDate ?? "") === (b.startDate ?? "")) return true;
  if (!a.startDate || a.startDate !== b.startDate) return false;
  const wa = jobWords(a);
  for (const w of jobWords(b)) if (wa.has(w)) return true;
  return false;
}

/** "New Jersey Institute of Technology, Newark, NJ" and "New Jersey Institute of Technology" are the same school. */
const schoolKey = (school?: string) =>
  words((school ?? "").split(",")[0])
    .filter((w) => !GENERIC_SCHOOL_WORDS.has(w))
    .join(" ");

function degreeLevel(d?: string): string {
  const t = norm(d);
  if (/\b(ph\.?d|doctor)/.test(t)) return "d";
  if (/\b(m\.?s|m\.?a|master|mba)\b/.test(t)) return "m";
  if (/\b(b\.?s|b\.?a|bachelor)\b/.test(t)) return "b";
  if (/\b(a\.?s|a\.?a|a\.?a\.?s|associate)\b/.test(t)) return "a";
  return "";
}

/** Same school, and not two different degrees (a B.S. and an M.S. at one school are both kept). */
function sameEdu(a: EducationEntry, b: EducationEntry): boolean {
  const ka = schoolKey(a.school);
  if (!ka || ka !== schoolKey(b.school)) return false;
  const la = degreeLevel(a.degree);
  const lb = degreeLevel(b.degree);
  return !la || !lb || la === lb;
}

const filled = (...v: (string | undefined)[]) => v.filter((x) => (x ?? "").trim()).length;

function mergeJobs(a: JobEntry, b: JobEntry): JobEntry {
  const score = (j: JobEntry) => (j.accomplishments?.length ?? 0) * 3 + filled(j.title, j.company, j.location, j.description, j.startDate, j.endDate);
  const [base, other] = score(a) >= score(b) ? [a, b] : [b, a];
  const seen = new Set<string>();
  const bullets = [...(base.accomplishments ?? []), ...(other.accomplishments ?? [])].filter((x) => {
    const k = norm(x);
    if (!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  return {
    ...base,
    title: base.title || other.title,
    company: base.company || other.company,
    location: base.location || other.location,
    description: base.description || other.description,
    startDate: base.startDate || other.startDate,
    endDate: base.endDate || other.endDate,
    current: base.current ?? other.current,
    accomplishments: bullets,
  };
}

function mergeEdu(a: EducationEntry, b: EducationEntry): EducationEntry {
  const score = (e: EducationEntry) => filled(e.degree, e.location, e.startDate, e.endDate, e.gpa, e.honors, e.coursework);
  const [base, other] = score(a) >= score(b) ? [a, b] : [b, a];
  return {
    ...base,
    degree: base.degree || other.degree,
    location: base.location || other.location,
    startDate: base.startDate || other.startDate,
    endDate: base.endDate || other.endDate,
    gpa: base.gpa || other.gpa,
    honors: base.honors || other.honors,
    coursework: base.coursework || other.coursework,
  };
}

function collapse<T>(list: T[], same: (a: T, b: T) => boolean, merge: (a: T, b: T) => T): T[] {
  const out: T[] = [];
  for (const item of list) {
    const i = out.findIndex((x) => same(x, item));
    if (i === -1) out.push(item);
    else out[i] = merge(out[i], item);
  }
  return out;
}

/** Collapses repeated entries (the same job, school, skill or language) and keeps the most complete information of each. */
export function dedupeProfile(p: ProfileData): {
  patch: { jobHistory?: JobEntry[]; education?: EducationEntry[]; skills?: string[]; languages?: LanguageEntry[] };
  removed: number;
} {
  const patch: { jobHistory?: JobEntry[]; education?: EducationEntry[]; skills?: string[]; languages?: LanguageEntry[] } = {};
  let removed = 0;

  const jobs = collapse(p.jobHistory ?? [], sameJob, mergeJobs);
  if (jobs.length !== (p.jobHistory?.length ?? 0)) {
    removed += (p.jobHistory?.length ?? 0) - jobs.length;
    patch.jobHistory = jobs;
  }

  const edus = collapse(p.education ?? [], sameEdu, mergeEdu);
  if (edus.length !== (p.education?.length ?? 0)) {
    removed += (p.education?.length ?? 0) - edus.length;
    patch.education = edus;
  }

  const skills = new Map<string, string>();
  for (const s of p.skills ?? []) if (norm(s) && !skills.has(norm(s))) skills.set(norm(s), s);
  if (skills.size !== (p.skills?.length ?? 0)) {
    removed += (p.skills?.length ?? 0) - skills.size;
    patch.skills = Array.from(skills.values());
  }

  const langs = new Map<string, LanguageEntry>();
  for (const l of p.languages ?? []) if (norm(l.name) && !langs.has(norm(l.name))) langs.set(norm(l.name), l);
  if (langs.size !== (p.languages?.length ?? 0)) {
    removed += (p.languages?.length ?? 0) - langs.size;
    patch.languages = Array.from(langs.values());
  }
  return { patch, removed };
}

