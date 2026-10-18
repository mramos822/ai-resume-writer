// "Remote" as a place of the job search (it replaces the "Remote jobs only" check box), and how well a remote job fits a country.

/** What the place box holds when the person chooses remote work. */
export const REMOTE_PLACE = "Remote";

/** True when the place is "Remote" (or "Remoto"): the search is then for remote jobs, not for a city. */
export const isRemotePlace = (place: string): boolean => /^(remote|remoto)$/i.test(place.trim());

// other ways to name a country in a job post, besides its name in English and its two-letter code
const ALIASES: Record<string, string[]> = {
  us: ["usa", "u.s.", "u.s.a", "united states", "america", "north america", "americas"],
  gb: ["uk", "u.k.", "united kingdom", "great britain", "britain", "england", "scotland", "wales"],
  ae: ["uae", "emirates"],
  de: ["deutschland"],
  nl: ["holland"],
};
const GLOBAL = /\b(worldwide|world wide|anywhere|global|globally|everywhere|any ?where|all countries)\b/i;

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function countryNames(code: string): string[] {
  const c = code.toLowerCase();
  let name = "";
  try {
    name = new Intl.DisplayNames(["en"], { type: "region" }).of(c.toUpperCase()) ?? "";
  } catch {
    /* no Intl names: the code and the aliases are enough */
  }
  return [name.toLowerCase(), ...(ALIASES[c] ?? [])].filter(Boolean);
}

/**
 * How well a remote job fits the country of the search: 0 it names that country, 1 it can be done from anywhere (or does not say), 2 it is
 * for another country or region. `local` marks a job that came from a source that searched by that country already (it counts as 0).
 */
export function remoteCountryFit(job: { location: string; local?: boolean }, country: string): 0 | 1 | 2 {
  if (job.local) return 0;
  const loc = job.location.toLowerCase().trim();
  if (!loc || loc === "remote") return 1;
  const code = country.toLowerCase();
  const names = countryNames(code);
  const hit = names.some((n) => new RegExp(`(^|[^a-z])${escape(n)}($|[^a-z])`, "i").test(loc)) || (code.length === 2 && new RegExp(`(^|[^a-z])${escape(code)}($|[^a-z])`, "i").test(loc));
  if (hit) return 0;
  if (GLOBAL.test(loc)) return 1;
  return 2;
}
