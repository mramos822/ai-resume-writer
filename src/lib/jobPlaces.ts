// Places for the job search, from the data the profile already has (no call to the internet, so it answers at once):
//  - suggestions as you type: "gua" in Mexico gives "Guadalajara, Jalisco", "Guanajuato", ...
//  - reading what was typed: "Hillside NJ", "hillside, new jersey" and "Hillside" all mean Hillside, New Jersey
import { City, State } from "country-state-city";
import { fold } from "@/lib/fold";
import { US_STATES } from "@/lib/place";

export interface Suggestion {
  /** what goes into the box: "Guadalajara, Jalisco" (a city) or "Jalisco" (a region) */
  label: string;
  kind: "city" | "region";
}

export interface Origin {
  lat: number;
  lon: number;
}

export interface Entry extends Suggestion {
  /** the name of the city or region, folded */
  key: string;
  /** the folded name of its region (for a region, its own) */
  region: string;
  /** the position of a city */
  at?: Origin;
}

export interface Index {
  entries: Entry[];
  /** a region by its folded name or its code ("new jersey", "nj") */
  regions: Map<string, string>;
}

const indexes = new Map<string, Index>();

export function placeIndex(iso: string): Index {
  const hit = indexes.get(iso);
  if (hit) return hit;
  let states = State.getStatesOfCountry(iso);
  if (iso === "US") states = states.filter((s) => US_STATES.includes(s.name)); // the 50 states and DC, without territories
  const regions = new Map<string, string>();
  const byCode = new Map<string, { name: string; key: string }>();
  const entries: Entry[] = [];
  for (const s of states) {
    const key = fold(s.name);
    regions.set(key, key);
    // a code only counts for a country that writes places like "Hillside NJ"; elsewhere it could be a word of a city
    if (/^[A-Za-z]{2,3}$/.test(s.isoCode)) regions.set(s.isoCode.toLowerCase(), key);
    byCode.set(s.isoCode, { name: s.name, key });
    entries.push({ label: s.name, kind: "region", key, region: key });
  }
  const seen = new Set<string>();
  for (const c of City.getCitiesOfCountry(iso) ?? []) {
    const st = byCode.get(c.stateCode);
    if (!st) continue;
    const name = c.name.replace(/\s+(Municipality|Municipio|District)$/i, "");
    const label = `${name}, ${st.name}`;
    if (seen.has(label)) continue;
    seen.add(label);
    const lat = Number(c.latitude);
    const lon = Number(c.longitude);
    entries.push({ label, kind: "city", key: fold(name), region: st.key, at: Number.isFinite(lat) && Number.isFinite(lon) && (lat || lon) ? { lat, lon } : undefined });
  }
  const made = { entries, regions };
  indexes.set(iso, made);
  return made;
}

/** What was typed split in a city part and a region part: "Hillside NJ" -> { city: "hillside", region: "new jersey" }. */
function readTyped(ix: Index, typed: string): { city: string; region: string } {
  const words = fold(typed.replace(/,/g, " ")).split(" ").filter(Boolean);
  // the last one to three words may be the region ("new jersey" alone is only a region: no city is left)
  for (let n = Math.min(3, words.length); n >= 1; n--) {
    const region = ix.regions.get(words.slice(-n).join(" "));
    if (region) return { city: words.slice(0, -n).join(" "), region };
  }
  return { city: words.join(" "), region: "" };
}

const byLength = (a: Entry, b: Entry) => (a.kind === b.kind ? a.key.length - b.key.length || a.label.localeCompare(b.label) : a.kind === "region" ? -1 : 1);

/** Up to `max` places of a country that match what was typed: the ones that start with it first, then the ones that contain it. */
export function suggestPlaces(country: string, typed: string, max = 8): Suggestion[] {
  const ix = placeIndex(country.toUpperCase());
  const { city, region } = readTyped(ix, typed);
  if (!city && !region) return [];
  const starts: Entry[] = [];
  const has: Entry[] = [];
  for (const e of ix.entries) {
    if (region && e.region !== region) continue;
    if (!city) {
      if (e.kind === "region") starts.push(e); // just a region typed: that region first, then its cities below
      else has.push(e);
    } else if (e.key.startsWith(city)) starts.push(e);
    else if (city.length >= 3 && e.key.includes(city)) has.push(e);
  }
  return [...starts.sort(byLength), ...has.sort(byLength)].slice(0, max).map(({ label, kind }) => ({ label, kind }));
}

export interface ReadPlace {
  /** the place as it should be searched: "Hillside, New Jersey" */
  label: string;
  /** where it is, when it is a city */
  at?: Origin;
}

/** The place the person meant, even if they wrote it loosely ("Hillside NJ"); null when it is not in the list (it is then searched as typed). */
export function readPlace(country: string, typed: string): ReadPlace | null {
  const ix = placeIndex(country.toUpperCase());
  const { city, region } = readTyped(ix, typed);
  if (!city && !region) return null;
  const pool = ix.entries.filter((e) => (!region || e.region === region) && (city ? e.kind === "city" : e.kind === "region"));
  const exact = pool.filter((e) => e.key === city || (!city && e.kind === "region"));
  const near = exact.length ? exact : pool.filter((e) => city.length >= 3 && e.key.startsWith(city));
  // several places with that name ("Hillside" is in three states): better not to guess, it is searched as typed
  return near.length === 1 ? { label: near[0].label, at: near[0].at } : null;
}

/** Distance in km between two points on the Earth. */
export function kmBetween(a: Origin, b: Origin): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lon - a.lon) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
}
