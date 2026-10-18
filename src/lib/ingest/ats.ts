// Reads the public openings of a company from its applicant tracking system and turns each one into the common shape (JobListing).
// Both systems publish the whole posting, so nothing has to be read from the page later.
import { decode, htmlToText } from "@/lib/jobAdText";
import type { JobListing } from "@/lib/jobSearch";
import type { Board } from "@/lib/ingest/boards";

/** A job of the index: the listing plus what only the index needs (the description keeps the first 6000 characters: the database is small). */
export interface IndexedJob extends JobListing {
  /** the board it came from, to know which jobs of it are gone */
  board: string;
}

const REMOTE = /\b(remote|anywhere|work from home|distributed)\b/i;
const iso = (v: unknown): string => {
  const t = typeof v === "number" ? v : Date.parse(String(v ?? ""));
  return Number.isFinite(t) && t > 0 ? new Date(t).toISOString() : "";
};
const text = (html: string) => htmlToText(decode(html), true);
const clip = (s: string, n: number) => s.slice(0, n);
const nice = (s: string) => s.replace(/\s+/g, " ").trim();
const company = (b: Board) => b.name ?? b.token.charAt(0).toUpperCase() + b.token.slice(1);

interface GreenhouseJob {
  id?: number;
  title?: string;
  location?: { name?: string };
  absolute_url?: string;
  company_name?: string;
  first_published?: string;
  updated_at?: string;
  content?: string;
  departments?: { name?: string }[];
  offices?: { name?: string }[];
}

export function fromGreenhouse(b: Board, j: GreenhouseJob): IndexedJob | null {
  if (!j.id || !j.title || !j.absolute_url || !/^https?:\/\//.test(j.absolute_url)) return null;
  const full = text(String(j.content ?? ""));
  const location = nice(j.location?.name ?? "");
  const dept = nice(j.departments?.[0]?.name ?? "").replace(/^\d+\s+/, ""); // "8611 Security Analytics" is "Security Analytics"
  return {
    key: `greenhouse:${b.token}:${j.id}`,
    source: "greenhouse",
    title: clip(nice(j.title), 200),
    company: clip(nice(j.company_name ?? company(b)), 200),
    location: clip(location, 200),
    remote: REMOTE.test(location) || REMOTE.test(j.title),
    url: clip(j.absolute_url, 1000),
    postedAt: iso(j.first_published) || iso(j.updated_at),
    tags: [dept].filter(Boolean),
    snippet: clip(nice(full), 380),
    description: clip(full, 6000),
    board: `greenhouse:${b.token}`,
  };
}

interface LeverPosting {
  id?: string;
  text?: string;
  categories?: { commitment?: string; department?: string; location?: string; team?: string; allLocations?: string[] };
  country?: string;
  createdAt?: number;
  workplaceType?: string;
  hostedUrl?: string;
  descriptionPlain?: string;
  lists?: { text?: string; content?: string }[];
  additionalPlain?: string;
  salaryRange?: { min?: number; max?: number; currency?: string; interval?: string };
}

export function fromLever(b: Board, p: LeverPosting): IndexedJob | null {
  if (!p.id || !p.text || !p.hostedUrl || !/^https?:\/\//.test(p.hostedUrl)) return null;
  // the posting in the order a person reads it: the introduction, each list under its heading, and what comes after
  const lists = (p.lists ?? []).map((l) => `## ${nice(l.text ?? "")}\n${text(String(l.content ?? ""))}`).join("\n\n");
  const full = [nice(p.descriptionPlain ?? ""), lists, p.additionalPlain ?? ""].filter(Boolean).join("\n\n").trim();
  const where = nice(p.categories?.location ?? p.categories?.allLocations?.[0] ?? "");
  const location = where || nice(p.country ?? "");
  const range = p.salaryRange;
  const money = (n: number) => n.toLocaleString("en-US");
  return {
    key: `lever:${b.token}:${p.id}`,
    source: "lever",
    title: clip(nice(p.text), 200),
    company: clip(company(b), 200),
    location: clip(location, 200),
    remote: p.workplaceType === "remote" || REMOTE.test(location) || REMOTE.test(p.text),
    url: clip(p.hostedUrl, 1000),
    postedAt: iso(p.createdAt),
    salary: range?.min && range?.max ? `${range.currency ?? ""} ${money(range.min)} – ${money(range.max)}${range.interval ? " " + range.interval.replace(/^per-/, "per ") : ""}`.trim().slice(0, 80) : undefined,
    tags: [nice(p.categories?.team ?? p.categories?.department ?? ""), nice(p.categories?.commitment ?? "")].filter(Boolean),
    snippet: clip(nice(full), 380),
    description: clip(full, 6000),
    board: `lever:${b.token}`,
  };
}

interface AshbyJob {
  id?: string;
  title?: string;
  department?: string;
  team?: string;
  employmentType?: string;
  location?: string;
  isListed?: boolean;
  isRemote?: boolean | null;
  workplaceType?: string;
  publishedAt?: string;
  jobUrl?: string;
  descriptionHtml?: string;
  descriptionPlain?: string;
  compensation?: { scrapeableCompensationSalarySummary?: string; compensationTierSummary?: string };
}

export function fromAshby(b: Board, j: AshbyJob): IndexedJob | null {
  if (!j.id || !j.title || !j.jobUrl || !/^https?:\/\//.test(j.jobUrl) || j.isListed === false) return null;
  // the html keeps the lists as lists; the plain text is the fallback
  const full = (j.descriptionHtml ? htmlToText(j.descriptionHtml, true) : "") || nice(j.descriptionPlain ?? "");
  const location = nice(j.location ?? "");
  const pay = nice(j.compensation?.scrapeableCompensationSalarySummary ?? j.compensation?.compensationTierSummary ?? "");
  return {
    key: `ashby:${b.token}:${j.id}`,
    source: "ashby",
    title: clip(nice(j.title), 200),
    company: clip(company(b), 200),
    location: clip(location, 200),
    remote: j.isRemote === true || /remote/i.test(j.workplaceType ?? "") || REMOTE.test(location) || REMOTE.test(j.title),
    url: clip(j.jobUrl, 1000),
    postedAt: iso(j.publishedAt),
    salary: pay ? clip(pay, 80) : undefined,
    tags: [nice(j.team ?? j.department ?? ""), nice(j.employmentType ?? "")].filter(Boolean),
    snippet: clip(nice(full), 380),
    description: clip(full, 6000),
    board: `ashby:${b.token}`,
  };
}

/** Every opening of one board. Throws when the board does not exist or the site is down: the ingestion reports it and moves on. */
export async function fetchBoard(b: Board): Promise<IndexedJob[]> {
  if (b.source === "greenhouse") {
    const res = await fetch(`https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(b.token)}/jobs?content=true`, { signal: AbortSignal.timeout(30_000) });
    if (!res.ok) throw new Error(`greenhouse ${b.token}: ${res.status}`);
    const data = (await res.json()) as { jobs?: GreenhouseJob[] };
    return (data.jobs ?? []).map((j) => fromGreenhouse(b, j)).filter((j): j is IndexedJob => !!j);
  }
  if (b.source === "ashby") {
    const res = await fetch(`https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(b.token)}?includeCompensation=true`, { signal: AbortSignal.timeout(30_000) });
    if (!res.ok) throw new Error(`ashby ${b.token}: ${res.status}`);
    const data = (await res.json()) as { jobs?: AshbyJob[] };
    return (data.jobs ?? []).map((j) => fromAshby(b, j)).filter((j): j is IndexedJob => !!j);
  }
  const out: IndexedJob[] = [];
  for (let skip = 0; skip < 2000; skip += 100) {
    const res = await fetch(`https://api.lever.co/v0/postings/${encodeURIComponent(b.token)}?mode=json&skip=${skip}&limit=100`, { signal: AbortSignal.timeout(30_000) });
    if (!res.ok) throw new Error(`lever ${b.token}: ${res.status}`);
    const page = (await res.json()) as LeverPosting[];
    if (!Array.isArray(page)) break;
    out.push(...page.map((p) => fromLever(b, p)).filter((j): j is IndexedJob => !!j));
    if (page.length < 100) break;
  }
  return out;
}
