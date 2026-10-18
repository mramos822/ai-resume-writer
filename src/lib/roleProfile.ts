// A professional rubric for ONE role: what recruiters and ATS in that field look for. The AI writes it once per role
// (cached, so every review of the same role uses the same standard). Today it describes a GENERAL resume for the role;
// the same shape can be built from a specific job posting later (job alerts), and then it describes that job instead.
import type { ProfileData } from "@/context/profileContext";

export interface RoleProfile {
  /** the role this rubric is for, as written */
  role: string;
  /** "general": a standard for the role. "job-ad": built from one specific posting. */
  source: "general" | "job-ad";
  field: string;
  /** terms ATS look for in this role (tools, technologies, methods) */
  keywords: string[];
  /** credentials or proof usually expected: degree, license, certification, portfolio… */
  requirements: string[];
  /** what a recruiter in this field checks first */
  priorities: string[];
  /** the kind of bullet that impresses in this role */
  evidence: string[];
}

export const ROLE_PROFILE_SYSTEM = `You are a senior recruiter and HR specialist. Given a job role (or a job posting), write the professional rubric used to judge a US resume for it.
Reply with ONE JSON object and nothing else:
{
  "field": "<the professional field in 1 to 3 words>",
  "keywords": [ 10 to 16 terms an applicant tracking system would search for in this role: tools, technologies, methods, standard role terms, written the usual way ],
  "requirements": [ 3 to 6 credentials or proofs normally expected (degree, license, certification, portfolio, clearance, years of experience...) ],
  "priorities": [ 3 to 5 things a recruiter in this field checks first in a quick scan ],
  "evidence": [ 3 to 5 examples of what a strong bullet looks like in this role (kind of result, scale, metric) ]
}
Rules: be specific to the role, not generic resume advice. Use plain, standard terms. No markdown, no emojis. If the input is a job posting, base every list on what that posting actually asks for and nothing else.`;

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const list = (v: unknown, max: number, len: number) =>
  (Array.isArray(v) ? v : []).map((x: unknown) => str(x, len)).filter(Boolean).slice(0, max);

/** Validates what the AI wrote. Returns null when it is unusable (too few keywords, wrong shape). */
export function cleanRoleProfile(input: unknown, role: string, source: RoleProfile["source"]): RoleProfile | null {
  if (!input || typeof input !== "object") return null;
  const r = input as Record<string, unknown>;
  const keywords = list(r.keywords, 16, 40);
  if (keywords.length < 5) return null;
  return {
    role,
    source,
    field: str(r.field, 40) || "general",
    keywords,
    requirements: list(r.requirements, 6, 120),
    priorities: list(r.priorities, 5, 120),
    evidence: list(r.evidence, 5, 140),
  };
}

/** "Software Engineer " and "software   engineer" are the same role for caching. */
export const roleKey = (role: string) => role.toLowerCase().replace(/[^a-z0-9+#.]+/g, " ").trim();

/** What the person is studying right now (a degree in progress), as a student headline: "Systems Engineering student". Empty when nothing is in progress. */
export function studentRoleOf(p: ProfileData): string {
  const e = (p.education ?? []).find((x) => x.current && x.degree?.trim());
  if (!e) return "";
  const field = e.degree.replace(/^(b\.?s\.?c?\.?|b\.?a\.?|m\.?s\.?c?\.?|bachelor('s)?( of| in)?( science| arts)?|master('s)?( of| in)?|hochschulstudium:?|studium:?)\s*/i, "").trim();
  return `${field || e.degree.trim()} student`;
}

/**
 * The role to judge against: the target job title the person wrote. Without one, what they are studying when a degree is in progress
 * (a student with a side job as a waiter is not aiming to be a waiter), else the most recent job's title. Empty when there is none.
 */
export function targetRoleOf(p: ProfileData): string {
  const t = p.jobTitle?.trim();
  if (t) return t;
  const studying = studentRoleOf(p);
  if (studying) return studying;
  return (p.jobHistory ?? []).find((j) => j.title?.trim())?.title.trim() ?? "";
}

/** Everything written on the resume, lower-cased, for matching keywords. */
export function resumeText(p: ProfileData): string {
  return [
    p.careerObjective,
    ...(p.skills ?? []),
    ...(p.jobHistory ?? []).flatMap((j) => [j.title, j.description, ...(j.accomplishments ?? [])]),
    ...(p.internships ?? []).flatMap((j) => [j.title, j.description, ...(j.accomplishments ?? [])]),
    ...(p.projects ?? []).flatMap((x) => [x.name, x.description, ...(x.technologies ?? []), ...(x.accomplishments ?? [])]),
    ...(p.education ?? []).flatMap((e) => [e.degree, e.coursework]),
    ...(p.certifications ?? []).map((c) => c.name),
  ]
    .join(" \n ")
    .toLowerCase();
}

/**
 * Does a job have anything to do with the target role? Shares a meaningful word with the role (or one of its keywords)
 * in the job's title or text. Unrelated jobs are fine with fewer bullets: they only show work history.
 */
export function isRelevantJob(
  p: ProfileData,
  j: { title?: string; company?: string; description?: string; accomplishments?: string[] },
  role?: RoleProfile | null
): boolean {
  const target = `${targetRoleOf(p)} ${role?.role ?? ""} ${(role?.keywords ?? []).join(" ")}`.toLowerCase();
  const words = new Set(target.split(/[^a-z0-9+#.]+/).filter((w) => w.length > 3 && !["senior", "junior", "lead", "manager", "assistant", "specialist"].includes(w)));
  if (words.size === 0) return true; // no target: nothing is "unrelated"
  const text = [j.title, j.description, ...(j.accomplishments ?? [])].join(" ").toLowerCase();
  for (const w of words) if (text.includes(w)) return true;
  return false;
}

const clean = (k: string) => k.toLowerCase().replace(/[()]/g, " ").replace(/\s+/g, " ").trim();

/** Which of the role's keywords the resume actually contains (anywhere: skills, summary, bullets, projects). */
export function keywordCoverage(p: ProfileData, keywords: string[]): { found: string[]; missing: string[]; share: number } {
  const text = resumeText(p);
  const found: string[] = [];
  const missing: string[] = [];
  for (const k of keywords) (text.includes(clean(k)) ? found : missing).push(k);
  return { found, missing, share: keywords.length ? found.length / keywords.length : 0 };
}
