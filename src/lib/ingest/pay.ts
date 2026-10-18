// The pay a posting names in its text ("The annual salary range for this position is $145,000 – $215,000", "$45 - $60 per hour",
// "$29 / hr - $53.50 / hr", "Compensation for this role is $30/hour", "CAD $45 - CAD $48 per hour", "€80.400 - €127.200 EUR"), for the postings
// whose system gives no pay field (Greenhouse and Lever put it in the text; so do the job boards). Only an amount with a currency sign that
// is clearly pay is taken: a range, or one figure that has its unit (hour, month, year) or follows a word like "salary" or "rate".
// "$5.8B valuation", "$250B+ in assets", "$50 - $200 million" are the company's, not the job's.

const CODE = String.raw`(?:USD|CAD|GBP|EUR|AUD|NZD|CHF|MXN)`;
const NUMBER = String.raw`\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{1,2})?|\d{1,3}(?:\.\d+)?\s?[kK]\b|\d+(?:\.\d{1,2})?`;
// code before or after the sign or the figure: "USD $ 17.65", "$240,000 CAD"
const MONEY = new RegExp(String.raw`(?:(${CODE})\s?)?(R\$|[$£€])\s?(?:(${CODE})\s?)?(${NUMBER})(?:\s?(${CODE})\b)?`, "g");
// what may follow the first figure of a range: its unit ("/ hr"), a dash or "to", and the second figure (the sign of the second is optional)
const TAIL = new RegExp(String.raw`\s*(?:(?:\/|per|an|a)\s*(?:hr|hour|h|month|mo|year|yr|annum)\b)?\s*(?:-|–|—|to|and|through)\s*(?:(${CODE})\s?)?(R\$|[$£€])?\s?(?:(${CODE})\s?)?(${NUMBER})(?:\s?(${CODE})\b)?`, "y");
// a figure followed by M, B, million or billion is a company size, not a pay
const SIZE = /^\s?(?:[mMbB]\b|million|billion|bn\b)/;

const HOURLY = /(?:\/|\bper\b|\ban\b|\ba\b)\s*(?:hr|hour|h)\b|\bhourly\b/i;
const HOURLY_BEFORE = /\bhourly\b|\bhour(?:ly)? (?:rate|pay|wage)\b|\bper hour\b|\ban hour\b/i;
const MONTHLY_BEFORE = /\bmonthly (?:gross |net |base )?(?:pay|salary|wage|compensation)\b|\bper month\b/i;
const MONTHLY = /(?:\/|\bper\b|\ba\b)\s*(?:month|mo)\b|\bmonthly\b/i;
const YEARLY = /(?:\/|\bper\b|\ba\b)\s*(?:year|yr|annum)\b|\bannual(?:ly)?\b|\byearly\b/i;
const YEARLY_BEFORE = /\bannual\b|\bbase salary\b|\byearly\b/i;
const PAY_WORD = /(?:salary|pay|rate|wage|wages|compensation|earn|earnings|base|up to)\W{0,4}(?:\w+\W{1,4}){0,3}$/i;
// a pay word anywhere in the sentence before the figure ("the expected range of pay for this position in the U.S. is $17.84 - $22.30")
const PAY_NEAR = /\b(?:salary|pay|rate|wage|wages|compensation|earnings?)\b[^.]{0,70}$/i;

const value = (raw: string): number => {
  const s = raw.replace(/\s/g, "");
  if (/[kK]$/.test(s)) return parseFloat(s.replace(/,/g, "")) * 1000;
  const dec = /[.,](\d{1,2})$/.exec(s); // a separator with one or two digits after it is the decimal point; with three, a thousands separator
  return dec ? parseFloat(`${s.slice(0, s.length - dec[0].length).replace(/[.,]/g, "")}.${dec[1]}`) : parseFloat(s.replace(/[.,]/g, ""));
};
const fmt = (n: number, sign: string) => `${sign}${Number.isInteger(n) || n >= 1000 ? Math.round(n).toLocaleString("en-US") : n.toFixed(2)}`;

/** The first plausible pay in the text as "$145,000 – $215,000", "$45 – $60 per hour", "$10,000 per month"; undefined when there is none. */
export function payFromText(text: string): string | undefined {
  for (const m of text.matchAll(MONEY)) {
    const start = m.index ?? 0;
    let lo = value(m[4]);
    const sign = m[2];
    let end = start + m[0].length;
    if (!(lo > 0) || SIZE.test(text.slice(end, end + 12))) continue;
    let hi = lo;
    let code = m[1] ?? m[3] ?? m[5] ?? "";
    let ranged = false;
    TAIL.lastIndex = end;
    const t = TAIL.exec(text);
    if (t && !SIZE.test(text.slice(TAIL.lastIndex, TAIL.lastIndex + 12))) {
      const second = value(t[4]);
      if (/[kK]$/.test(t[4].trim()) && !/[kK]$/.test(m[4].trim()) && lo < 1000) lo *= 1000; // "$200-240K"
      // a second figure that is not of the same size is something else ("$50 per hour and 20 hours"): the first one stands alone
      if (second >= lo && second / lo <= 4) {
        hi = second;
        ranged = true;
        end = TAIL.lastIndex;
        code = code || (t[1] ?? t[3] ?? t[5] ?? "");
      }
    }
    const win = text.slice(start + m[0].length, end + 30);
    const before = text.slice(Math.max(0, start - 90), start);
    const hourly = HOURLY.test(win) || HOURLY_BEFORE.test(before);
    const monthly = !hourly && (MONTHLY.test(win) || MONTHLY_BEFORE.test(before));
    const yearly = !hourly && !monthly && (YEARLY.test(win) || YEARLY_BEFORE.test(before));
    const stated = hourly || monthly || yearly;
    // one figure alone must say what it is: its unit, or the word "salary", "pay", "rate"... right before it
    if (!ranged && !stated && !PAY_WORD.test(before)) continue;
    // the code is shown when the sign alone does not say the money ("CAD $45"); "EUR" after "€" says nothing more
    const cur = code && code !== "USD" && !(code === "EUR" && sign === "€") && !(code === "GBP" && sign === "£") ? `${code} ` : "";
    const show = lo === hi ? fmt(lo, sign) : `${fmt(lo, sign)} – ${fmt(hi, sign)}`;
    if (hourly || (!stated && lo < 200 && (PAY_WORD.test(before) || PAY_NEAR.test(before.replace(/\b(?:[A-Za-z]\.){2,}/g, (a) => a.replace(/\./g, "")))))) {
      if (lo >= 8 && hi <= 500) return `${cur}${show} per hour`;
    } else if (monthly) {
      if (lo >= 1_500 && hi <= 100_000) return `${cur}${show} per month`;
    } else if (lo >= 20_000 && hi <= 2_000_000) return `${cur}${show}`;
  }
  return undefined;
}
