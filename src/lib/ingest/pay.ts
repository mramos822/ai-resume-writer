// The pay a posting names in its text ("The annual salary range for this position is $145,000 – $215,000", "$45 - $60 per hour",
// "$29 / hr - $53.50 / hr", "Compensation for this role is $30/hour", "CAD $45 - CAD $48 per hour", "€80.400 - €127.200 EUR", "S/ 3,500 a S/ 4,500
// mensuales", "$800.000 - $1.000.000 al mes", "PLN 12 000 - 16 000", "₹18,00,000"), for the postings whose system gives no pay field (Greenhouse and
// Lever put it in the text; so do the job boards). Only an amount in a known money (its sign or its code) that is clearly pay is taken: a range,
// or one figure that has its unit (hour, month, year) or follows a word like "salary", "sueldo" or "rate".
// "$5.8B valuation", "$250B+ in assets", "$50 - $200 million" are the company's, not the job's.
// Any money: what is plausible for a pay is judged in that money (a table says roughly how many of it make a dollar), and where a month is the
// unit people quote (Latin America, the Nordic and Eastern European countries, much of Asia and Africa) a figure with no unit is a monthly pay.
// A bare "$" is the pesos or dollars of the country of the job when it is known.

/** Roughly how many of each money make one US dollar: only to tell what size of figure is a pay in that money, nothing is converted. */
const PER_USD: Record<string, number> = {
  // Latin America and the Caribbean
  PEN: 3.8, BRL: 5.5, MXN: 18, COP: 4000, CLP: 950, ARS: 1500, UYU: 40, BOB: 7, PYG: 7500, CRC: 520, DOP: 60, GTQ: 8, HNL: 25, NIO: 37, VES: 50, JMD: 155, TTD: 6.8,
  // Europe
  SEK: 10.5, NOK: 10.7, DKK: 6.9, PLN: 4, CZK: 23, HUF: 360, RON: 4.6, BGN: 1.8, RSD: 108, UAH: 41, RUB: 90, TRY: 34, ISK: 140,
  // Asia, the Middle East and Oceania
  JPY: 150, INR: 85, CNY: 7.2, KRW: 1350, SGD: 1.35, HKD: 7.8, TWD: 32, THB: 35, MYR: 4.5, IDR: 16000, VND: 25000, PHP: 57, PKR: 280, BDT: 120, LKR: 300, ILS: 3.7, AED: 3.67, SAR: 3.75, QAR: 3.64, KWD: 0.31,
  // Africa
  ZAR: 18, EGP: 49, NGN: 1500, KES: 130, GHS: 15, MAD: 10, TND: 3.1,
};
/** The moneys where the pay is quoted by the month when the posting names no unit. In the others (the dollar, the euro, the pound, the yen, the rupee...) it is yearly. */
const MONTHLY_QUOTED = new Set(["PEN", "BRL", "MXN", "COP", "CLP", "ARS", "UYU", "BOB", "PYG", "CRC", "DOP", "GTQ", "HNL", "NIO", "VES", "SEK", "NOK", "DKK", "PLN", "CZK", "HUF", "RON", "BGN", "RSD", "UAH", "RUB", "TRY", "ZAR", "PHP", "THB", "MYR", "IDR", "VND", "PKR", "BDT", "LKR", "EGP", "NGN", "KES", "GHS", "MAD", "TND"]);
/** The money a bare "$" is in the country of the job (an ISO country code); and what the other signs are. */
const COUNTRY_MONEY: Record<string, string> = {
  PE: "PEN", CL: "CLP", CO: "COP", MX: "MXN", AR: "ARS", UY: "UYU", BO: "BOB", PY: "PYG", CR: "CRC", DO: "DOP", GT: "GTQ", HN: "HNL", NI: "NIO", BR: "BRL", VE: "VES",
  CA: "CAD", AU: "AUD", NZ: "NZD", SG: "SGD", HK: "HKD", TW: "TWD",
};
const SIGN_MONEY: Record<string, string> = { "S/": "PEN", "R$": "BRL", "€": "EUR", "£": "GBP", $: "USD", "₹": "INR", "¥": "JPY", "₩": "KRW", "₪": "ILS", "₺": "TRY", "₽": "RUB", "₴": "UAH", "₦": "NGN", "₱": "PHP", "฿": "THB", "₫": "VND" };

const CODES = [...Object.keys(PER_USD), "USD", "CAD", "GBP", "EUR", "AUD", "NZD", "CHF", "PAB"];
const CODE = String.raw`(?:${CODES.join("|")})`;
const SIGN = String.raw`(?:[Ss]\/\.?|R\$|[$£€₹¥₩₪₺₽₴₦₱฿₫])`;
const NUMBER = String.raw`\d{1,3}(?:[.,   ]\d{3})+(?:[.,]\d{1,2})?|\d{1,2}(?:,\d{2})+,\d{3}(?:\.\d{1,2})?|\d{1,3}(?:\.\d+)?\s?[kK]\b|\d+(?:\.\d{1,2})?`;
// a figure with its sign or its code on either side: "USD $ 17.65", "$240,000 CAD", "S/ 3,500", "PLN 12 000", "35000 SEK"; one with neither is skipped
const MONEY = new RegExp(String.raw`(?:(${CODE})\s?)?(${SIGN})?\s?(?:(${CODE})\s?)?(${NUMBER})(?:\s?(${CODE})\b)?`, "g");
// what may follow the first figure of a range: its unit ("/ hr"), a dash, "to" or "a", and the second figure (the sign of the second is optional)
const TAIL = new RegExp(
  String.raw`\s*(?:(?:\/|per|an|a|por|al|x|pro|par)\s*(?:hr|hour|h|hora|month|mo|mes|m[eê]s|monat|mois|year|yr|annum|año|jahr|an)(?![a-záéíóúñ]))?\s*(?:-|–|—|to|and|through|a|hasta|y|bis|à|do)\s*(?:(${CODE})\s?)?(${SIGN})?\s?(?:(${CODE})\s?)?(${NUMBER})(?:\s?(${CODE})\b)?`,
  "y"
);
// a figure followed by M, B, million or billion is a company size, not a pay
const SIZE = /^\s?(?:[mMbB](?![a-záéíóúñA-Z0-9])|million|billion|bn\b|millones|mil millones|mio\b|mrd\b)/;

const END = String.raw`(?![a-záéíóúñ])`;
const HOURLY = new RegExp(String.raw`(?:\/|\bper\b|\ban\b|\ba\b|\bpor\b|\bx\b|\bla\b|\bpro\b|\bpar\b)\s*(?:hr|hour|h|hora|stunde|heure)${END}|\bhourly\b|\bst[uü]ndlich\b`, "i");
const HOURLY_BEFORE = /\bhourly\b|\bhour(?:ly)? (?:rate|pay|wage)\b|\bper hour\b|\ban hour\b|\bpor hora\b|\btarifa por hora\b|\bstundenlohn\b/i;
const MONTHLY_BEFORE = /\bmonthly (?:gross |net |base )?(?:pay|salary|wage|compensation)\b|\bper month\b|\bsueldo mensual\b|\bsalario mensual\b|\bremuneraci[oó]n mensual\b|\bmonatsgehalt\b/i;
const MONTHLY = new RegExp(String.raw`(?:\/|\bper\b|\ba\b|\bal\b|\bpor\b|\bx\b|\bpro\b|\bpar\b)\s*(?:month|mo|mes|m[eê]s|monat|mois)${END}|\bmonthly\b|\bmensual(?:es)?${END}|\bmensais${END}|\bmonatlich\b|\bmensuel\b`, "i");
const YEARLY = new RegExp(String.raw`(?:\/|\bper\b|\ba\b|\bal\b|\bpor\b|\bpro\b|\bpar\b)\s*(?:year|yr|annum|año|ano|jahr|an)${END}|\bannual(?:ly)?\b|\byearly\b|\banual(?:es)?${END}|\bj[aä]hrlich\b|\bannuel\b|\bLPA\b|\blakhs? per annum\b`, "i");
const YEARLY_BEFORE = /\bannual\b|\bbase salary\b|\byearly\b|\bsueldo anual\b|\bsalario anual\b|\bjahresgehalt\b/i;
const PAY_WORD = /(?:salary|pay|rate|wage|wages|compensation|earn|earnings|base|up to|sueldo|salario|remuneraci[oó]n|pago|ingreso|ingresos|honorarios|haber|bruto|neto|gehalt|salaire|stipendio|retribuzione|wynagrodzenie|l[oö]n|palkka|maa[sš]|gaji|paga)\W{0,4}(?:\w+\W{1,4}){0,3}$/i;
// a pay word anywhere in the sentence before the figure ("the expected range of pay for this position in the U.S. is $17.84 - $22.30")
const PAY_NEAR = /\b(?:salary|pay|rate|wage|wages|compensation|earnings?|sueldo|salario|remuneraci[oó]n|gehalt|salaire)\b[^.]{0,70}$/i;

// the signs that say the money by themselves; the other moneys are shown with their code ("MXN 15,000"), so a peso is not taken for a dollar
const SYMBOL: Record<string, string> = { USD: "$", EUR: "€", GBP: "£", CAD: "CA$", AUD: "A$", PEN: "S/ ", BRL: "R$", INR: "₹", JPY: "¥", KRW: "₩", ILS: "₪", TRY: "₺", RUB: "₽", UAH: "₴", NGN: "₦", PHP: "₱", THB: "฿", VND: "₫" };

/** A pay a system gives as numbers ("min 90000, max 120000, per year, USD") as text: "$90,000 – $120,000", "$30 per hour", "S/ 1,530 per month". */
export function structuredPay(currency: unknown, min: unknown, max: unknown, unit: unknown): string | undefined {
  const lo = Number(min);
  const hi = Number(max);
  const a = lo > 0 ? lo : hi;
  const b = hi > 0 ? hi : lo;
  if (!(a > 0)) return undefined;
  const code = String(currency ?? "").toUpperCase();
  const sym = SYMBOL[code] ?? (code ? `${code} ` : "");
  const per = /hour/i.test(String(unit ?? "")) ? " per hour" : /month/i.test(String(unit ?? "")) ? " per month" : "";
  const n = (v: number) => `${sym}${Number.isInteger(v) ? v.toLocaleString("en-US") : v.toFixed(2)}`;
  return `${a === b ? n(a) : `${n(a)} – ${n(b)}`}${per}`;
}

/** The sizes a pay can have, in that money. */
function bounds(money: string): { hour: [number, number]; month: [number, number]; year: [number, number] } {
  const r = PER_USD[money];
  if (!r) return { hour: [8, 500], month: [1_500, 100_000], year: [20_000, 2_000_000] };
  // a pay is a small number of dollars' worth: lower limits fall with the money's value, but never below one unit of it
  return { hour: [Math.max(1, 1.5 * r), 500 * r], month: [Math.max(1, 250 * r), 100_000 * r], year: [Math.max(1, 3_000 * r), 2_000_000 * r] };
}

const value = (raw: string): number => {
  const s = raw.replace(/[\s  ]/g, "");
  if (/[kK]$/.test(s)) return parseFloat(s.replace(/,/g, "")) * 1000;
  const dec = /[.,](\d{1,2})$/.exec(s); // a separator with one or two digits after it is the decimal point; with three, a thousands separator
  return dec ? parseFloat(`${s.slice(0, s.length - dec[0].length).replace(/[.,]/g, "")}.${dec[1]}`) : parseFloat(s.replace(/[.,]/g, ""));
};
const fmt = (n: number, sign: string) => `${sign}${Number.isInteger(n) || n >= 1000 ? Math.round(n).toLocaleString("en-US") : n.toFixed(2)}`;

/**
 * The first plausible pay in the text as "$145,000 – $215,000", "$45 – $60 per hour", "$10,000 per month", "S/ 3,500 – S/ 4,500 per month",
 * "PLN 12,000 – 16,000 per month"; undefined when there is none. `country` (ISO code of the job, when known) says which money a bare "$" is.
 */
export function payFromText(text: string, country?: string): string | undefined {
  for (const m of text.matchAll(MONEY)) {
    const start = m.index ?? 0;
    const named = m[1] ?? m[3] ?? m[5];
    let lo = value(m[4]);
    let signKey = !m[2] ? "" : /^[Ss]\//.test(m[2]) ? "S/" : m[2];
    let end = start + m[0].length;
    if (!(lo > 0) || SIZE.test(text.slice(end, end + 12))) continue;
    let hi = lo;
    let code = named ?? "";
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
    if (!m[2] && !named) {
      // a number with no money next to it is only a pay when it is the start of a range whose second figure has the money ("80000 - 100000 USD")
      if (!(ranged && t && (t[1] || t[2] || t[3] || t[5]))) continue;
      if (t[2]) signKey = /^[Ss]\//.test(t[2]) ? "S/" : t[2];
    }
    // the money: a code the posting writes, else the money of the country for a bare "$", else the one the sign says
    const money = code || (signKey === "$" && country ? COUNTRY_MONEY[country.toUpperCase()] : undefined) || SIGN_MONEY[signKey] || "USD";
    const size = bounds(money);
    const win = text.slice(start + m[0].length, end + 30);
    const before = text.slice(Math.max(0, start - 90), start);
    const hourly = HOURLY.test(win) || HOURLY_BEFORE.test(before);
    const monthly = !hourly && (MONTHLY.test(win) || MONTHLY_BEFORE.test(before));
    const yearly = !hourly && !monthly && (YEARLY.test(win) || YEARLY_BEFORE.test(before));
    const stated = hourly || monthly || yearly;
    // one figure alone must say what it is: its unit, or the word "salary", "sueldo", "pay", "rate"... right before it
    const payWord = PAY_WORD.test(before) || PAY_NEAR.test(before.replace(/\b(?:[A-Za-z]\.){2,}/g, (a) => a.replace(/\./g, "")));
    if (!ranged && !stated && !PAY_WORD.test(before)) continue;
    // the code is shown when the sign alone does not say the money ("CAD $45", "COP $3.000.000", "PLN 12,000"); "EUR" after "€" says nothing more
    const cur = SIGN_MONEY[signKey] === money ? "" : `${money} `;
    const sign = signKey === "S/" ? "S/ " : signKey;
    const show = lo === hi ? fmt(lo, sign) : `${fmt(lo, sign)} – ${fmt(hi, sign)}`;
    const within = ([a, b]: [number, number]) => lo >= a && hi <= b;
    if (hourly) {
      if (within(size.hour)) return `${cur}${show} per hour`;
    } else if (monthly) {
      if (within(size.month)) return `${cur}${show} per month`;
    } else if (yearly) {
      if (within(size.year)) return `${cur}${show}`;
    } else if (MONTHLY_QUOTED.has(money)) {
      // no unit, a money where the pay is quoted by the month: it is a monthly pay when it is the size of one
      if (within(size.month)) return `${cur}${show} per month`;
      if (within(size.year)) return `${cur}${show}`;
    } else if (money in PER_USD && !within(size.year)) {
      // a money with a yearly habit whose figure is too small for a year (yen, won, rupees...) but fits a month
      if (within(size.month)) return `${cur}${show} per month`;
    } else if (lo < 200 && payWord && !(money in PER_USD)) {
      if (within(size.hour)) return `${cur}${show} per hour`;
    } else if (within(size.year)) return `${cur}${show}`;
  }
  return undefined;
}
