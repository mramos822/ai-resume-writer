// Job search: real listings from public job boards, turned into one common shape.
//  - Remotive: remote jobs (no key)            https://remotive.com/api/remote-jobs
//  - Arbeitnow: jobs, many in Europe + remote (no key)  https://www.arbeitnow.com/api/job-board-api
//  - Adzuna: jobs by city in many countries, when ADZUNA_APP_ID and ADZUNA_APP_KEY are set  https://developer.adzuna.com
// Every listing keeps its own link, so people apply on the original site.
import { ADZUNA_COUNTRIES } from "@/lib/jobCountries";
import { remoteCountryFit } from "@/lib/remotePlace";
import { kmBetween, type Origin } from "@/lib/jobPlaces";
import { nearestMajorCity } from "@/lib/jobMajorCities";
import { REACH_ORDER, type Reach } from "@/lib/jobReach";
import { cleanFacts, type JobFacts } from "@/lib/jobFacts";

export interface JobListing {
  /** stable id: "source:id" */
  key: string;
  source: "remotive" | "arbeitnow" | "adzuna" | "greenhouse" | "lever" | "ashby" | "smartrecruiters" | "link";
  title: string;
  company: string;
  location: string;
  remote: boolean;
  /** for a remote job: 0 it names the country of the search, 1 it can be done from anywhere, 2 it is for another country (see remoteCountryFit) */
  countryFit?: 0 | 1 | 2;
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
  /** what the AI read from the whole posting (years, level, skills): the fit uses it when present */
  facts?: JobFacts;
  /** in a search by place: how far the job is from it. Only search results have it. */
  reach?: Reach;
}

const reachRank = (j: JobListing) => (j.reach ? REACH_ORDER.indexOf(j.reach) : 0);
const byReachThenDate = (a: JobListing, b: JobListing) => reachRank(a) - reachRank(b) || +new Date(b.postedAt || 0) - +new Date(a.postedAt || 0);

/** Up to this far (km) from the place a job counts as "in" it, and up to NEAR_KM as near it. */
const HERE_KM = 25;
const NEAR_KM = 80;

export interface JobQuery {
  q: string;
  location: string;
  remoteOnly: boolean;
  /** ISO 3166 country code of the person (lower case is fine), used by sources that search by country */
  country: string;
  /** where the place is, when it is known: jobs are then sorted by how far they are from it */
  origin?: Origin;
  /** the languages the person reads (the index leaves out postings in any other); English when not said */
  langs?: string[];
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
const adzunaCountry = (code: string) => {
  const c = code.toLowerCase();
  return c === "uk" ? "gb" : ADZUNA_COUNTRIES.includes(c) ? c : null;
};

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
  latitude?: number;
  longitude?: number;
}

async function adzuna(q: JobQuery, km = 0): Promise<JobListing[]> {
  const id = process.env.ADZUNA_APP_ID;
  const key = process.env.ADZUNA_APP_KEY;
  if (!id || !key) return [];
  const country = adzunaCountry(q.country);
  if (!country) return []; // the board has no jobs in that country: better none than the jobs of another one
  const params = new URLSearchParams({ app_id: id, app_key: key, results_per_page: "40", "content-type": "application/json" });
  if (q.q) params.set("what", q.q);
  if (q.location && !q.remoteOnly) {
    params.set("where", q.location);
    if (km) params.set("distance", String(km));
  }
  if (q.remoteOnly) params.set("what_or", "remote");
  const data = (await getJson(`https://api.adzuna.com/v1/api/jobs/${country}/search/1?${params}`)) as { results?: AdzunaRow[] };
  return (data.results ?? []).map((j) => {
    const min = j.salary_min ? Math.round(Number(j.salary_min)) : 0;
    const max = j.salary_max ? Math.round(Number(j.salary_max)) : 0;
    const fmt = (n: number) => n.toLocaleString("en-US");
    // how far from the place it is, when both positions are known; otherwise it counts as in the place
    const away = q.origin && km && j.latitude != null && j.longitude != null ? kmBetween(q.origin, { lat: Number(j.latitude), lon: Number(j.longitude) }) : 0;
    return {
      reach: !q.location || q.remoteOnly ? undefined : away > HERE_KM ? ("near" as const) : ("here" as const),
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

/** How far a big city can be to be offered to a person who lives in a small town. */
const BIG_CITY_MAX_KM = 200;

/**
 * The jobs of the place and up to NEAR_KM around it; when there are few and the nearest big city is farther than that, also the
 * jobs of that city; and when there are still few, the ones of the rest of the country.
 */
async function adzunaAround(q: JobQuery, info: { city?: string }): Promise<JobListing[]> {
  if (!q.location || q.remoteOnly) return adzuna(q);
  const around = await adzuna(q, NEAR_KM);
  const local = around.filter((j) => j.reach === "here").length;
  let city: JobListing[] = [];
  if (local < 10 && q.origin) {
    const big = nearestMajorCity(q.country, q.origin, NEAR_KM, BIG_CITY_MAX_KM);
    if (big) {
      const found = await adzuna({ ...q, location: big.label, origin: big.at }, HERE_KM).catch(() => []);
      city = found.map((j) => ({ ...j, reach: "city" as const }));
      if (city.length) info.city = big.name;
    }
  }
  if (around.length + city.length >= 10) return [...around, ...city];
  const rest = await adzuna({ ...q, location: "" }).catch(() => []);
  return [...around, ...city, ...rest.map((j) => ({ ...j, reach: (j.remote ? "remote" : "other") as JobListing["reach"] }))];
}

const cache = new Map<string, { at: number; jobs: JobListing[]; sources: string[]; bigCity?: string }>();
const TTL = 5 * 60 * 1000;

/** Searches every source, merges, removes repeats and puts the best matches and the newest first. */
/**
 * live: "auto" asks our own sources and, when they are not enough, the other boards; "never" only our own; "only" only the other boards.
 * boards (with "only"): "fast" = Remotive and Arbeitnow (whole postings, quick), "adzuna" = Adzuna (cut postings: the slow ones, they have to be read).
 */
export interface SearchOpts {
  live?: "auto" | "never" | "only";
  boards?: "all" | "fast" | "adzuna";
}

/** how many jobs of our own index make the other boards unnecessary for a search without a place */
export const ENOUGH_OWN = 30;

/** A source added by the caller (the server adds our own index): its name and how it searches. */
export type ExtraSource = [name: string, search: (q: JobQuery) => Promise<JobListing[]>];

export async function searchJobs(q: JobQuery, extra: ExtraSource[] = [], opts: SearchOpts = {}): Promise<{ jobs: JobListing[]; sources: string[]; bigCity?: string }> {
  const cacheKey = JSON.stringify([q.q.toLowerCase().trim(), q.location.toLowerCase().trim(), q.remoteOnly, q.country.toLowerCase(), opts.live ?? "auto", opts.boards ?? "all"]);
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.at < TTL) return hit;

  const sources: string[] = [];
  const jobs: JobListing[] = [];
  const info: { city?: string } = {};
  // our own index answers first: it is complete and instant. When it already holds plenty of jobs for what was typed (and no place was
  // asked for: a place needs the boards that list local jobs) the other boards are not asked at all, so the search is not slowed down by them.
  const own = opts.live === "only" ? [] : await Promise.allSettled(extra.map(([, run]) => run(q)));
  own.forEach((r, i) => {
    if (r.status === "fulfilled") {
      sources.push(extra[i][0]);
      jobs.push(...r.value);
    }
  });
  const ownMatches = jobs.filter((j) => (!q.q.trim() || matchesQuery(j, q.q)) && (!q.remoteOnly || j.remote)).length;
  if (opts.live === "only" || (opts.live !== "never" && (q.location.trim() || ownMatches < ENOUGH_OWN))) {
    const tasks: [string, Promise<JobListing[]>][] = [];
    if (opts.boards !== "adzuna") tasks.push(["Remotive", remotive(q)], ["Arbeitnow", arbeitnow()]);
    if (opts.boards !== "fast" && process.env.ADZUNA_APP_ID && process.env.ADZUNA_APP_KEY && adzunaCountry(q.country)) tasks.push(["Adzuna", adzunaAround(q, info)]);
    const settled = await Promise.allSettled(tasks.map(([, p]) => p));
    settled.forEach((r, i) => {
      if (r.status === "fulfilled") {
        sources.push(tasks[i][0]);
        jobs.push(...r.value);
      }
    });
  }

  const loc = q.location.toLowerCase().trim();
  let out = jobs.filter((j) => j.title && j.url);
  if (q.q.trim()) out = out.filter((j) => j.source === "adzuna" || matchesQuery(j, q.q));
  if (q.remoteOnly) out = out.filter((j) => j.remote);
  else if (loc) {
    // keep jobs in that place, plus remote ones (they can be done from there)
    const lw = words(loc);
    out = out
      .filter((j) => j.reach || j.remote || lw.some((w) => j.location.toLowerCase().includes(w)))
      .map((j) => (j.reach ? j : { ...j, reach: j.remote ? ("remote" as const) : ("here" as const) }));
  }
  const seen = new Set<string>();
  out = out.filter((j) => {
    const k = `${j.title}|${j.company}`.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  out.sort(byReachThenDate);
  // every remote job says how well it fits the country of the search (the page sorts by it inside the group of remote jobs)
  const fitOf = (j: JobListing) => remoteCountryFit({ location: j.location, local: j.source === "adzuna" }, q.country);
  out = out.map((j) => (j.remote ? { ...j, countryFit: fitOf(j) } : j));
  if (q.remoteOnly) {
    // a search for remote work: the jobs for the country of the search first, then the ones that can be done from anywhere, then the ones
    // restricted to another country or region (only when there are few of the others). Adzuna searched by that country already.
    const ranked = out.map((j, i) => ({ j, f: j.countryFit ?? 1, i }));
    ranked.sort((a, b) => a.f - b.f || a.i - b.i); // stable: inside a group the order by date stays
    const fitting = ranked.filter((r) => r.f < 2).length;
    out = ranked.filter((r) => r.f < 2 || fitting < 10).map((r) => r.j);
  }
  const result = { jobs: out.slice(0, 80), sources, bigCity: info.city };
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
export async function searchJobsWide(q: JobQuery, skills: string[] = [], extra: ExtraSource[] = [], opts: SearchOpts = {}): Promise<{ jobs: JobListing[]; sources: string[]; bigCity?: string }> {
  const queries = q.q.trim() ? relatedQueries(q.q, skills) : [q.q];
  // A wide search asks for several titles. Our own index answers all of them first; when together they already give plenty (and no place
  // was asked for), the other boards are not asked for ANY of them: one short title must not make the whole search wait for them.
  if (opts.live && opts.live !== "auto") {
    // the page asked for our own sources or for the other boards, apart
    return mergeWide(await Promise.allSettled(queries.map((one) => searchJobs({ ...q, q: one }, extra, opts))));
  }
  if (extra.length && !q.location.trim()) {
    const own = await Promise.allSettled(queries.map((one) => searchJobs({ ...q, q: one }, extra, { live: "never" })));
    const merged = mergeWide(own);
    if (merged.jobs.length >= ENOUGH_OWN) return merged;
  }
  const results = await Promise.allSettled(queries.map((one) => searchJobs({ ...q, q: one }, extra)));
  return mergeWide(results);
}

/** The answers of several searches as one: repeats left out, newest first. */
function mergeWide(results: PromiseSettledResult<{ jobs: JobListing[]; sources: string[]; bigCity?: string }>[]): { jobs: JobListing[]; sources: string[]; bigCity?: string } {
  const jobs: JobListing[] = [];
  const sources = new Set<string>();
  let bigCity: string | undefined;
  const seen = new Set<string>();
  for (const r of results) {
    if (r.status !== "fulfilled") continue;
    r.value.sources.forEach((x) => sources.add(x));
    bigCity = bigCity ?? r.value.bigCity;
    for (const j of r.value.jobs) {
      const k = `${j.title}|${j.company}`.toLowerCase();
      if (seen.has(k) || seen.has(j.key)) continue;
      seen.add(k);
      seen.add(j.key);
      jobs.push(j);
    }
  }
  jobs.sort(byReachThenDate);
  return { jobs: jobs.slice(0, 150), sources: Array.from(sources), bigCity };
}

/** Checks a listing that comes from the browser (to save it or to prepare an application) and keeps only known fields. */
/**
 * True when the text of the job is only the start of the posting (some boards, Adzuna above all, share about 500 characters): the skills and
 * the experience it asks for are not all in it, so a number worked out from it is an estimate until the whole posting is read.
 */
export function isPartialPosting(job: Pick<JobListing, "source" | "description" | "snippet">): boolean {
  return job.source !== "link" && (job.description || job.snippet || "").trim().length < 600;
}

export function cleanListing(j: Partial<JobListing> | null | undefined): JobListing | null {
  if (!j || typeof j.key !== "string" || typeof j.title !== "string" || typeof j.url !== "string") return null;
  // a job the person added by pasting its text has no link; every other job needs one
  if (!/^https?:\/\//.test(j.url) && !(j.source === "link" && j.url === "")) return null;
  return {
    key: j.key.slice(0, 120),
    source: (["remotive", "arbeitnow", "adzuna", "greenhouse", "lever", "ashby", "smartrecruiters", "link"] as const).includes(j.source as "remotive") ? (j.source as JobListing["source"]) : "remotive",
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
    description: typeof j.description === "string" ? j.description.slice(0, 6000) : undefined,
    facts: cleanFacts(j.facts),
  };
}
