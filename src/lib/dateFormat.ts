// src/lib/dateFormat.ts
// Pure date/period formatters shared by the UI and the LaTeX resume renderer.
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_ES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/** The language a resume is written in (its headings, months and "Present"), not the language of the page. */
export type ResumeLang = "en" | "es";
export const asResumeLang = (v: unknown): ResumeLang => (v === "es" ? "es" : "en");

/** "2018-09" -> "Sep 2018"; anything else is returned unchanged. */
export function formatMonth(value?: string, lang: ResumeLang = "en"): string {
  const m = /^(\d{4})-(\d{2})/.exec(value || "");
  return m ? `${(lang === "es" ? MONTHS_ES : MONTHS)[Number(m[2]) - 1]} ${m[1]}` : value || "";
}

interface Period {
  startDate?: string;
  endDate?: string;
  current?: boolean;
  dates?: string; // legacy free-text education period
}

/** "Sep 2018 – May 2022" or "Sep 2022 – Present" */
export function formatPeriod(e: Period, separator = " – ", lang: ResumeLang = "en"): string {
  if (!e.startDate && !e.endDate && !e.current) return e.dates || "";
  const end = e.current || !e.endDate ? (lang === "es" ? "Actualidad" : "Present") : formatMonth(e.endDate, lang);
  return [formatMonth(e.startDate, lang), end].filter(Boolean).join(separator);
}

/** This month as "YYYY-MM": the latest date a start or an end date can have. */
export const currentMonth = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};
