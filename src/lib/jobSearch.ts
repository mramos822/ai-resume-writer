// Job search: real listings from public job boards, turned into one common shape.
//  - Remotive: remote jobs (no key)            https://remotive.com/api/remote-jobs
//  - Arbeitnow: jobs, many in Europe + remote (no key)  https://www.arbeitnow.com/api/job-board-api
//  - Adzuna: jobs by city in many countries, when ADZUNA_APP_ID and ADZUNA_APP_KEY are set  https://developer.adzuna.com
//  - Careerjet: jobs in Latin America (Peru and others), when CAREERJET_API_KEY is set  https://www.careerjet.com/partners/api
//  - Jooble: jobs of the countries it gave a key for (JOOBLE_API_KEY is the one of the USA, JOOBLE_API_KEY_PE and so on for the others)  https://jooble.org/api/about
// Every listing keeps its own link, so people apply on the original site.
import { createHash } from "crypto";
import { ADZUNA_COUNTRIES, CAREERJET_LOCALES } from "@/lib/jobCountries";
import { payFromText } from "@/lib/ingest/pay";
import { remoteCountryFit } from "@/lib/remotePlace";
import { kmBetween, type Origin } from "@/lib/jobPlaces";
import { nearestMajorCity } from "@/lib/jobMajorCities";
import { REACH_ORDER, type Reach } from "@/lib/jobReach";
import { cleanFacts, type JobFacts } from "@/lib/jobFacts";

export interface JobListing {
  /** stable id: "source:id" */
  key: string;
  source: "remotive" | "arbeitnow" | "adzuna" | "careerjet" | "jooble" | "greenhouse" | "lever" | "ashby" | "smartrecruiters" | "workable" | "recruitee" | "teamtailor" | "computrabajo" | "getonboard" | "remoteok" | "jobicy" | "usajobs" | "link";
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
  /** ISO 3166 code (lower case) of the country the job was searched in, for the boards that search by country: it tells the language of the posting */
  country?: string;
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
  /** the person's address and browser, which Careerjet's API asks for with every search */
  client?: { ip: string; ua: string };
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

/** The symbol of the money each Adzuna country pays in; the figure is shown with it so it is not a bare number. */
const ADZUNA_CURRENCY: Record<string, string> = { us: "$", ca: "$", au: "$", nz: "$", sg: "$", mx: "MX$", gb: "£", in: "₹", br: "R$", za: "R", pl: "zł ", de: "€", fr: "€", it: "€", nl: "€", at: "€", es: "€", be: "€" };

interface AdzunaRow {
  id?: string | number;
  title?: string;
  description?: string;
  redirect_url?: string;
  created?: string;
  salary_min?: number;
  salary_max?: number;
  /** "1" when Adzuna estimated the pay itself: the posting does not say it */
  salary_is_predicted?: string | number;
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
    const estimated = String(j.salary_is_predicted ?? "0") === "1"; // Adzuna's own guess, not pay the posting names: not shown as pay
    const min = !estimated && j.salary_min ? Math.round(Number(j.salary_min)) : 0;
    const max = !estimated && j.salary_max ? Math.round(Number(j.salary_max)) : 0;
    const fmt = (n: number) => `${ADZUNA_CURRENCY[country] ?? ""}${n.toLocaleString("en-US")}`;
    const hourly = !estimated && (min || max) ? /[$£€]\s?(\d[\d,.]*)\s*\/\s*(?:hr|hour)\b/i.exec(String(j.title ?? ""))?.[1] : undefined;
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
      // a title that names the hourly pay ("Remote Software Engineer ($300/hr)") says it better than Adzuna's yearly figure made from it ($624,000)
      salary: hourly ? `${ADZUNA_CURRENCY[country] ?? ""}${hourly}/hr` : min || max ? (min && max && min !== max ? `${fmt(min)} – ${fmt(max)}` : fmt(min || max)) : payFromText(String(j.description ?? "")),
      tags: [String(j.category?.label ?? ""), String(j.contract_time ?? "").replace("_", " ")].filter(Boolean),
      snippet: snippetOf(String(j.description ?? "")),
      description: descriptionOf(String(j.description ?? "")),
    };
  });
}

/* ---------- Careerjet (needs a free key) ---------- */
interface CareerjetRow {
  url?: string;
  title?: string;
  company?: string;
  date?: string;
  description?: string;
  locations?: string;
  salary?: string;
  site?: string;
}

async function careerjet(q: JobQuery): Promise<JobListing[]> {
  const key = process.env.CAREERJET_API_KEY;
  const locale = CAREERJET_LOCALES[q.country.toLowerCase()];
  if (!key || !locale) return [];
  const params = new URLSearchParams({ locale_code: locale, page_size: "40", sort: "date", user_ip: q.client?.ip || "127.0.0.1", user_agent: q.client?.ua || "Kaizo-Resume-Builder/1.0" });
  if (q.q) params.set("keywords", q.q);
  if (q.location && !q.remoteOnly) params.set("location", q.location);
  if (q.remoteOnly) params.set("keywords", `${q.q} remoto`.trim());
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 9000);
  try {
    // Careerjet only answers from an IP declared in its panel and Vercel's change, so when CAREERJET_PROXY_URL is set the call goes through
    // a small server with a fixed IP (scripts/careerjet-proxy.mjs, see docs/CAREERJET-PROXY.md); without it the call goes direct
    const proxy = process.env.CAREERJET_PROXY_URL?.replace(/\/+$/, "");
    const res = await fetch(`${proxy ?? "https://search.api.careerjet.net"}/v4/query?${params}`, {
      signal: ctrl.signal,
      headers: { ...(proxy ? { "X-Proxy-Secret": process.env.CAREERJET_PROXY_SECRET ?? "" } : {}), Accept: "application/json", Authorization: `Basic ${Buffer.from(`${key}:`).toString("base64")}`, Referer: "https://kaizoresumebuilder.vercel.app/" }, // Careerjet only answers a site declared in its partner panel
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`${res.status}`);
    const data = (await res.json()) as { jobs?: CareerjetRow[] };
    return (data.jobs ?? []).map((j) => ({
      key: `careerjet:${createHash("sha1").update(String(j.url)).digest("hex").slice(0, 20)}`, // the link is long: the key is made from it
      source: "careerjet" as const,
      title: strip(String(j.title ?? "")),
      company: String(j.company ?? ""),
      location: String(j.locations ?? ""),
      remote: /remot[oa]|remote|teletrabajo|home office/i.test(`${j.title} ${j.locations} ${j.description}`),
      url: String(j.url ?? ""),
      postedAt: Number.isNaN(Date.parse(String(j.date))) ? "" : new Date(String(j.date)).toISOString(),
      salary: j.salary ? String(j.salary).slice(0, 80) : payFromText(String(j.description ?? "")),
      tags: [],
      snippet: snippetOf(String(j.description ?? "")),
      description: descriptionOf(String(j.description ?? "")),
    }));
  } finally {
    clearTimeout(t);
  }
}

/* ---------- Jooble (a free key for each country) ---------- */
/** The key Jooble gave for a country: JOOBLE_API_KEY_<CC> (JOOBLE_API_KEY_PE...), and JOOBLE_API_KEY is the one of the USA. A key only answers on its own country's host. */
const joobleKey = (country: string): string | undefined => {
  const cc = country.toLowerCase();
  return process.env[`JOOBLE_API_KEY_${cc.toUpperCase()}`] || (cc === "us" ? process.env.JOOBLE_API_KEY : undefined);
};

/** Jooble shares only the first lines of each posting, and its link goes through a page that cannot be read by a program: the same as Careerjet. */
export const sharesFirstLinesOnly = (job: Pick<JobListing, "source">) => job.source === "careerjet" || job.source === "jooble";

interface JoobleRow {
  id?: string | number;
  title?: string;
  location?: string;
  snippet?: string;
  salary?: string;
  source?: string;
  type?: string;
  link?: string;
  company?: string;
  updated?: string;
}

async function jooble(q: JobQuery): Promise<JobListing[]> {
  const cc = q.country.toLowerCase();
  const key = joobleKey(cc);
  if (!key) return [];
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 9000);
  try {
    const res = await fetch(`https://${cc}.jooble.org/api/${key}`, {
      method: "POST",
      signal: ctrl.signal,
      headers: { "Content-Type": "application/json", Accept: "application/json", "User-Agent": "Kaizo-Resume-Builder/1.0" },
      body: JSON.stringify({ keywords: q.remoteOnly ? `${q.q} remote`.trim() : q.q, location: q.remoteOnly ? "" : q.location, page: "1" }),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`${res.status}`);
    const data = (await res.json()) as { jobs?: JoobleRow[] };
    return (data.jobs ?? []).map((j) => ({
      key: `jooble:${j.id ?? createHash("sha1").update(String(j.link)).digest("hex").slice(0, 20)}`,
      source: "jooble" as const,
      title: strip(String(j.title ?? "")),
      company: String(j.company ?? ""),
      location: String(j.location ?? ""),
      remote: /remote|remoto|teletrabajo|work from home/i.test(`${j.title} ${j.location} ${j.type} ${j.snippet}`),
      url: String(j.link ?? ""),
      postedAt: Number.isNaN(Date.parse(String(j.updated))) ? "" : new Date(String(j.updated)).toISOString(),
      salary: j.salary ? String(j.salary).slice(0, 80) : payFromText(String(j.snippet ?? "")),
      tags: [String(j.type ?? "")].filter(Boolean),
      snippet: snippetOf(String(j.snippet ?? "")),
      description: descriptionOf(String(j.snippet ?? "")),
    }));
  } finally {
    clearTimeout(t);
  }
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
    // Remotive and Arbeitnow are read into our own index every day: they are asked live only when the index did not answer
    const indexAnswered = own.some((r) => r.status === "fulfilled");
    if (opts.boards !== "adzuna" && !indexAnswered) tasks.push(["Remotive", remotive(q)], ["Arbeitnow", arbeitnow()]);
    if (opts.boards !== "fast" && process.env.ADZUNA_APP_ID && process.env.ADZUNA_APP_KEY && adzunaCountry(q.country)) tasks.push(["Adzuna", adzunaAround(q, info)]);
    if (opts.boards !== "fast" && process.env.CAREERJET_API_KEY && CAREERJET_LOCALES[q.country.toLowerCase()]) tasks.push(["Careerjet", careerjet(q)]);
    if (opts.boards !== "fast" && joobleKey(q.country)) tasks.push(["Jooble", jooble(q)]);
    const settled = await Promise.allSettled(tasks.map(([, p]) => p));
    settled.forEach((r, i) => {
      if (r.status === "fulfilled") {
        sources.push(tasks[i][0]);
        jobs.push(...r.value);
      }
    });
  }

  const loc = q.location.toLowerCase().trim();
  const searchedIn = q.country.toLowerCase();
  let out = jobs.filter((j) => j.title && j.url).map((j) => (j.source === "adzuna" || j.source === "careerjet" || j.source === "jooble" ? { ...j, country: searchedIn } : j));
  if (q.q.trim()) out = out.filter((j) => j.source === "adzuna" || sharesFirstLinesOnly(j) || matchesQuery(j, q.q));
  if (q.remoteOnly) out = out.filter((j) => j.remote);
  else if (loc) {
    // keep jobs in that place, plus remote ones (they can be done from there)
    const lw = words(loc);
    out = out
      .filter((j) => j.reach || j.remote || sharesFirstLinesOnly(j) || lw.some((w) => j.location.toLowerCase().includes(w))) // Careerjet already searched by the place (in the local language: "Αθήνα" is "Athens")
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
  // the companies write these roles in other words: "Cybersecurity Analyst" is "Security Engineer" or "Security Analyst" in their postings
  [/cyber|security|infosec/i, ["Security Engineer", "Security Analyst", "Information Security Analyst"]],
  [/\bqa\b|quality assurance|\btest(er| engineer)|sdet/i, ["QA Engineer", "Software Test Engineer", "SDET"]],
  [/product manager|product owner/i, ["Product Manager", "Product Owner"]],
  [/\bsales\b|account executive|business development/i, ["Account Executive", "Sales Representative", "Business Development Representative"]],
  [/customer (service|support|success)|support (specialist|agent)/i, ["Customer Support", "Customer Success Manager", "Support Specialist"]],
  [/recruit|talent acquisition|human resources|\bhr\b/i, ["Recruiter", "Talent Acquisition", "HR Generalist"]],
  [/financial analy|finance/i, ["Financial Analyst", "Finance Manager"]],
  [/warehouse|logistic|supply chain/i, ["Warehouse Associate", "Logistics Coordinator", "Supply Chain Analyst"]],
  [/\bdriver\b|delivery/i, ["Delivery Driver", "Truck Driver", "CDL Driver"]],
];

/**
 * Roles typed in Spanish, in English: our index and most boards write their postings in English, so a person who uses Kaizo in Spanish and
 * types "contador" is also searched as "Accountant".
 */
const SPANISH_ROLES: [RegExp, string][] = [
  [/ingenier[oa] de software|desarrollador(a)? de software|programador(a)?/i, "Software Engineer"],
  [/desarrollador(a)? (web|full[\s-]?stack)/i, "Web Developer"],
  [/desarrollador(a)? (front[\s-]?end)/i, "Frontend Developer"],
  [/desarrollador(a)? (back[\s-]?end)/i, "Backend Developer"],
  [/analista de datos/i, "Data Analyst"],
  [/cient[ií]fic[oa] de datos/i, "Data Scientist"],
  [/ingenier[oa] de datos/i, "Data Engineer"],
  [/contador(a)?|contable/i, "Accountant"],
  [/enfermer[oa]/i, "Nurse"],
  [/profesor(a)?|docente|maestr[oa]/i, "Teacher"],
  [/dise[ñn]ador(a)? (ux|ui|de producto)/i, "UX Designer"],
  [/dise[ñn]ador(a)? gr[aá]fic[oa]/i, "Graphic Designer"],
  [/(gerente|jefe|jefa) de proyectos?/i, "Project Manager"],
  [/(gerente|jefe|jefa) de producto/i, "Product Manager"],
  [/vendedor(a)?|ejecutiv[oa] de ventas|ventas/i, "Sales Representative"],
  [/atenci[oó]n al cliente|servicio al cliente|soporte al cliente/i, "Customer Service"],
  [/marketing|mercadeo|mercadotecnia/i, "Marketing Specialist"],
  [/recursos humanos|reclutador(a)?/i, "Recruiter"],
  [/analista financier[oa]/i, "Financial Analyst"],
  [/abogad[oa]/i, "Attorney"],
  [/asistente administrativ[oa]|administrativ[oa]/i, "Administrative Assistant"],
  [/ingenier[oa] civil/i, "Civil Engineer"],
  [/ingenier[oa] industrial/i, "Industrial Engineer"],
  [/electricista/i, "Electrician"],
  [/mec[aá]nic[oa]/i, "Mechanic"],
  [/chofer|conductor(a)?/i, "Driver"],
  [/almac[eé]n|bodega/i, "Warehouse Associate"],
];

/** The searches to run for a role: the role itself, without its seniority, similar titles and the role with the person's main skill. */
export function relatedQueries(role: string, skills: string[] = []): string[] {
  const base = role.replace(SENIORITY, " ").replace(/\s+/g, " ").trim();
  const out = [role.trim(), base];
  // the role in English too, when it was typed in Spanish
  const english = SPANISH_ROLES.filter(([re]) => re.test(role)).map(([, name]) => name);
  out.push(...english);
  for (const [re, names] of SIBLINGS) if ([role, ...english].some((r) => re.test(r))) out.push(...names);
  const first = skills.find((x) => x && !base.toLowerCase().includes(x.toLowerCase()));
  if (first && base) out.push(`${base} ${first}`);
  return Array.from(new Set(out.filter(Boolean).map((x) => x.slice(0, 80)))).slice(0, 5);
}

/** A wider search: several related searches at once, joined and without repeats. */
export async function searchJobsWide(q: JobQuery, skills: string[] = [], extra: ExtraSource[] = [], opts: SearchOpts = {}): Promise<{ jobs: JobListing[]; sources: string[]; bigCity?: string }> {
  const queries = q.q.trim() ? relatedQueries(q.q, skills) : [q.q];
  // A wide search asks for several titles. Our own index answers all of them first; when together they already give plenty (and no place
  // was asked for), the other boards are not asked for ANY of them: one short title must not make the whole search wait for them.
  if (opts.live && opts.live !== "auto") {
    // the page asked for our own sources or for the other boards, apart
    // Adzuna understands synonyms by itself and its daily limit is small (250 requests): it is asked for the role and one similar title only; our
    // own index (free and instant) is asked for all of them
    const asked = opts.live === "only" ? queries.slice(0, 2) : queries;
    return mergeWide(await Promise.allSettled(asked.map((one) => searchJobs({ ...q, q: one }, extra, opts))));
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
    source: (["remotive", "arbeitnow", "adzuna", "careerjet", "jooble", "greenhouse", "lever", "ashby", "smartrecruiters", "workable", "recruitee", "teamtailor", "computrabajo", "getonboard", "remoteok", "jobicy", "usajobs", "link"] as const).includes(j.source as "remotive") ? (j.source as JobListing["source"]) : "remotive",
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
    country: typeof j.country === "string" && /^[a-z]{2}$/i.test(j.country) ? j.country.toLowerCase() : undefined,
  };
}
