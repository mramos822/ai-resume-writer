import { STATE_NAMES } from "@/lib/place";

// Countries and their regions (states, provinces, departments...), loaded only when the contact step needs them.
export interface GeoCountry {
  name: string;
  isoCode: string;
}
export interface Geo {
  countries: GeoCountry[];
  /** names of the regions of a country, sorted; empty when the country has none */
  regionsOf: (iso: string) => string[];
}

let cached: Promise<Geo> | null = null;

export function loadGeo(): Promise<Geo> {
  if (!cached) {
    cached = Promise.all([import("country-state-city/lib/assets/country.json"), import("country-state-city/lib/assets/state.json")]).then(([c, s]) => {
      const countries = (c.default as { name: string; isoCode: string }[]).map((x) => ({ name: x.name, isoCode: x.isoCode })).sort((a, b) => a.name.localeCompare(b.name));
      const by: Record<string, string[]> = {};
      for (const st of s.default as { name: string; countryCode: string }[]) (by[st.countryCode] ??= []).push(st.name);
      for (const k of Object.keys(by)) by[k] = Array.from(new Set(by[k])).sort((a, b) => a.localeCompare(b));
      // the US list only has the 50 states and DC (the data also carries territories and military codes)
      by.US = Object.values(STATE_NAMES).sort((a, b) => a.localeCompare(b));
      return { countries, regionsOf: (iso: string) => by[iso] ?? [] };
    });
  }
  return cached;
}

const LABELS: Record<string, string> = {
  US: "State", CA: "Province", MX: "State", AU: "State", BR: "State", IN: "State", DE: "State", NG: "State", VE: "State", MY: "State",
  CO: "Department", BO: "Department", PY: "Department", UY: "Department", GT: "Department", HN: "Department", SV: "Department", NI: "Department", HT: "Department",
  PE: "Region", CL: "Region", NZ: "Region", IT: "Region", FR: "Region", RU: "Region",
  AR: "Province", EC: "Province", CR: "Province", PA: "Province", DO: "Province", CU: "Province", ES: "Province", NL: "Province", BE: "Province",
  CN: "Province", KR: "Province", PH: "Province", ID: "Province", ZA: "Province", TR: "Province", PL: "Voivodeship",
  GB: "County", IE: "County", PT: "District", JP: "Prefecture", CH: "Canton", AT: "State",
};
/** What this country calls its regions, for the field label. */
export const regionLabel = (iso?: string) => LABELS[iso ?? ""] ?? "State / Province";
