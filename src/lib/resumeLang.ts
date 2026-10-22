import { asResumeLang, type ResumeLang } from "@/lib/dateFormat";

export { asResumeLang, type ResumeLang };

const ES_WORDS = new Set("de la el en y los las con para del una por que se un es al su sus como más experiencia trabajo empresa equipo puesto requisitos ofrecemos buscamos estamos habilidades conocimientos".split(" "));
const EN_WORDS = new Set("the and of to in for with you will our we is are a an as be on or your experience work team role skills required requirements looking join responsibilities about".split(" "));

/** The language a job posting is written in, when it is clearly Spanish or English; null when it is not clear (or another language). */
export function jobLang(text: string): ResumeLang | null {
  let es = 0;
  let en = 0;
  for (const w of text.toLowerCase().split(/[^a-záéíóúñü]+/)) {
    if (ES_WORDS.has(w)) es++;
    if (EN_WORDS.has(w)) en++;
  }
  if (es + en < 8) return null;
  return es >= en * 1.5 ? "es" : en >= es * 1.5 ? "en" : null;
}

/** Countries where the job postings are written in Spanish or in English (the two languages a resume can be written in here). */
const ES_COUNTRIES = new Set(["es", "mx", "ar", "cl", "co", "pe", "ec", "uy", "ve", "cr", "pa", "do", "bo", "py", "gt", "hn", "ni", "sv", "cu", "pr"]);
const EN_COUNTRIES = new Set(["us", "gb", "uk", "ie", "ca", "au", "nz", "sg", "za", "in"]);
/** The language of the postings of a country, when it is Spanish or English; null for any other (the resume cannot be written in it yet). */
export const langOfCountry = (country?: string): ResumeLang | null => {
  const c = (country ?? "").toLowerCase();
  return ES_COUNTRIES.has(c) ? "es" : EN_COUNTRIES.has(c) ? "en" : null;
};

/**
 * The language of the resume made for ONE job: the one the posting is written in (read from its text), else the one of its country, else the
 * one the person uses the app in. The profile itself is not changed: only this resume is written (and translated) in that language.
 */
export const resumeLangForJob = (job: { title: string; description?: string; snippet: string; country?: string }, appLang: unknown): ResumeLang =>
  jobLang(`${job.title}. ${job.description || job.snippet}`) ?? langOfCountry(job.country) ?? asResumeLang(appLang);

/** What the AI is told when the person uses Kaizo in Spanish: the text it writes for the person is in neutral Spanish. */
export const langRule = (lang: ResumeLang, what: string, translate = false) =>
  lang === "en" && translate
    ? `\nLANGUAGE: write ${what} in English, translating anything in the resume that is in another language. Keep names, companies, product names and JSON keys exactly as they are.`
    : lang === "es" ? `\nLANGUAGE: write ${what} in neutral Latin American Spanish (use "tú", never "vos" or "vosotros"). Keep names, companies, product names and JSON keys exactly as they are.` : "";
