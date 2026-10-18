// The pay a posting names in its text ("The annual salary range for this position is $145,000 – $215,000", "$45 - $60 per hour"), for the
// postings whose system gives no pay field (Greenhouse puts it in the text). Only a clear range with a currency sign is taken.

const NUM = String.raw`(\d{1,3}(?:,\d{3})+|\d{2,3}(?:\.\d+)?\s?[kK]|\d{2,6})`;
const RANGE = new RegExp(String.raw`([$£€])\s?${NUM}\s*(?:-|–|—|to|and)\s*(?:[$£€]\s?)?${NUM}(?:\s?(USD|CAD|GBP|EUR|AUD))?`, "g");

const value = (s: string): number => {
  const t = s.replace(/,/g, "").replace(/\s/g, "");
  return /k$/i.test(t) ? parseFloat(t) * 1000 : parseFloat(t);
};
const fmt = (n: number, sign: string) => `${sign}${Math.round(n).toLocaleString("en-US")}`;

/** The first plausible pay range in the text as "$145,000 – $215,000" (or "$45 – $60 per hour"); undefined when there is none. */
export function payFromText(text: string): string | undefined {
  for (const m of text.matchAll(RANGE)) {
    const lo = value(m[2]);
    const hi = value(m[3]);
    if (!(lo > 0 && hi >= lo) || hi / lo > 4) continue; // a range, not two unrelated numbers
    const after = text.slice((m.index ?? 0) + m[0].length, (m.index ?? 0) + m[0].length + 24).toLowerCase();
    const hourly = /\b(per hour|\/ ?hr|\/ ?hour|an hour|hourly)\b/.test(after);
    if (hourly && lo >= 8 && hi <= 500) return `${fmt(lo, m[1])} – ${fmt(hi, m[1])} per hour`;
    if (!hourly && lo >= 20_000 && hi <= 2_000_000) return `${fmt(lo, m[1])} – ${fmt(hi, m[1])}`;
  }
  return undefined;
}
