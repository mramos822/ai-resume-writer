// src/lib/dateFormat.ts
// Pure date/period formatters shared by the UI and the LaTeX resume renderer.
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2018-09" -> "Sep 2018"; anything else is returned unchanged. */
export function formatMonth(value?: string): string {
  const m = /^(\d{4})-(\d{2})/.exec(value || "");
  return m ? `${MONTHS[Number(m[2]) - 1]} ${m[1]}` : value || "";
}

interface Period {
  startDate?: string;
  endDate?: string;
  current?: boolean;
  dates?: string; // legacy free-text education period
}

/** "Sep 2018 – May 2022" or "Sep 2022 – Present" */
export function formatPeriod(e: Period, separator = " – "): string {
  if (!e.startDate && !e.endDate && !e.current) return e.dates || "";
  const end = e.current || !e.endDate ? "Present" : formatMonth(e.endDate);
  return [formatMonth(e.startDate), end].filter(Boolean).join(separator);
}
