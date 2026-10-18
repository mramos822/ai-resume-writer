// Reads the public openings of a company from its applicant tracking system and turns each one into the common shape (JobListing).
// Both systems publish the whole posting, so nothing has to be read from the page later.
import { decode, htmlToText } from "@/lib/jobAdText";
import type { JobListing } from "@/lib/jobSearch";
import type { Board } from "@/lib/ingest/boards";
import { countryOf } from "@/lib/ingest/country";
import { payFromText, structuredPay } from "@/lib/ingest/pay";

/** A job of the index: the listing plus what only the index needs (the description keeps the first 6000 characters: the database is small). */
export interface IndexedJob extends JobListing {
  /** the board it came from, to know which jobs of it are gone */
  board: string;
  /** the country the job is in (ISO code), when the place says it; undefined when it does not (Remote, Multiple locations...) */
  country?: string;
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
    // Greenhouse has no field for it: the place says it ("Remote - US"), and a place that is only "United States" or "Canada" is a job open to the
    // whole country, which is how companies publish their remote jobs there (a place that is only "Singapore" is an office, not a remote job)
    remote: REMOTE.test(location) || REMOTE.test(j.title) || /^(united states|usa|u.s.a?.?|us|canada)$/i.test(location.trim()),
    url: clip(j.absolute_url, 1000),
    postedAt: iso(j.first_published) || iso(j.updated_at),
    salary: payFromText(full),
    tags: [dept].filter(Boolean),
    snippet: clip(nice(full), 380),
    description: clip(full, 6000),
    board: `greenhouse:${b.token}`,
    country: countryOf(location),
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
    salary: (range?.min && range?.max ? `${range.currency ?? ""} ${money(range.min)} – ${money(range.max)}${range.interval ? " " + range.interval.replace(/^per-/, "per ") : ""}`.trim().slice(0, 80) : undefined) ?? payFromText(full),
    tags: [nice(p.categories?.team ?? p.categories?.department ?? ""), nice(p.categories?.commitment ?? "")].filter(Boolean),
    snippet: clip(nice(full), 380),
    description: clip(full, 6000),
    board: `lever:${b.token}`,
    country: countryOf(location, p.country),
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
  address?: { postalAddress?: { addressCountry?: string } };
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
    // "isRemote" is true for hybrid jobs too (a hybrid job in New York is not a remote one): the workplace type decides, and only when it
    // says nothing is the place or the title read
    remote: /remote/i.test(j.workplaceType ?? "") || (!/hybrid|on-?site/i.test(j.workplaceType ?? "") && (REMOTE.test(location) || REMOTE.test(j.title))),
    url: clip(j.jobUrl, 1000),
    postedAt: iso(j.publishedAt),
    salary: pay ? clip(pay, 80) : payFromText(full),
    tags: [nice(j.team ?? j.department ?? ""), nice(j.employmentType ?? "")].filter(Boolean),
    snippet: clip(nice(full), 380),
    description: clip(full, 6000),
    board: `ashby:${b.token}`,
    country: countryOf(location, j.address?.postalAddress?.addressCountry),
  };
}

interface SrListItem {
  id?: string;
  name?: string;
  releasedDate?: string;
  ref?: string;
  location?: { fullLocation?: string; city?: string; country?: string; remote?: boolean; hybrid?: boolean };
  department?: { label?: string };
  typeOfEmployment?: { label?: string };
  experienceLevel?: { label?: string };
}
interface SrDetail {
  postingUrl?: string;
  company?: { name?: string };
  jobAd?: { sections?: Record<string, { title?: string; text?: string }> };
}

export function fromSmartRecruiters(b: Board, item: SrListItem, d: SrDetail): IndexedJob | null {
  if (!item.id || !item.name || !d.postingUrl || !/^https?:\/\//.test(d.postingUrl)) return null;
  const sec = d.jobAd?.sections ?? {};
  // what the job is and what it asks for; the paragraph about the company is marketing and is left out
  const full = ["jobDescription", "qualifications", "additionalInformation"]
    .map((k) => (sec[k]?.text ? `## ${nice(sec[k].title ?? "")}\n${htmlToText(sec[k].text as string, true)}` : ""))
    .filter(Boolean)
    .join("\n\n");
  if (full.length < 80) return null;
  const location = nice(item.location?.fullLocation ?? item.location?.city ?? "");
  return {
    key: `smartrecruiters:${b.token}:${item.id}`,
    source: "smartrecruiters",
    title: clip(nice(item.name), 200),
    company: clip(nice(d.company?.name ?? company(b)), 200),
    location: clip(location, 200),
    remote: item.location?.hybrid !== true && (item.location?.remote === true || REMOTE.test(item.name)),
    url: clip(d.postingUrl, 1000),
    postedAt: iso(item.releasedDate),
    tags: [nice(item.department?.label ?? ""), nice(item.typeOfEmployment?.label ?? "")].filter(Boolean),
    salary: payFromText(full),
    snippet: clip(nice(full), 380),
    description: clip(full, 6000),
    board: `smartrecruiters:${b.token}`,
    country: countryOf(location, item.location?.country),
  };
}

/** How many postings of a company are followed (the newest ones), and how many NEW ones are read in full per run. */
export const SR_WINDOW = 300;
export const SR_NEW_PER_RUN = 120;

/**
 * The newest postings of a company. A posting already in the index (`known`) is not read again: it only counts as still open. Of the new
 * ones, at most SR_NEW_PER_RUN are read in full (the rest wait for the next run).
 */
export async function fetchSmartRecruiters(b: Board, known: Set<string>): Promise<{ jobs: IndexedJob[]; seen: string[]; remoteOf: Record<string, boolean> }> {
  const items: SrListItem[] = [];
  for (let offset = 0; offset < SR_WINDOW; offset += 100) {
    const res = await fetch(`https://api.smartrecruiters.com/v1/companies/${encodeURIComponent(b.token)}/postings?limit=100&offset=${offset}`, { signal: AbortSignal.timeout(30_000) });
    if (!res.ok) throw new Error(`smartrecruiters ${b.token}: ${res.status}`);
    const page = (await res.json()) as { content?: SrListItem[]; totalFound?: number };
    items.push(...(page.content ?? []));
    if ((page.content ?? []).length < 100 || items.length >= (page.totalFound ?? 0)) break;
  }
  const window = items.slice(0, SR_WINDOW).filter((i) => i.id && i.ref);
  const keyOf = (i: SrListItem) => `smartrecruiters:${b.token}:${i.id}`;
  const seen = window.filter((i) => known.has(keyOf(i))).map(keyOf);
  // what the list says about the place of the postings already in the index (remote, not hybrid), so it is kept right without reading them again
  const remoteOf: Record<string, boolean> = {};
  for (const i of window) if (known.has(keyOf(i))) remoteOf[keyOf(i)] = i.location?.hybrid !== true && (i.location?.remote === true || REMOTE.test(i.name ?? ""));
  const fresh = window.filter((i) => !known.has(keyOf(i))).slice(0, SR_NEW_PER_RUN);
  const jobs: IndexedJob[] = [];
  const queue = [...fresh];
  const worker = async () => {
    for (let i = queue.shift(); i; i = queue.shift()) {
      try {
        const res = await fetch(i.ref as string, { signal: AbortSignal.timeout(20_000) });
        if (!res.ok) continue;
        const job = fromSmartRecruiters(b, i, (await res.json()) as SrDetail);
        if (job) jobs.push(job);
      } catch {
        /* this posting is read in the next run */
      }
    }
  };
  await Promise.all(Array.from({ length: 6 }, worker));
  return { jobs, seen, remoteOf };
}

interface RemotiveJob {
  id?: number;
  url?: string;
  title?: string;
  company_name?: string;
  company_logo?: string;
  category?: string;
  tags?: string[];
  job_type?: string;
  publication_date?: string;
  candidate_required_location?: string;
  salary?: string;
  description?: string;
}

export function fromRemotive(b: Board, j: RemotiveJob): IndexedJob | null {
  if (!j.id || !j.title || !j.url || !/^https?:\/\//.test(j.url)) return null;
  const full = htmlToText(String(j.description ?? ""), true);
  const location = nice(j.candidate_required_location || "Remote");
  return {
    key: `remotive:${j.id}`,
    source: "remotive",
    title: clip(nice(j.title), 200),
    company: clip(nice(j.company_name ?? ""), 200),
    location: clip(location, 200),
    remote: true,
    url: clip(j.url, 1000),
    postedAt: iso(j.publication_date),
    salary: j.salary ? clip(nice(j.salary), 80) : payFromText(full),
    tags: [nice(j.category ?? ""), nice(String(j.job_type ?? "").replace(/_/g, " ")), ...(j.tags ?? []).map(nice)].filter(Boolean).slice(0, 8),
    snippet: clip(nice(full), 380),
    description: clip(full, 6000),
    logo: typeof j.company_logo === "string" && /^https?:\/\//.test(j.company_logo) ? clip(j.company_logo, 500) : undefined,
    board: `remotive:${b.token}`,
    country: countryOf(location),
  };
}

interface ArbeitnowJob {
  slug?: string;
  company_name?: string;
  title?: string;
  description?: string;
  remote?: boolean;
  url?: string;
  tags?: string[];
  job_types?: string[];
  location?: string;
  created_at?: number;
}

export function fromArbeitnow(b: Board, j: ArbeitnowJob): IndexedJob | null {
  if (!j.slug || !j.title || !j.url || !/^https?:\/\//.test(j.url)) return null;
  const full = htmlToText(String(j.description ?? ""), true);
  const location = nice(j.location || (j.remote ? "Remote" : ""));
  return {
    key: `arbeitnow:${j.slug}`,
    source: "arbeitnow",
    title: clip(nice(j.title), 200),
    company: clip(nice(j.company_name ?? ""), 200),
    location: clip(location, 200),
    remote: j.remote === true,
    url: clip(j.url, 1000),
    postedAt: iso(typeof j.created_at === "number" ? j.created_at * 1000 : undefined),
    salary: payFromText(full),
    tags: [...(j.job_types ?? []), ...(j.tags ?? [])].map(nice).filter(Boolean).slice(0, 8),
    snippet: clip(nice(full), 380),
    description: clip(full, 6000),
    board: `arbeitnow:${b.token}`,
    // the feed is Germany and Europe: a place that does not say its country ("Nyon") is a European job, not one for a search in the US
    country: countryOf(location) ?? "EU",
  };
}


interface WorkableJob {
  title?: string;
  shortcode?: string;
  employment_type?: string;
  telecommuting?: boolean;
  department?: string;
  function?: string;
  url?: string;
  published_on?: string;
  created_at?: string;
  country?: string;
  city?: string;
  state?: string;
  locations?: { countryCode?: string }[];
  description?: string;
}

/** A Workable opening (the account's public list: www.workable.com/api/accounts/<name>?details=true). */
export function fromWorkable(b: Board, j: WorkableJob, companyName?: string): IndexedJob | null {
  if (!j.shortcode || !j.title || !j.url || !/^https?:\/\//.test(j.url)) return null;
  const full = text(String(j.description ?? ""));
  const location = nice([j.city, j.state, j.country].filter(Boolean).join(", "));
  return {
    key: `workable:${b.token}:${j.shortcode}`,
    source: "workable",
    title: clip(nice(j.title), 200),
    company: clip(nice(companyName || company(b)), 200),
    location: clip(location, 200),
    remote: j.telecommuting === true || REMOTE.test(j.title),
    url: clip(j.url, 1000),
    postedAt: iso(j.published_on) || iso(j.created_at),
    salary: payFromText(full, countryOf(location, j.locations?.[0]?.countryCode)),
    tags: [nice(j.department ?? ""), nice(j.function ?? ""), nice(j.employment_type ?? "")].filter(Boolean),
    snippet: clip(nice(full), 380),
    description: clip(full, 6000),
    board: `workable:${b.token}`,
    country: countryOf(location, j.locations?.[0]?.countryCode),
  };
}

interface RecruiteeOffer {
  id?: number;
  title?: string;
  status?: string;
  description?: string;
  requirements?: string;
  location?: string;
  city?: string;
  country_code?: string;
  company_name?: string;
  department?: string;
  remote?: boolean;
  careers_url?: string;
  published_at?: string;
  employment_type_code?: string;
  tags?: string[];
  salary?: { min?: number | null; max?: number | null; period?: string | null; currency?: string | null };
}

/** A Recruitee opening (the company's public list: <name>.recruitee.com/api/offers/). */
export function fromRecruitee(b: Board, o: RecruiteeOffer): IndexedJob | null {
  if (!o.id || !o.title || !o.careers_url || !/^https?:\/\//.test(o.careers_url) || (o.status && o.status !== "published")) return null;
  const full = text(`${o.description ?? ""}${o.requirements ? `<h3>Requirements</h3>${o.requirements}` : ""}`);
  const location = nice(o.location ?? o.city ?? "");
  return {
    key: `recruitee:${b.token}:${o.id}`,
    source: "recruitee",
    title: clip(nice(o.title), 200),
    company: clip(nice(o.company_name || company(b)), 200),
    location: clip(location, 200),
    remote: o.remote === true || REMOTE.test(o.title),
    url: clip(o.careers_url, 1000),
    postedAt: iso(String(o.published_at ?? "").replace(" UTC", "Z").replace(" ", "T")),
    salary: structuredPay(o.salary?.currency, o.salary?.min, o.salary?.max, o.salary?.period) ?? payFromText(full, countryOf(location, o.country_code)),
    tags: [nice(o.department ?? ""), nice(String(o.employment_type_code ?? "").replace(/_/g, " ")), ...(o.tags ?? []).map(nice)].filter(Boolean).slice(0, 8),
    snippet: clip(nice(full), 380),
    description: clip(full, 6000),
    board: `recruitee:${b.token}`,
    country: countryOf(location, o.country_code),
  };
}

interface TeamtailorItem {
  id?: string;
  url?: string;
  _jobposting?: {
    title?: string;
    description?: string;
    datePosted?: string;
    jobLocationType?: string;
    hiringOrganization?: { name?: string };
    jobLocation?: { address?: { addressLocality?: string; addressCountry?: string } }[];
    baseSalary?: { currency?: string; value?: { unitText?: string; value?: string | number; minValue?: string | number; maxValue?: string | number } };
  };
}

/** A Teamtailor opening (the career site's own feed: <name>.teamtailor.com/jobs.json, a JSON Feed with the schema.org JobPosting of each job). */
export function fromTeamtailor(b: Board, it: TeamtailorItem): IndexedJob | null {
  const p = it._jobposting;
  if (!it.id || !p?.title || !it.url || !/^https?:\/\//.test(it.url)) return null;
  const full = text(String(p.description ?? ""));
  const where = p.jobLocation?.[0]?.address;
  const location = nice([where?.addressLocality, where?.addressCountry].filter(Boolean).join(", "));
  const sal = p.baseSalary?.value;
  return {
    key: `teamtailor:${b.token}:${it.id}`,
    source: "teamtailor",
    title: clip(nice(p.title), 200),
    company: clip(nice(p.hiringOrganization?.name || company(b)), 200),
    location: clip(location, 200),
    remote: /telecommute/i.test(p.jobLocationType ?? "") || REMOTE.test(p.title),
    url: clip(it.url, 1000),
    postedAt: iso(p.datePosted),
    salary: structuredPay(p.baseSalary?.currency, sal?.minValue ?? sal?.value, sal?.maxValue ?? sal?.value, sal?.unitText) ?? payFromText(full, countryOf(location, where?.addressCountry)),
    tags: [],
    snippet: clip(nice(full), 380),
    description: clip(full, 6000),
    board: `teamtailor:${b.token}`,
    country: countryOf(location, where?.addressCountry),
  };
}

/** The countries whose jobs are asked of Get on Board (Latin America). */
export const GETONBOARD_COUNTRIES = ["CL", "PE", "CO", "MX", "AR", "UY", "EC", "CR", "BR", "PA", "DO", "GT", "BO", "PY", "VE"];
// (no pause in the tests)
const sleep = (ms: number) => (process.env.NODE_ENV === "test" ? Promise.resolve() : new Promise((r) => setTimeout(r, ms)));

interface GetOnBoardJob {
  id?: string;
  links?: { public_url?: string };
  attributes?: {
    title?: string;
    description_headline?: string;
    description?: string;
    projects?: string;
    functions_headline?: string;
    functions?: string;
    benefits_headline?: string;
    benefits?: string;
    desirable_headline?: string;
    desirable?: string;
    remote?: boolean;
    remote_modality?: string;
    countries?: string[];
    category_name?: string;
    min_salary?: number | null;
    max_salary?: number | null;
    published_at?: number;
    company?: { data?: { attributes?: { name?: string; logo?: string } } };
    seniority?: { data?: { attributes?: { name?: string } } };
    modality?: { data?: { attributes?: { name?: string } } };
    location_cities?: { data?: { attributes?: { name?: string } }[] };
    tags?: { data?: { attributes?: { name?: string } }[] };
  };
}

/** A Get on Board job (the public search of its API, with the company, the place and the skills expanded). The pay is in dollars per month. */
export function fromGetOnBoard(b: Board, j: GetOnBoardJob): IndexedJob | null {
  const a = j.attributes;
  const url = j.links?.public_url ?? "";
  if (!j.id || !a?.title || !/^https?:\/\//.test(url)) return null;
  // the sections of the job, each with the heading the company gave it
  const part = (head: string | undefined, html: string | undefined) => (html ? `<h3>${head ?? ""}</h3>${html}` : "");
  const full = text([part(a.description_headline, a.description), part(a.functions_headline, a.functions), part(a.desirable_headline, a.desirable), part(a.benefits_headline, a.benefits), part("", a.projects)].join(""));
  const cities = (a.location_cities?.data ?? []).map((c) => nice(c.attributes?.name ?? "")).filter(Boolean);
  const countries = (a.countries ?? []).map((c) => nice(String(c))).filter((c) => c && !/^remote$/i.test(c));
  const remote = a.remote === true;
  // "Remote" with the countries it is open to ("Remote, Chile, Colombia"), or the cities of the office
  const location = nice(remote ? ["Remote", ...countries].join(", ") : [...cities, ...countries].join(", ") || "");
  const company = nice(a.company?.data?.attributes?.name ?? "");
  const logo = a.company?.data?.attributes?.logo;
  return {
    key: `getonboard:${j.id}`,
    source: "getonboard",
    title: clip(nice(a.title), 200),
    company: clip(company, 200),
    location: clip(location, 200),
    remote,
    url: clip(url, 1000),
    postedAt: iso(typeof a.published_at === "number" ? a.published_at * 1000 : undefined),
    salary: structuredPay("USD", a.min_salary, a.max_salary, "MONTH"),
    tags: [nice(a.category_name ?? ""), nice(a.seniority?.data?.attributes?.name ?? ""), nice(a.modality?.data?.attributes?.name ?? ""), ...(a.tags?.data ?? []).map((t) => nice(t.attributes?.name ?? ""))].filter(Boolean).slice(0, 8),
    snippet: clip(nice(full), 380),
    description: clip(full, 6000),
    logo: typeof logo === "string" && /^https?:\/\//.test(logo) ? clip(logo, 500) : undefined,
    board: `getonboard:${b.token}`,
    // one country (an office or a country-only job) is where the job is; "Remote" or several countries is open to a region, so no country
    country: countries.length === 1 ? countryOf(countries[0]) : undefined,
  };
}

interface RemoteOkJob {
  id?: string | number;
  slug?: string;
  epoch?: number;
  company?: string;
  company_logo?: string;
  logo?: string;
  position?: string;
  tags?: string[];
  description?: string;
  location?: string;
  salary_min?: number;
  salary_max?: number;
  url?: string;
}

/** A Remote OK job. Its terms: link to its page (not an apply link of yours) and name Remote OK as the source; the job keeps its own link and the board is named. */
export function fromRemoteOk(b: Board, j: RemoteOkJob): IndexedJob | null {
  if (!j.id || !j.position || !j.url || !/^https:\/\/remoteok\.com\//i.test(j.url)) return null;
  const full = htmlToText(String(j.description ?? ""), true);
  const location = nice(j.location || "Remote");
  const logo = j.company_logo || j.logo;
  return {
    key: `remoteok:${j.id}`,
    source: "remoteok",
    title: clip(nice(j.position), 200),
    company: clip(nice(j.company ?? ""), 200),
    location: clip(location, 200),
    remote: true,
    url: clip(j.url, 1000),
    postedAt: iso(typeof j.epoch === "number" ? j.epoch * 1000 : undefined),
    salary: structuredPay("USD", j.salary_min, j.salary_max, "YEAR") ?? payFromText(full),
    tags: (j.tags ?? []).map(nice).filter(Boolean).slice(0, 8),
    snippet: clip(nice(full), 380),
    description: clip(full, 6000),
    logo: typeof logo === "string" && /^https?:\/\//.test(logo) ? clip(logo, 500) : undefined,
    board: `remoteok:${b.token}`,
    country: countryOf(location),
  };
}

interface JobicyJob {
  id?: number;
  url?: string;
  jobTitle?: string;
  companyName?: string;
  companyLogo?: string;
  jobIndustry?: string[];
  jobType?: string[];
  jobGeo?: string;
  jobLevel?: string;
  jobDescription?: string;
  pubDate?: string;
  salaryMin?: number;
  salaryMax?: number;
  salaryCurrency?: string;
  salaryPeriod?: string;
}

/** A Jobicy job. Its terms: credit Jobicy with a link and send the apply button to the job's address in its feed (that is `url`). */
export function fromJobicy(b: Board, j: JobicyJob): IndexedJob | null {
  if (!j.id || !j.jobTitle || !j.url || !/^https:\/\/jobicy\.com\//.test(j.url)) return null;
  const full = htmlToText(String(j.jobDescription ?? ""), true);
  const location = nice(j.jobGeo || "Remote");
  return {
    key: `jobicy:${j.id}`,
    source: "jobicy",
    title: clip(nice(decode(j.jobTitle)), 200),
    company: clip(nice(decode(j.companyName ?? "")), 200),
    location: clip(location.toLowerCase() === "anywhere" ? "Remote – anywhere" : `Remote – ${location}`, 200),
    remote: true,
    url: clip(j.url, 1000),
    postedAt: iso(String(j.pubDate ?? "").replace(" ", "T")),
    salary: structuredPay(j.salaryCurrency, j.salaryMin, j.salaryMax, j.salaryPeriod) ?? payFromText(full),
    tags: [...(j.jobIndustry ?? []), ...(j.jobType ?? []), nice(j.jobLevel ?? "")].map((t) => nice(decode(String(t)))).filter(Boolean).slice(0, 8),
    snippet: clip(nice(full), 380),
    description: clip(full, 6000),
    logo: typeof j.companyLogo === "string" && /^https?:\/\//.test(j.companyLogo) ? clip(j.companyLogo, 500) : undefined,
    board: `jobicy:${b.token}`,
    country: undefined,
  };
}

interface UsaJobsItem {
  MatchedObjectId?: string;
  MatchedObjectDescriptor?: {
    PositionTitle?: string;
    PositionURI?: string;
    PositionLocationDisplay?: string;
    PositionLocation?: { LocationName?: string; CountryCode?: string }[];
    OrganizationName?: string;
    DepartmentName?: string;
    JobCategory?: { Name?: string }[];
    JobGrade?: { Code?: string }[];
    QualificationSummary?: string;
    PositionRemuneration?: { MinimumRange?: string; MaximumRange?: string; Description?: string }[];
    PublicationStartDate?: string;
    ApplicationCloseDate?: string;
    UserArea?: { Details?: { JobSummary?: string; MajorDuties?: string[] | string; Requirements?: string; TeleworkEligible?: boolean; RemoteIndicator?: boolean; LowGrade?: string; HighGrade?: string } };
  };
}

/** A federal job of USAJOBS (the United States government's own board: public data). Gone from the board when its closing date has passed. */
export function fromUsaJobs(b: Board, item: UsaJobsItem, now = Date.now()): IndexedJob | null {
  const d = item.MatchedObjectDescriptor;
  const id = item.MatchedObjectId;
  const url = String(d?.PositionURI ?? "").replace(":443", "");
  if (!id || !d?.PositionTitle || !/^https:\/\/www\.usajobs\.gov\//.test(url)) return null;
  // its dates have no time zone: read as UTC, the same on every machine
  const utc = (v?: string) => (v && !/z$/i.test(v) && !/[+-]\d\d:?\d\d$/.test(v) ? `${v.slice(0, 19)}Z` : v);
  if (d.ApplicationCloseDate && Date.parse(utc(d.ApplicationCloseDate) as string) < now) return null;
  const u = d.UserArea?.Details;
  const duties = (Array.isArray(u?.MajorDuties) ? u?.MajorDuties : u?.MajorDuties ? [u.MajorDuties] : []).map((x) => nice(decode(String(x)))).filter(Boolean);
  const full = [
    u?.JobSummary ? nice(decode(u.JobSummary)) : "",
    duties.length ? `Duties\n${duties.map((x) => `- ${x}`).join("\n")}` : "",
    d.QualificationSummary ? `Qualifications\n${nice(decode(d.QualificationSummary))}` : "",
    u?.Requirements ? `Requirements\n${nice(decode(u.Requirements))}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
  const places = (d.PositionLocation ?? []).map((p) => nice(p.LocationName ?? "")).filter(Boolean);
  const location = places.length > 2 ? `${places.slice(0, 2).join("; ")} and ${places.length - 2} more` : places.join("; ") || nice(d.PositionLocationDisplay ?? "");
  const pay = d.PositionRemuneration?.[0];
  const grade = u?.LowGrade ? (u.HighGrade && u.HighGrade !== u.LowGrade ? `GS-${u.LowGrade} to GS-${u.HighGrade}` : `GS-${u.LowGrade}`) : "";
  return {
    key: `usajobs:${id}`,
    source: "usajobs",
    title: clip(nice(decode(d.PositionTitle)), 200),
    company: clip(nice(decode(d.OrganizationName || d.DepartmentName || "U.S. Government")), 200),
    location: clip(location, 200),
    remote: u?.RemoteIndicator === true || /anywhere in the u\.?s/i.test(d.PositionLocationDisplay ?? ""),
    url: clip(url, 1000),
    postedAt: iso(utc(d.PublicationStartDate)),
    salary: structuredPay("USD", pay?.MinimumRange, pay?.MaximumRange, pay?.Description),
    tags: [nice(d.DepartmentName ?? ""), ...(d.JobCategory ?? []).map((c) => nice(c.Name ?? "")), grade, u?.TeleworkEligible ? "Telework eligible" : ""].filter(Boolean).slice(0, 6),
    snippet: clip(nice(full), 380),
    description: clip(full, 6000),
    board: `usajobs:${b.token}`,
    country: "US",
  };
}

/** Every opening of one board. Throws when the board does not exist or the site is down: the ingestion reports it and moves on. */
export async function fetchBoard(b: Board): Promise<IndexedJob[]> {
  if (b.source === "smartrecruiters") throw new Error("smartrecruiters is read with fetchSmartRecruiters (it needs to know what the index already has)");
  if (b.source === "computrabajo") throw new Error("computrabajo is read with fetchComputrabajo (slowly, and it needs to know what the index already has)");
  if (b.source === "greenhouse") {
    const res = await fetch(`https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(b.token)}/jobs?content=true`, { signal: AbortSignal.timeout(30_000) });
    if (!res.ok) throw new Error(`greenhouse ${b.token}: ${res.status}`);
    const data = (await res.json()) as { jobs?: GreenhouseJob[] };
    return (data.jobs ?? []).map((j) => fromGreenhouse(b, j)).filter((j): j is IndexedJob => !!j);
  }
  if (b.source === "remotive") {
    // the feed of Remotive is read once a day (they ask for few requests): every current remote job in one request
    const res = await fetch("https://remotive.com/api/remote-jobs?limit=500", { headers: { Accept: "application/json", "User-Agent": "Kaizo-Resume-Builder/1.0" }, signal: AbortSignal.timeout(30_000) });
    if (!res.ok) throw new Error(`remotive: ${res.status}`);
    const data = (await res.json()) as { jobs?: RemotiveJob[] };
    return (data.jobs ?? []).map((j) => fromRemotive(b, j)).filter((j): j is IndexedJob => !!j);
  }
  if (b.source === "arbeitnow") {
    const out: IndexedJob[] = [];
    for (let page = 1; page <= 5; page++) {
      const res = await fetch(`https://www.arbeitnow.com/api/job-board-api?page=${page}`, { headers: { Accept: "application/json", "User-Agent": "Kaizo-Resume-Builder/1.0" }, signal: AbortSignal.timeout(30_000) });
      if (!res.ok) throw new Error(`arbeitnow: ${res.status}`);
      const data = (await res.json()) as { data?: ArbeitnowJob[] };
      const rows = data.data ?? [];
      out.push(...rows.map((j) => fromArbeitnow(b, j)).filter((j): j is IndexedJob => !!j));
      if (rows.length === 0) break;
    }
    return out;
  }
  if (b.source === "getonboard") {
    // The public search wants at least one filter, so it is read by what the board is for: the remote jobs, and the jobs of each country of Latin America.
    // A job can be in several of those lists: each is kept once. A short pause between requests (about thirty a run).
    const expand = encodeURIComponent(JSON.stringify(["company", "seniority", "modality", "location_cities", "tags"]));
    const searches = ["remote=true", ...GETONBOARD_COUNTRIES.map((c) => `country_code=${c}`)];
    const byKey = new Map<string, IndexedJob>();
    for (const search of searches) {
      for (let page = 1; page <= 8; page++) {
        const res = await fetch(`https://www.getonbrd.com/api/v0/search/jobs?${search}&per_page=100&page=${page}&expand=${expand}`, { headers: { Accept: "application/json", "User-Agent": "Kaizo-Resume-Builder/1.0" }, signal: AbortSignal.timeout(30_000) });
        if (!res.ok) throw new Error(`getonboard: ${res.status}`);
        const data = (await res.json()) as { data?: GetOnBoardJob[]; meta?: { total_pages?: number } };
        for (const j of data.data ?? []) {
          const job = fromGetOnBoard(b, j);
          if (job && !byKey.has(job.key)) byKey.set(job.key, job);
        }
        if ((data.data ?? []).length === 0 || page >= (data.meta?.total_pages ?? 1)) break;
        await sleep(400);
      }
      await sleep(400);
    }
    return [...byKey.values()];
  }
  if (b.source === "usajobs") {
    // Its API wants a key and the email it was requested with in the headers (both from the environment, never in an address or a log). The newest
    // jobs open to the public, up to 2,000 (the board has many thousands: the index is small).
    const key = process.env.USAJOBS_API_KEY;
    const email = process.env.USAJOBS_EMAIL;
    if (!key || !email) throw new Error("usajobs: USAJOBS_API_KEY and USAJOBS_EMAIL are not set");
    const out: IndexedJob[] = [];
    for (let page = 1; page <= 4; page++) {
      const res = await fetch(`https://data.usajobs.gov/api/search?ResultsPerPage=500&Page=${page}&WhoMayApply=public&SortField=opendate&SortDirection=Desc`, {
        headers: { Host: "data.usajobs.gov", "User-Agent": email, "Authorization-Key": key, Accept: "application/json" },
        signal: AbortSignal.timeout(30_000),
      });
      if (!res.ok) throw new Error(`usajobs: ${res.status}`);
      const data = (await res.json()) as { SearchResult?: { SearchResultItems?: UsaJobsItem[]; SearchResultCountAll?: number } };
      const items = data.SearchResult?.SearchResultItems ?? [];
      out.push(...items.map((i) => fromUsaJobs(b, i)).filter((j): j is IndexedJob => !!j));
      if (items.length < 500) break;
      await sleep(500);
    }
    return out;
  }
  if (b.source === "remoteok") {
    const res = await fetch("https://remoteok.com/api", { headers: { Accept: "application/json", "User-Agent": "Kaizo-Resume-Builder/1.0" }, signal: AbortSignal.timeout(30_000) });
    if (!res.ok) throw new Error(`remoteok: ${res.status}`);
    const rows = (await res.json()) as RemoteOkJob[];
    return (Array.isArray(rows) ? rows : []).map((j) => fromRemoteOk(b, j)).filter((j): j is IndexedJob => !!j); // (the first row is its terms, not a job: it has no position)
  }
  if (b.source === "jobicy") {
    const res = await fetch("https://jobicy.com/api/v2/remote-jobs?count=100", { headers: { Accept: "application/json", "User-Agent": "Kaizo-Resume-Builder/1.0" }, signal: AbortSignal.timeout(30_000) });
    if (!res.ok) throw new Error(`jobicy: ${res.status}`);
    const data = (await res.json()) as { jobs?: JobicyJob[] };
    return (data.jobs ?? []).map((j) => fromJobicy(b, j)).filter((j): j is IndexedJob => !!j);
  }
  if (b.source === "workable") {
    const res = await fetch(`https://www.workable.com/api/accounts/${encodeURIComponent(b.token)}?details=true`, { headers: { Accept: "application/json", "User-Agent": "Kaizo-Resume-Builder/1.0" }, signal: AbortSignal.timeout(30_000) });
    if (!res.ok) throw new Error(`workable ${b.token}: ${res.status}`);
    const data = (await res.json()) as { name?: string; jobs?: WorkableJob[] };
    return (data.jobs ?? []).map((j) => fromWorkable(b, j, data.name)).filter((j): j is IndexedJob => !!j);
  }
  if (b.source === "recruitee") {
    const res = await fetch(`https://${encodeURIComponent(b.token)}.recruitee.com/api/offers/`, { headers: { Accept: "application/json", "User-Agent": "Kaizo-Resume-Builder/1.0" }, signal: AbortSignal.timeout(30_000) });
    if (!res.ok) throw new Error(`recruitee ${b.token}: ${res.status}`);
    const data = (await res.json()) as { offers?: RecruiteeOffer[] };
    return (data.offers ?? []).map((o) => fromRecruitee(b, o)).filter((j): j is IndexedJob => !!j);
  }
  if (b.source === "teamtailor") {
    // the feed comes 100 at a time and says where the next page is; only that company's own address is followed, up to a thousand jobs
    const host = `${b.token}.teamtailor.com`;
    const out: IndexedJob[] = [];
    let next: string | undefined = `https://${host}/jobs.json`;
    for (let page = 0; next && page < 10; page++) {
      const res = await fetch(next, { headers: { Accept: "application/json", "User-Agent": "Kaizo-Resume-Builder/1.0" }, signal: AbortSignal.timeout(30_000) });
      if (!res.ok) throw new Error(`teamtailor ${b.token}: ${res.status}`);
      const data = (await res.json()) as { items?: TeamtailorItem[]; next_url?: string };
      out.push(...(data.items ?? []).map((it) => fromTeamtailor(b, it)).filter((j): j is IndexedJob => !!j));
      next = data.next_url && (data.items ?? []).length > 0 && new URL(data.next_url).hostname === host ? data.next_url : undefined;
    }
    return out;
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
