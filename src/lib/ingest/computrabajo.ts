// Computrabajo (Peru, Chile and the rest of Latin America): a job portal with no public API. Its terms allow reading the postings and its robots.txt
// leaves the postings and the searches by title open (it closes the filters by query, /Ajax/, /go/ and the resumes), so this reads only those.
// It is slow on purpose, a guest in somebody else's house:
//  - one request at a time, with more than a second between any two (shared by every board, so many boards never add up),
//  - a posting is read ONCE: the ones already in the index are only counted as still open,
//  - a run reads a few dozen new postings at most; the rest wait for the next one,
//  - when the site turns a request away (403, 429) it stops at once and tries again in the next run,
//  - it says who it is (the user agent names the project).
// What is kept is the posting itself (the text, the place, the pay, the date) with the link to apply on Computrabajo; no person's data.
import { decode, htmlToText } from "@/lib/jobAdText";
import type { Board } from "@/lib/ingest/boards";
import type { IndexedJob } from "@/lib/ingest/ats";
import { payFromText, structuredPay } from "@/lib/ingest/pay";

/** The portal of each country. */
export const CT_SITES: Record<string, { host: string; country: string }> = {
  pe: { host: "pe.computrabajo.com", country: "PE" },
  cl: { host: "cl.computrabajo.com", country: "CL" },
};
/** The searches of each group: /trabajo-de-<what>. A board is a country and a group ("pe:tech"), so one run is one small piece and never a whole country. */
export const CT_GROUPS: Record<string, string[]> = {
  tech: ["desarrollador", "programador", "analista-de-sistemas", "soporte-tecnico", "ingeniero-de-software", "analista-de-datos"],
  admin: ["administrativo", "asistente-administrativo", "contador", "recursos-humanos", "secretaria"],
  sales: ["ventas", "asesor-comercial", "atencion-al-cliente", "marketing", "ejecutivo-comercial"],
  ops: ["operario", "almacen", "logistica", "conductor", "supervisor"],
  health: ["enfermera", "medico", "farmacia", "tecnico-de-enfermeria"],
  engineering: ["ingeniero-civil", "ingeniero-industrial", "mecanico", "electricista", "ingeniero"],
  entry: ["practicante", "auxiliar", "sin-experiencia"],
};
export const CT_PAGES = 2;
/** new postings read in one run */
export const CT_NEW_PER_RUN = 40;
/** the time (ms) the site is given between two requests */
export const CT_PACE_MS = 1200;
/** a run stops starting new requests after this long, so it always ends inside the time a function may run */
export const CT_BUDGET_MS = 48_000;
const USER_AGENT = "Mozilla/5.0 (compatible; Kaizo-Resume-Builder/1.0)";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let nextAt = 0;
let pace = CT_PACE_MS;
/** For the tests: the time between requests. */
export const setPace = (ms: number) => {
  pace = ms;
  nextAt = 0;
};
/** Waits for this request's turn: any two requests of any board are at least `pace` apart. */
async function turn(): Promise<void> {
  const now = Date.now();
  const at = Math.max(now, nextAt);
  nextAt = at + pace + (pace > 0 ? Math.floor(Math.random() * 300) : 0); // a little irregular, like a person
  if (at > now) await sleep(at - now);
}

/** Thrown when the site turns the request away: the run stops (it is not insisted on). */
export class BlockedError extends Error {}

async function get(url: string): Promise<string | null> {
  await turn();
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT, Accept: "text/html", "Accept-Language": "es" }, signal: AbortSignal.timeout(20_000), redirect: "follow" });
  if (res.status === 403 || res.status === 429 || res.status === 503) throw new BlockedError(`computrabajo: ${res.status}`);
  if (!res.ok) return null;
  return res.text();
}

/** What robots.txt leaves open: a posting or a search by title, with no query that filters. */
export function allowed(path: string): boolean {
  if (/[?*]/.test(path) && !/^\/trabajo-de-[a-z0-9-]+\?p=\d+$/.test(path)) return false;
  return !/^\/(Ajax|_services|go|hojas-de-vida|curriculums)\b/i.test(path);
}

// (the links of a list end with a mark of where they were clicked: "...-<id>#lc=ListOffers-Score4-0"; the mark is left out)
const OFFER = /href="(\/ofertas-de-trabajo\/oferta-de-trabajo-de-[^"#?\s]*-([0-9A-F]{32}))(?:#[^"]*)?"/g;
/** The postings a list page links to, in the order of the page, each once. */
export function offersOn(html: string): { path: string; id: string }[] {
  const seen = new Set<string>();
  const out: { path: string; id: string }[] = [];
  for (const m of html.matchAll(OFFER)) {
    if (seen.has(m[2]) || !allowed(m[1])) continue;
    seen.add(m[2]);
    out.push({ path: m[1], id: m[2] });
  }
  return out;
}

interface JobPostingData {
  title?: string;
  description?: string;
  industry?: string;
  datePosted?: string;
  validThrough?: string;
  employmentType?: string | string[];
  hiringOrganization?: { name?: string; logo?: string };
  jobLocation?: { address?: { addressLocality?: string; addressRegion?: string } } | { address?: { addressLocality?: string; addressRegion?: string } }[];
  baseSalary?: { currency?: string; value?: { value?: unknown; minValue?: unknown; maxValue?: unknown; unitText?: string } };
}

/** The JobPosting the page publishes as data (it can be alone or inside a "@graph"). */
export function jobPostingOf(html: string): JobPostingData | null {
  for (const m of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const data = JSON.parse(m[1]);
      const nodes: unknown[] = Array.isArray(data) ? data : Array.isArray(data?.["@graph"]) ? data["@graph"] : [data];
      const hit = nodes.find((x) => x && typeof x === "object" && /JobPosting/i.test(String((x as { "@type"?: unknown })["@type"])));
      if (hit) return hit as JobPostingData;
    } catch {
      /* another block */
    }
  }
  return null;
}

const iso = (v: unknown): string => {
  const t = Date.parse(String(v ?? ""));
  return Number.isFinite(t) && t > 0 ? new Date(t).toISOString() : "";
};
const nice = (s: string) => s.replace(/\s+/g, " ").trim();
const clip = (s: string, n: number) => s.slice(0, n);
const TYPES: Record<string, string> = { FULL_TIME: "Full time", PART_TIME: "Part time", CONTRACTOR: "Contract", TEMPORARY: "Temporary", INTERN: "Internship", VOLUNTEER: "Volunteer" };
const REMOTE_ES = /\b(remot[oa]|teletrabajo|trabajo desde casa|home office|100% virtual)\b/i;

/** A Computrabajo posting (its page, with the data it publishes) as a job of the index; null when it is not one or its time is over. */
export function fromComputrabajo(b: Board, html: string, path: string, id: string, now = Date.now()): IndexedJob | null {
  const site = CT_SITES[b.token.split(":")[0]];
  const p = jobPostingOf(html);
  if (!site || !p?.title || !p.description) return null;
  if (p.validThrough && Date.parse(p.validThrough) < now) return null; // the offer is over
  const full = htmlToText(decode(String(p.description)), true);
  const place = (Array.isArray(p.jobLocation) ? p.jobLocation[0] : p.jobLocation)?.address;
  const location = nice([place?.addressLocality, place?.addressRegion].filter(Boolean).join(", "));
  const s = p.baseSalary?.value;
  const types = (Array.isArray(p.employmentType) ? p.employmentType : [p.employmentType ?? ""]).map((t) => TYPES[String(t)] ?? "").filter(Boolean);
  return {
    key: `computrabajo:${b.token.split(":")[0]}:${id}`,
    source: "computrabajo",
    title: clip(nice(decode(p.title)), 200),
    company: clip(nice(decode(p.hiringOrganization?.name ?? "")), 200),
    location: clip(location, 200),
    remote: REMOTE_ES.test(p.title) || REMOTE_ES.test(full.slice(0, 600)),
    url: `https://${site.host}${path}`,
    postedAt: iso(p.datePosted),
    salary: structuredPay(p.baseSalary?.currency, s?.minValue ?? s?.value, s?.maxValue ?? s?.value, s?.unitText) ?? payFromText(full, site.country),
    tags: [...types, nice(p.industry ?? "")].filter(Boolean).slice(0, 6),
    snippet: clip(nice(full), 380),
    description: clip(full, 6000),
    logo: typeof p.hiringOrganization?.logo === "string" && /^https?:\/\//.test(p.hiringOrganization.logo) ? clip(p.hiringOrganization.logo, 500) : undefined,
    board: `computrabajo:${b.token}`,
    country: site.country,
  };
}

/**
 * The postings of the searches of one board. A posting already in the index (`known`) is not read again: it only counts as still open.
 * Of the new ones at most CT_NEW_PER_RUN are read in full (the rest wait for the next run).
 */
export async function fetchComputrabajo(b: Board, known: Set<string>, deadline = Date.now() + CT_BUDGET_MS): Promise<{ jobs: IndexedJob[]; seen: string[]; remoteOf: Record<string, boolean> }> {
  const [siteId, group] = b.token.split(":");
  const site = CT_SITES[siteId];
  const slugs = CT_GROUPS[group ?? ""];
  if (!site || !slugs) throw new Error(`computrabajo: unknown board ${b.token}`);

  // the lists (the blocked case ends the run: nothing is closed because of it)
  const listed = new Map<string, string>();
  for (const slug of slugs) {
    for (let page = 1; page <= CT_PAGES; page++) {
      if (Date.now() > deadline) break;
      const html = await get(`https://${site.host}/trabajo-de-${slug}${page > 1 ? `?p=${page}` : ""}`);
      const offers = html ? offersOn(html) : [];
      for (const o of offers) if (!listed.has(o.id)) listed.set(o.id, o.path);
      if (offers.length === 0) break;
    }
  }

  const keyOf = (id: string) => `computrabajo:${siteId}:${id}`;
  const seen = [...listed.keys()].filter((id) => known.has(keyOf(id))).map(keyOf);
  const fresh = [...listed].filter(([id]) => !known.has(keyOf(id))).slice(0, CT_NEW_PER_RUN);
  const jobs: IndexedJob[] = [];
  for (const [id, path] of fresh) {
    if (Date.now() > deadline) break;
    try {
      const html = await get(`https://${site.host}${path}`);
      const job = html ? fromComputrabajo(b, html, path, id) : null;
      if (job) jobs.push(job);
    } catch (e) {
      if (e instanceof BlockedError) break; // turned away: what was read is kept, the rest waits for another run
      /* this posting is read in the next run */
    }
  }
  return { jobs, seen, remoteOf: {} };
}
