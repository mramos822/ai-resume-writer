// Reads the text of a job posting (copied from a page, or taken from a job board) and gives back its facts and a clean description:
// a short summary and the sections of the job. The AI only reads out what the text says; it adds nothing.
import { getOpenAIChatCompletion } from "@/lib/openaiClient";
import { AI_MODEL } from "@/lib/aiConfig";

const SYSTEM = `You read a job posting and extract its facts. Reply with ONE JSON object and nothing else:
{
  "title": "<job title>",
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
  "aboutCompany": "<1 or 2 sentences about the employer, only if the posting says something real about it, else empty>"
}
The text was copied from a web page, so it also holds menus, buttons, "similar jobs", cookie notices, reactions, applicant counts and the company's marketing or legal text. Ignore all of that, but keep EVERY detail that helps someone decide on this job and apply to it: do not leave out a requirement, a tool, a duty, a benefit, a schedule or a deadline.
Write the items in the language of the posting. Never invent anything that is not in the text, and leave a list empty when the posting says nothing about it. If the text is not a job posting, use an empty title.`;

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

/** Asks the AI to read the text of a posting. Returns what it found (empty object if the answer was not usable). */
export async function readPosting(text: string): Promise<Record<string, unknown>> {
  const completion = await getOpenAIChatCompletion({
    model: AI_MODEL,
    temperature: 0,
    max_tokens: 1900,
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
