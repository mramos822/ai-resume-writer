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

/** What the AI is told when the person uses Kaizo in Spanish: the text it writes for the person is in neutral Spanish. */
export const langRule = (lang: ResumeLang, what: string, translate = false) =>
  lang === "en" && translate
    ? `\nLANGUAGE: write ${what} in English, translating anything in the resume that is in another language. Keep names, companies, product names and JSON keys exactly as they are.`
    : lang === "es" ? `\nLANGUAGE: write ${what} in neutral Latin American Spanish (use "tú", never "vos" or "vosotros"). Keep names, companies, product names and JSON keys exactly as they are.` : "";
