// The big cities of each country: a person who lives in a small town is also shown the jobs of the nearest one.
// "City|Region" when the name exists in several regions. There is no population in the places data, so the list is short and fixed.
import { fold } from "@/lib/fold";
import { kmBetween, placeIndex, type Origin } from "@/lib/jobPlaces";

const MAJOR: Record<string, string[]> = {
  us: ["New York City|New York", "Los Angeles|California", "Chicago|Illinois", "Houston|Texas", "Phoenix|Arizona", "Philadelphia|Pennsylvania", "San Antonio|Texas", "San Diego|California", "Dallas|Texas", "San Jose|California", "Austin|Texas", "Jacksonville|Florida", "Columbus|Ohio", "Charlotte|North Carolina", "Indianapolis|Indiana", "San Francisco|California", "Seattle|Washington", "Denver|Colorado", "Boston|Massachusetts", "Atlanta|Georgia", "Miami|Florida", "Detroit|Michigan", "Minneapolis|Minnesota", "Baltimore|Maryland", "Las Vegas|Nevada", "Portland|Oregon", "Nashville|Tennessee"],
  gb: ["London", "Birmingham", "Manchester", "Glasgow", "Liverpool", "Leeds", "Edinburgh", "Bristol", "Sheffield", "Cardiff"],
  mx: ["Ciudad de México", "Guadalajara", "Monterrey|Nuevo León", "Puebla|Puebla", "Tijuana", "León|Guanajuato", "Querétaro|Querétaro", "Mérida|Yucatán"],
  de: ["Berlin", "Hamburg", "Munich", "Köln", "Frankfurt am Main", "Stuttgart", "Düsseldorf", "Leipzig", "Dortmund", "Dresden"],
  es: ["Madrid", "Barcelona", "Valencia", "Sevilla", "Zaragoza", "Málaga", "Bilbao"],
  fr: ["Paris", "Marseille", "Lyon", "Toulouse", "Nice", "Nantes", "Strasbourg", "Bordeaux", "Lille"],
  it: ["Rome", "Milan", "Naples", "Turin", "Palermo", "Genoa", "Bologna", "Florence"],
  br: ["São Paulo", "Rio de Janeiro", "Brasília", "Belo Horizonte", "Salvador", "Fortaleza", "Curitiba", "Recife", "Porto Alegre", "Manaus"],
  ca: ["Toronto", "Montréal", "Vancouver", "Calgary", "Edmonton", "Ottawa", "Winnipeg", "Québec"],
  au: ["Sydney", "Melbourne", "Brisbane", "Perth|Western Australia", "Adelaide", "Canberra"],
  in: ["Mumbai", "Delhi", "Bengaluru", "Hyderabad", "Chennai", "Kolkata", "Pune", "Ahmedabad"],
  nl: ["Amsterdam", "Rotterdam", "The Hague", "Utrecht", "Eindhoven"],
  at: ["Vienna", "Graz", "Linz", "Salzburg", "Innsbruck"],
  be: ["Brussels", "Antwerpen", "Gent", "Liège", "Charleroi"],
  ch: ["Zürich", "Genève", "Basel", "Bern", "Lausanne"],
  nz: ["Auckland", "Wellington", "Christchurch", "Hamilton"],
  pl: ["Warszawa", "Kraków", "Łódź", "Wrocław", "Poznań", "Gdańsk"],
  sg: ["Singapore"],
  za: ["Johannesburg", "Cape Town", "Durban", "Pretoria"],
};

export interface MajorCity {
  /** "Houston, Texas": how it is searched */
  label: string;
  name: string;
  at: Origin;
  km: number;
}

/** The big city nearest to a point, between `minKm` and `maxKm` away (a city that is closer is already part of "near"). */
export function nearestMajorCity(country: string, from: Origin, minKm: number, maxKm: number): MajorCity | null {
  const c = country.toLowerCase() === "uk" ? "gb" : country.toLowerCase();
  const ix = placeIndex(c.toUpperCase());
  let best: MajorCity | null = null;
  for (const spec of MAJOR[c] ?? []) {
    const [name, region] = spec.split("|");
    const e = ix.entries.find((x) => x.kind === "city" && x.at && x.key === fold(name) && (!region || x.region === fold(region)));
    if (!e?.at) continue;
    const km = kmBetween(from, e.at);
    if (km >= minKm && km <= maxKm && (!best || km < best.km)) best = { label: e.label, name, at: e.at, km };
  }
  return best;
}
