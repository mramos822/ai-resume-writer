// Turns the address a resume gives ("640 Irvington Ave. Hillside, NJ 07205" or "Av. Larco 123, Miraflores, Lima, Perú") into the
// separate fields of the contact step: street, city, state/region, country and its ISO code. The AI is asked for the parts, but it
// often hands back one line or an abbreviation ("NJ"), so this fills in and normalizes what is missing, deterministically.
import countryData from "country-state-city/lib/assets/country.json";
import stateData from "country-state-city/lib/assets/state.json";
import { STATE_NAMES } from "@/lib/place";

type Country = { name: string; isoCode: string };
type Region = { name: string; isoCode: string; countryCode: string };
const COUNTRIES = countryData as Country[];
const REGIONS = stateData as Region[];

export interface ContactParts {
  address: string;
  city: string;
  state: string;
  country: string;
  countryCode: string;
}

const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

// the names a resume may use for a country that the data does not spell the same way (English and Spanish)
const COUNTRY_ALIASES: Record<string, string> = {
  usa: "US", us: "US", "u s": "US", "u s a": "US", "united states of america": "US", "estados unidos": "US", "ee uu": "US", eeuu: "US",
  uk: "GB", "u k": "GB", "great britain": "GB", england: "GB", scotland: "GB", wales: "GB", "reino unido": "GB",
  peru: "PE", mexico: "MX", espana: "ES", spain: "ES", brasil: "BR", alemania: "DE", francia: "FR", italia: "IT", canada: "CA",
  "republica dominicana": "DO", "costa rica": "CR", "puerto rico": "PR",
};

const countryByFolded = new Map<string, Country>(COUNTRIES.map((c) => [fold(c.name), c]));
const countryByIso = new Map<string, Country>(COUNTRIES.map((c) => [c.isoCode, c]));

/** The country a piece of text names ("USA", "Perú", "Peru", "PE"), or undefined. */
function findCountry(text: string): Country | undefined {
  const f = fold(text);
  if (!f) return undefined;
  const alias = COUNTRY_ALIASES[f];
  if (alias) return countryByIso.get(alias);
  const byName = countryByFolded.get(f);
  if (byName) return byName;
  // a bare two-letter code is only a country when it is not a US state ("IN", "CA", "DE" are both)
  if (/^[A-Za-z]{2}$/.test(text.trim()) && !STATE_NAMES[text.trim().toUpperCase()]) return countryByIso.get(text.trim().toUpperCase());
  return undefined;
}

const regionsOf = (iso: string) => REGIONS.filter((r) => r.countryCode === iso);

/** The region ("NJ", "New Jersey", "Lima", "ON") of a country, written in full, or undefined. */
function findRegion(text: string, iso: string): string | undefined {
  const t = text.trim();
  if (!t) return undefined;
  if (iso === "US") {
    const code = STATE_NAMES[t.toUpperCase()];
    if (code) return code;
    const full = Object.values(STATE_NAMES).find((n) => fold(n) === fold(t));
    return full;
  }
  const f = fold(t);
  const list = regionsOf(iso);
  const byCode = /^[A-Za-z0-9]{1,3}$/.test(t) ? list.find((r) => r.isoCode.toUpperCase() === t.toUpperCase()) : undefined;
  if (byCode) return byCode.name;
  const exact = list.find((r) => fold(r.name) === f);
  if (exact) return exact.name;
  // "Lima Province", "Departamento de Lima", "Lima Region"
  const loose = list.find((r) => {
    const n = fold(r.name);
    return n.length > 3 && (f.includes(n) || n.includes(f)) && Math.abs(n.length - f.length) <= 14;
  });
  return loose?.name;
}

const ZIP = /^(?:[A-Z]{1,2}\d[A-Z\d]? ?\d[A-Z]{2}|\d{4,6}(?:-\d{4})?)$/i; // 07205 · 07205-1234 · 15074 · SW1A 1AA

// "640 Irvington Ave. Hillside" -> street "640 Irvington Ave.", city "Hillside" (only when a street word ends the street part)
const STREET_WORDS =
  "street|st|avenue|ave|road|rd|boulevard|blvd|drive|dr|lane|ln|way|court|ct|place|pl|parkway|pkwy|highway|hwy|terrace|ter|circle|cir|square|sq|calle|avenida|av|jiron|jr|pasaje|psje|carrera|cra|camino|paseo";
const GLUED = new RegExp(`^(\\d[^,]*?\\b(?:${STREET_WORDS})\\b\\.?(?:\\s+(?:#|apt|unit|suite|ste|piso|dpto)\\.?\\s*[\\w-]+)?)\\s+([A-Za-z][A-Za-z .'\\-]+)$`, "i");

const hasDigit = (s: string) => /\d/.test(s);

/** Fills in street, city, region and country from what the AI gave (which may be just one line in `address`). */
export function normalizeContact(input: { address?: string; city?: string; state?: string; country?: string; countryCode?: string }): ContactParts {
  let address = (input.address ?? "").trim();
  let city = (input.city ?? "").trim();
  let state = (input.state ?? "").trim();
  let country = (input.country ?? "").trim();
  let iso = (input.countryCode ?? "").trim().toUpperCase();

  let found = country ? findCountry(country) : iso ? countryByIso.get(iso) : undefined;
  if (found) {
    iso = found.isoCode;
    country = found.name;
  }

  // one line only: take it apart from the end (country, zip, region, city), what is left is the street
  if (address && (!city || !state)) {
    const parts = address.split(/\s*,\s*/).filter(Boolean);
    let tail = parts.length;
    if (!found && tail > 1) {
      const c = findCountry(parts[tail - 1]);
      if (c) {
        found = c;
        iso = c.isoCode;
        country = c.name;
        tail--;
      }
    } else if (found && tail > 1 && findCountry(parts[tail - 1])?.isoCode === found.isoCode) tail--;
    // "NJ 07205" / "Lima 15074": the zip is dropped, the rest read as the region
    const clean = (s: string) => s.replace(/\s+\d{4,6}(-\d{4})?$/, "").replace(/\s+[A-Z]{1,2}\d[A-Z\d]? ?\d[A-Z]{2}$/i, "").trim();
    while (tail > 1 && ZIP.test(parts[tail - 1])) tail--;
    const regionIso = iso || "US";
    let region: string | undefined;
    if (tail > 1 || parts.length === 1) {
      const last = clean(parts[tail - 1] ?? "");
      region = !state ? findRegion(last, regionIso) : undefined;
      // no country given and it is not a US state: look among the countries that are usually written with a province code
      if (!region && !iso && !state) {
        for (const alt of ["CA", "AU", "MX"]) {
          const r = findRegion(last, alt);
          if (r) {
            region = r;
            iso = alt;
            found = countryByIso.get(alt);
            country = found?.name ?? "";
            break;
          }
        }
      }
      if (region) {
        state = region;
        if (!iso) {
          iso = "US";
          found = countryByIso.get("US");
          country = found?.name ?? "";
        }
        tail--;
      }
    }
    const rest = parts.slice(0, tail);
    if (!city && rest.length) {
      const last = rest[rest.length - 1];
      const glued = rest.length === 1 ? GLUED.exec(last) : null;
      if (glued) {
        rest[rest.length - 1] = glued[1].trim();
        city = glued[2].trim();
      } else if (rest.length > 1 || !hasDigit(last)) {
        // the piece next to the region is the city, unless it is clearly a street
        if (!hasDigit(last) || rest.length > 1) {
          city = last.trim();
          rest.pop();
        }
      }
    }
    address = rest.join(", ").trim();
  }

  // a region written as a code or loosely ("NJ", "Lima Province") becomes its full name
  if (state) {
    const r = findRegion(state, iso || "US");
    if (r) {
      state = r;
      if (!iso) {
        iso = "US";
        const us = countryByIso.get("US");
        country = us?.name ?? country;
      }
    }
  }

  return { address, city, state, country, countryCode: iso };
}
