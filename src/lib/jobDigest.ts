// Reads the text of a job posting (copied from a page, or taken from a job board) and gives back its facts and a clean description:
// a short summary and the sections of the job. The AI only reads out what the text says; it adds nothing.
import { getOpenAIChatCompletion } from "@/lib/openaiClient";
import { AI_MODEL } from "@/lib/aiConfig";
import { cleanFacts, type JobFacts } from "@/lib/jobFacts";

const SYSTEM = `You read a job posting and extract its facts. Reply with ONE JSON object and nothing else:
{
  "title": "<job title>",
  "isList": <true when the page is a LIST of several different jobs (a company's page of openings, search results, "35 offers"), not one posting; else false>,
  "company": "<employer name, or empty>",
  "location": "<city/state/country, or empty>",
  "remote": <true if the job is remote, else false>,
  "salary": "<pay as written, or empty>",
  "postedAt": "<ISO date YYYY-MM-DD if the posting says when it was posted, else empty>",
  "tags": ["<up to 6 short keywords: employment type, field, main tools>"],
  "summary": "<2 or 3 sentences: what the role is, what the person will mainly do and what the company does>",
  "responsibilities": ["<up to 12 items: what the person will do, one short line each>"],
  "requirements": ["<up to 14 items: required skills, tools, experience (say the years if stated), education or languages, one short line each>"],
  "niceToHave": ["<up to 8 items: what is a plus, one short line each>"],
  "benefits": ["<up to 10 items: pay, perks, schedule, contract type, one short line each>"],
  "aboutCompany": "<1 or 2 sentences about the employer, only if the posting says something real about it, else empty>",
  "yearsRequired": <number: the years of professional experience the job requires of the candidate IN TOTAL, which is the largest overall figure among the requirements (for example "8 years of software development" and "1 year of mobile" give 8). Ignore anything that is only a plus or preferred. 0 when the posting states none>,
  "seniority": "<one of: intern, entry, mid, senior, staff, principal, lead, manager, director, unspecified: the level of the role, from its title and requirements>",
  "skillsRequired": ["<up to 15 specific skills the job REQUIRES: languages, frameworks, tools, platforms, certifications, methods. Names only, written as the industry writes them (for example React, AWS, Kubernetes). No soft skills, no ordinary words (organization, initiative), no currencies>"],
  "skillsPreferred": ["<up to 10 skills that are only a plus or preferred, same rules>"]
}
The text was copied from a web page, so it also holds menus, buttons, "similar jobs", cookie notices, reactions, applicant counts and the company's marketing or legal text. Ignore all of that, but keep EVERY detail that helps someone decide on this job and apply to it: do not leave out a requirement, a tool, a duty, a benefit, a schedule or a deadline.
Write the items in the language of the posting. Never invent anything that is not in the text, and leave a list empty when the posting says nothing about it. If the text is not a job posting, use an empty title.`;

export const JOB_LIST_ERROR = "That link is a list of jobs (a company's page or search results), not one posting. Open the job you want and paste its link.";

/** True for a page that is a list of jobs and not one posting: the address of a company or search page of the job boards, or a text that begins "35 job offers in...". */
export function looksLikeJobList(url: string, text: string): boolean {
  try {
    const u = new URL(url);
    if (/(^|\.)computrabajo\./i.test(u.hostname) && /^\/(empresas\/|trabajo-de-|empleos?-)/i.test(u.pathname)) return true; // a company's page or a search of Computrabajo; one offer is /ofertas-de-trabajo/oferta-de-trabajo-de-...
  } catch {
    /* not an address: the text decides */
  }
  return /^\s*\d[\d.,]*\s+(?:ofertas?|empleos?|vacantes?|puestos?|jobs?|openings?|offers?|stellen)\b/i.test(text.slice(0, 160));
}

export const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const items = (v: unknown, n: number) => (Array.isArray(v) ? v : []).map((x) => str(x, 260).replace(/^[-•*\s]+/, "")).filter((x) => x.length > 2).slice(0, n);

/** The posting in short sections: "## " starts a heading and "- " a bullet (the job detail draws it that way). */
export function describe(raw: Record<string, unknown>): string {
  const parts: string[] = [];
  const summary = str(raw.summary, 600);
  if (summary) parts.push(summary);
  const sections: [string, string[]][] = [
    ["What you will do", items(raw.responsibilities, 12)],
    ["What they ask for", items(raw.requirements, 14)],
    ["A plus", items(raw.niceToHave, 8)],
    ["What they offer", items(raw.benefits, 10)],
  ];
  for (const [heading, list] of sections) if (list.length) parts.push(`## ${heading}\n${list.map((x) => `- ${x}`).join("\n")}`);
  const about = str(raw.aboutCompany, 400);
  if (about) parts.push(`## About the company\n${about}`);
  return parts.join("\n\n");
}

/** What the AI read about years, level and skills (undefined when it gave nothing usable). */
export function factsOf(raw: Record<string, unknown>): JobFacts | undefined {
  return cleanFacts(raw);
}

/** Asks the AI to read the text of a posting. Returns what it found (empty object if the answer was not usable). */
export async function readPosting(text: string): Promise<Record<string, unknown>> {
  const completion = await getOpenAIChatCompletion({
    model: AI_MODEL,
    temperature: 0,
    max_tokens: 2400,
    messages: [
      { role: "system", content: SYSTEM },
      { role: "user", content: text.slice(0, 12000) },
    ],
  });
  try {
    const raw = JSON.parse(completion.content);
    return raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}
