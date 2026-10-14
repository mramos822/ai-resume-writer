// Safety net for what the AI returns when it reads a resume: even with a good prompt, models sometimes put the
// location or the role in the bullets, or glue the address onto an employer or school name. This fixes that
// deterministically, so the profile never shows "Newark, NJ" as an achievement or "NJIT, Newark, NJ" as a school.
import { detectSelfEmployed } from "@/lib/selfEmployed";
import type { ProfileData, JobEntry, EducationEntry } from "@/context/profileContext";

const STATE_CODES =
  "AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|DC";
const STATE_NAMES =
  "Alabama|Alaska|Arizona|Arkansas|California|Colorado|Connecticut|Delaware|Florida|Georgia|Hawaii|Idaho|Illinois|Indiana|Iowa|Kansas|Kentucky|Louisiana|Maine|Maryland|Massachusetts|Michigan|Minnesota|Mississippi|Missouri|Montana|Nebraska|Nevada|New Hampshire|New Jersey|New Mexico|New York|North Carolina|North Dakota|Ohio|Oklahoma|Oregon|Pennsylvania|Rhode Island|South Carolina|South Dakota|Tennessee|Texas|Utah|Vermont|Virginia|Washington|West Virginia|Wisconsin|Wyoming";
const COUNTRY = "USA|U\\.S\\.A\\.|US|U\\.S\\.|United States|United States of America";

// "Newark, NJ" · "Newark, NJ 07102" · "Newark, New Jersey" · "Newark, NJ, United States" · "Remote"
const PLACE = new RegExp(
  `^(remote|hybrid|on-?site|(remote|hybrid)\\s*[,(/-]\\s*(${COUNTRY}))$|^[A-Za-z][A-Za-z .'\\-]*(,\\s*[A-Za-z][A-Za-z .'\\-]*)*,\\s*(${STATE_CODES}|${STATE_NAMES})(\\s+\\d{5}(-\\d{4})?)?(,\\s*(${COUNTRY}))?$`,
  "i"
);
const STREET = /^\d+\s+[A-Za-z0-9 .'\-]+\b(street|st|avenue|ave|road|rd|boulevard|blvd|drive|dr|lane|ln|way|court|ct|place|pl|hwy|highway)\b/i;

const norm = (s?: string) => (s ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** True when the whole text is only a place (city/state, "Remote"…) or a street address. */
export function looksLikePlace(text: string): boolean {
  const t = text.trim().replace(/[.;]+$/, "");
  return t.length > 0 && t.length <= 70 && (PLACE.test(t) || STREET.test(t));
}

/** A date or date range on its own line, like "May 2021 - Present" or "2019 – 2021". */
function looksLikeDates(text: string): boolean {
  const t = text.trim();
  const month = "(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\\.?";
  return new RegExp(`^(${month}\\s+)?\\d{4}\\s*(-|–|—|to)\\s*((${month}\\s+)?\\d{4}|present|current|now)$`, "i").test(t);
}

/**
 * "New Jersey Institute of Technology, Newark, NJ" -> { name: "New Jersey Institute of Technology", place: "Newark, NJ" }.
 * Only splits when what follows the comma really is a place, so "University of California, Berkeley" stays whole.
 */
export function splitPlace(text: string): { name: string; place: string } {
  const t = (text ?? "").trim();
  for (let i = t.indexOf(","); i !== -1; i = t.indexOf(",", i + 1)) {
    const rest = t.slice(i + 1).trim();
    if (looksLikePlace(rest) || looksLikePlace(rest.replace(/^,\s*/, ""))) {
      return { name: t.slice(0, i).trim(), place: rest.replace(/[.;]+$/, "") };
    }
  }
  return { name: t, place: "" };
}

function cleanBullets(list: string[] | undefined, job: { title?: string; company?: string; location?: string }): string[] {
  const t = norm(job.title);
  const c = norm(job.company);
  const l = norm(job.location);
  const known = new Set(
    [t, c, l, `${t} ${c}`, `${c} ${t}`, `${t} at ${c}`, `${t} ${l}`, `${c} ${l}`, `${t} ${c} ${l}`].filter(Boolean)
  );
  const seen = new Set<string>();
  return (list ?? [])
    .map((b) => (typeof b === "string" ? b.trim() : ""))
    .filter((b) => {
      const n = norm(b);
      if (!n || seen.has(n)) return false;
      if (known.has(n) || looksLikePlace(b) || looksLikeDates(b)) return false;
      seen.add(n);
      return true;
    });
}

// a web address ("mygeochallenge.com", "https://www.acme.io/jobs"): the resume sometimes shows the link of a company or project where its name goes
const WEB_ADDRESS = /^(?:https?:\/\/)?(?:www\.)?([a-z0-9][a-z0-9-]*)(?:\.[a-z0-9-]+)+(?:[/?#]\S*)?$/i;

/**
 * The name of an organization for a web address: the way the resume writes it elsewhere in the job (so "mygeochallenge.com" becomes
 * "myGeoChallenge" when a bullet says so), or else the name of the site, with a capital letter.
 */
export function nameFromWebAddress(company: string, texts: string[] = []): string {
  const m = WEB_ADDRESS.exec(company.trim());
  if (!m) return company;
  const label = m[1];
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const written = new RegExp(`\\b${escaped}\\b`, "i").exec(texts.join("\n"));
  return written ? written[0] : label.charAt(0).toUpperCase() + label.slice(1);
}

function cleanJob<T extends Partial<JobEntry>>(j: T): T {
  // the company is a name, never a link
  let company = nameFromWebAddress((j.company ?? "").trim(), [j.title ?? "", j.description ?? "", ...(j.accomplishments ?? [])]);
  let location = (j.location ?? "").trim();
  const split = splitPlace(company);
  if (split.place) {
    company = split.name;
    if (!location) location = split.place;
  }
  const description = (j.description ?? "").trim();
  // (a "false" from the AI does not block it: the company, the title and the first lines are read too)
  const self = j.selfEmployed === true || detectSelfEmployed({ ...j, selfEmployed: undefined, company, description });
  return {
    ...j,
    company,
    location,
    // working for oneself (freelance, own business): the box "I work for myself" is ticked from the start
    ...(self ? { selfEmployed: true } : {}),
    // a description that is just the place or the role is not a description
    description: looksLikePlace(description) || norm(description) === norm(j.title) ? "" : description,
    accomplishments: cleanBullets(j.accomplishments, { title: j.title, company, location }),
  };
}

function cleanEdu<T extends Partial<EducationEntry>>(e: T): T {
  let school = (e.school ?? "").trim();
  let location = (e.location ?? "").trim();
  const split = splitPlace(school);
  if (split.place) {
    school = split.name;
    if (!location) location = split.place;
  }
  return { ...e, school, location };
}

/** Applies all the clean-ups to a parsed profile. */
export function cleanParsedProfile<T extends Partial<ProfileData>>(parsed: T): T {
  return {
    ...parsed,
    jobHistory: (parsed.jobHistory ?? []).map(cleanJob),
    internships: (parsed.internships ?? []).map(cleanJob),
    education: (parsed.education ?? []).map(cleanEdu),
  };
}
