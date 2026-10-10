// Job search: real listings from public job boards, turned into one common shape.
//  - Remotive: remote jobs (no key)            https://remotive.com/api/remote-jobs
//  - Arbeitnow: jobs, many in Europe + remote (no key)  https://www.arbeitnow.com/api/job-board-api
//  - Adzuna: jobs by city in many countries, when ADZUNA_APP_ID and ADZUNA_APP_KEY are set  https://developer.adzuna.com
// Every listing keeps its own link, so people apply on the original site.

export interface JobListing {
  /** stable id: "source:id" */
  key: string;
  source: "remotive" | "arbeitnow" | "adzuna" | "link";
  title: string;
  company: string;
  location: string;
  remote: boolean;
  url: string;
  /** ISO date */
  postedAt: string;
  salary?: string;
  tags: string[];
  /** plain-text start of the description */
  snippet: string;
  /** the company's logo when the source gives one */
  logo?: string;
  /** the description in plain text (shortened), used to tailor an application */
  description?: string;
}

export interface JobQuery {
  q: string;
  location: string;
  remoteOnly: boolean;
  /** ISO 3166 country code of the person (lower case is fine), used by sources that search by country */
  country: string;
}

const strip = (html: string) =>
  String(html ?? "")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();

const descriptionOf = (html: string) => strip(html).slice(0, 3500);

const snippetOf = (html: string) => {
  const t = strip(html);
  return t.length > 320 ? `${t.slice(0, 320).replace(/\s+\S*$/, "")}…` : t;
};

async function getJson(url: string, ms = 9000): Promise<unknown> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { Accept: "application/json", "User-Agent": "Kaizo-Resume-Builder/1.0" }, cache: "no-store" });
    if (!res.ok) throw new Error(`${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

const words = (s: string) => s.toLowerCase().split(/[^a-z0-9+#.]+/).filter((w) => w.length > 1);

/** True when the listing is about the search: every word typed appears in its title, tags or text. */
function matchesQuery(j: JobListing, q: string): boolean {
  const ws = words(q);
  if (ws.length === 0) return true;
  const hay = `${j.title} ${j.company} ${j.tags.join(" ")} ${j.snippet}`.toLowerCase();
  const inTitle = j.title.toLowerCase();
  // a listing needs most of the words, and at least one in the title
  const hits = ws.filter((w) => hay.includes(w)).length;
  return hits >= Math.ceil(ws.length * 0.6) && ws.some((w) => inTitle.includes(w));
}

/* ---------- Remotive ---------- */
async function remotive(q: JobQuery): Promise<JobListing[]> {
  const url = `https://remotive.com/api/remote-jobs?limit=60${q.q ? `&search=${encodeURIComponent(q.q)}` : ""}`;
  const data = (await getJson(url)) as { jobs?: Record<string, unknown>[] };
  return (data.jobs ?? []).map((j) => ({
    key: `remotive:${j.id}`,
    source: "remotive" as const,
    title: String(j.title ?? ""),
    company: String(j.company_name ?? ""),
    location: String(j.candidate_required_location || "Remote"),
    remote: true,
    url: String(j.url ?? ""),
    postedAt: String(j.publication_date ?? ""),
    salary: j.salary ? String(j.salary) : undefined,
    tags: [String(j.category ?? ""), ...((j.tags as string[]) ?? [])].filter(Boolean).slice(0, 8),
    snippet: snippetOf(String(j.description ?? "")),
    logo: /^https?:\/\//.test(String(j.company_logo ?? "")) ? String(j.company_logo) : undefined,
    description: descriptionOf(String(j.description ?? "")),
  }));
}

/* ---------- Arbeitnow ---------- */
async function arbeitnow(): Promise<JobListing[]> {
  const pages = await Promise.all([1, 2, 3].map((p) => getJson(`https://www.arbeitnow.com/api/job-board-api?page=${p}`).catch(() => ({ data: [] }))));
  const rows = pages.flatMap((d) => ((d as { data?: Record<string, unknown>[] }).data ?? []));
  return rows.map((j) => ({
    key: `arbeitnow:${j.slug}`,
    source: "arbeitnow" as const,
    title: String(j.title ?? ""),
    company: String(j.company_name ?? ""),
    location: String(j.location || (j.remote ? "Remote" : "")),
    remote: Boolean(j.remote),
    url: String(j.url ?? ""),
    postedAt: typeof j.created_at === "number" ? new Date(j.created_at * 1000).toISOString() : "",
    tags: [...((j.job_types as string[]) ?? []), ...((j.tags as string[]) ?? [])].filter(Boolean).slice(0, 8),
    snippet: snippetOf(String(j.description ?? "")),
    description: descriptionOf(String(j.description ?? "")),
  }));
}

/* ---------- Adzuna (needs a free key) ---------- */
const ADZUNA_COUNTRIES = ["at", "au", "be", "br", "ca", "ch", "de", "es", "fr", "gb", "in", "it", "mx", "nl", "nz", "pl", "sg", "us", "za"];

interface AdzunaRow {
  id?: string | number;
  title?: string;
  description?: string;
  redirect_url?: string;
  created?: string;
  salary_min?: number;
  salary_max?: number;
  contract_time?: string;
  company?: { display_name?: string };
  location?: { display_name?: string };
  category?: { label?: string };
}

async function adzuna(q: JobQuery): Promise<JobListing[]> {
  const id = process.env.ADZUNA_APP_ID;
  const key = process.env.ADZUNA_APP_KEY;
  if (!id || !key) return [];
  const c = q.country.toLowerCase();
  const country = ADZUNA_COUNTRIES.includes(c) ? c : c === "uk" ? "gb" : "us";
  const params = new URLSearchParams({ app_id: id, app_key: key, results_per_page: "40", "content-type": "application/json" });
  if (q.q) params.set("what", q.q);
  if (q.location && !q.remoteOnly) params.set("where", q.location);
  if (q.remoteOnly) params.set("what_or", "remote");
  const data = (await getJson(`https://api.adzuna.com/v1/api/jobs/${country}/search/1?${params}`)) as { results?: AdzunaRow[] };
  return (data.results ?? []).map((j) => {
    const min = j.salary_min ? Math.round(Number(j.salary_min)) : 0;
    const max = j.salary_max ? Math.round(Number(j.salary_max)) : 0;
    const fmt = (n: number) => n.toLocaleString("en-US");
    return {
      key: `adzuna:${j.id}`,
      source: "adzuna" as const,
      title: strip(String(j.title ?? "")),
      company: String(j.company?.display_name ?? ""),
      location: String(j.location?.display_name ?? ""),
      remote: /remote/i.test(`${j.title} ${j.description}`),
      url: String(j.redirect_url ?? ""),
      postedAt: String(j.created ?? ""),
      salary: min || max ? (min && max && min !== max ? `${fmt(min)} – ${fmt(max)}` : fmt(min || max)) : undefined,
      tags: [String(j.category?.label ?? ""), String(j.contract_time ?? "").replace("_", " ")].filter(Boolean),
      snippet: snippetOf(String(j.description ?? "")),
      description: descriptionOf(String(j.description ?? "")),
    };
  });
}

const cache = new Map<string, { at: number; jobs: JobListing[]; sources: string[] }>();
const TTL = 5 * 60 * 1000;

/** Searches every source, merges, removes repeats and puts the best matches and the newest first. */
export async function searchJobs(q: JobQuery): Promise<{ jobs: JobListing[]; sources: string[] }> {
  const cacheKey = JSON.stringify([q.q.toLowerCase().trim(), q.location.toLowerCase().trim(), q.remoteOnly, q.country.toLowerCase()]);
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.at < TTL) return hit;

  const sources: string[] = [];
  const jobs: JobListing[] = [];
  const tasks: [string, Promise<JobListing[]>][] = [["Remotive", remotive(q)], ["Arbeitnow", arbeitnow()]];
  if (process.env.ADZUNA_APP_ID && process.env.ADZUNA_APP_KEY) tasks.push(["Adzuna", adzuna(q)]);
  const settled = await Promise.allSettled(tasks.map(([, p]) => p));
  settled.forEach((r, i) => {
    if (r.status === "fulfilled") {
      sources.push(tasks[i][0]);
      jobs.push(...r.value);
    }
  });

  const loc = q.location.toLowerCase().trim();
  let out = jobs.filter((j) => j.title && j.url);
  if (q.q.trim()) out = out.filter((j) => j.source === "adzuna" || matchesQuery(j, q.q));
  if (q.remoteOnly) out = out.filter((j) => j.remote);
  else if (loc) {
    // keep jobs in that place, plus remote ones (they can be done from there)
    const lw = words(loc);
    out = out.filter((j) => j.remote || lw.some((w) => j.location.toLowerCase().includes(w)) || j.source === "adzuna");
  }
  const seen = new Set<string>();
  out = out.filter((j) => {
    const k = `${j.title}|${j.company}`.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  out.sort((a, b) => +new Date(b.postedAt || 0) - +new Date(a.postedAt || 0));
  const result = { jobs: out.slice(0, 80), sources };
  cache.set(cacheKey, { at: Date.now(), ...result });
  return result;
}

// Other ways to say the same role, so one search finds more of the jobs that really fit
const SENIORITY = /\b(senior|sr\.?|junior|jr\.?|lead|principal|staff|head of|intern|trainee|associate)\b/gi;
const SIBLINGS: [RegExp, string[]][] = [
  [/full[\s-]?stack|web developer|software (engineer|developer)|programmer/i, ["Software Engineer", "Web Developer"]],
  [/front[\s-]?end|ui developer/i, ["Frontend Developer", "Web Developer"]],
  [/back[\s-]?end/i, ["Backend Developer", "Software Engineer"]],
  [/data scien|machine learning|ml engineer/i, ["Data Scientist", "Machine Learning Engineer"]],
  [/data analy|business analy/i, ["Data Analyst", "Business Analyst"]],
  [/devops|site reliability|cloud/i, ["DevOps Engineer", "Cloud Engineer"]],
  [/designer|ux|ui\/ux/i, ["Product Designer", "UX Designer"]],
  [/project manager|program manager/i, ["Project Manager", "Program Manager"]],
  [/marketing/i, ["Marketing Specialist", "Digital Marketing"]],
  [/account(ant|ing)/i, ["Accountant", "Staff Accountant"]],
  [/nurse|nursing/i, ["Registered Nurse", "Nurse"]],
  [/teacher|instructor/i, ["Teacher", "Instructor"]],
];

/** The searches to run for a role: the role itself, without its seniority, similar titles and the role with the person's main skill. */
export function relatedQueries(role: string, skills: string[] = []): string[] {
  const base = role.replace(SENIORITY, " ").replace(/\s+/g, " ").trim();
  const out = [role.trim(), base];
  for (const [re, names] of SIBLINGS) if (re.test(role)) out.push(...names);
  const first = skills.find((x) => x && !base.toLowerCase().includes(x.toLowerCase()));
  if (first && base) out.push(`${base} ${first}`);
  return Array.from(new Set(out.filter(Boolean).map((x) => x.slice(0, 80)))).slice(0, 4);
}

/** A wider search: several related searches at once, joined and without repeats. */
export async function searchJobsWide(q: JobQuery, skills: string[] = []): Promise<{ jobs: JobListing[]; sources: string[] }> {
  const queries = q.q.trim() ? relatedQueries(q.q, skills) : [q.q];
  const results = await Promise.allSettled(queries.map((one) => searchJobs({ ...q, q: one })));
  const jobs: JobListing[] = [];
  const sources = new Set<string>();
  const seen = new Set<string>();
  for (const r of results) {
    if (r.status !== "fulfilled") continue;
    r.value.sources.forEach((x) => sources.add(x));
    for (const j of r.value.jobs) {
      const k = `${j.title}|${j.company}`.toLowerCase();
      if (seen.has(k) || seen.has(j.key)) continue;
      seen.add(k);
      seen.add(j.key);
      jobs.push(j);
    }
  }
  jobs.sort((a, b) => +new Date(b.postedAt || 0) - +new Date(a.postedAt || 0));
  return { jobs: jobs.slice(0, 150), sources: Array.from(sources) };
}

/** Checks a listing that comes from the browser (to save it or to prepare an application) and keeps only known fields. */
export function cleanListing(j: Partial<JobListing> | null | undefined): JobListing | null {
  if (!j || typeof j.key !== "string" || typeof j.title !== "string" || typeof j.url !== "string") return null;
  // a job the person added by pasting its text has no link; every other job needs one
  if (!/^https?:\/\//.test(j.url) && !(j.source === "link" && j.url === "")) return null;
  return {
    key: j.key.slice(0, 120),
    source: (["remotive", "arbeitnow", "adzuna", "link"] as const).includes(j.source as "remotive") ? (j.source as JobListing["source"]) : "remotive",
    title: j.title.slice(0, 200),
    company: String(j.company ?? "").slice(0, 200),
    location: String(j.location ?? "").slice(0, 200),
    remote: Boolean(j.remote),
    url: j.url.slice(0, 1000),
    postedAt: String(j.postedAt ?? "").slice(0, 40),
    salary: j.salary ? String(j.salary).slice(0, 80) : undefined,
    tags: (Array.isArray(j.tags) ? j.tags : []).map((t) => String(t).slice(0, 40)).slice(0, 8),
    snippet: String(j.snippet ?? "").slice(0, 400),
    logo: typeof j.logo === "string" && /^https?:\/\//.test(j.logo) ? j.logo.slice(0, 500) : undefined,
    description: typeof j.description === "string" ? j.description.slice(0, 3500) : undefined,
  };
}
