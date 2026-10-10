/**
 * Formats a US phone number as (555) 123-4567, also while it is being typed.
 * Anything that doesn't look like a US number (letters, extensions, other country codes) is returned untouched.
 */
export function formatUsPhone(raw: string): string {
  const v = (raw ?? "").trim();
  if (!v) return "";
  if (/[^\d\s().+-]/.test(v)) return v;
  if (v.startsWith("+") && !v.startsWith("+1")) return v;

  let d = v.replace(/\D/g, "");
  if (v.startsWith("+1") || (d.length === 11 && d.startsWith("1"))) d = d.slice(1);
  if (d.length === 0) return v;
  d = d.slice(0, 10);

  if (d.length <= 3) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

/* ---------- other countries ---------- */
import { AsYouType, getCountryCallingCode, getExampleNumber, type CountryCode } from "libphonenumber-js";
import examples from "libphonenumber-js/mobile/examples";

/** What the phone field shows while typing: the US look for the US, the country's own national look elsewhere. */
export function formatPhoneInput(raw: string, iso?: string): string {
  if (!iso || iso === "US") return formatUsPhone(raw);
  if (raw.startsWith("+")) return raw; // someone typing the full international number keeps it as typed
  try {
    return new AsYouType(iso as CountryCode).input(raw);
  } catch {
    return raw;
  }
}

/** The phone as it is printed on the resume: US numbers as (555) 123-4567, others with their country code in front. */
export function formatContactPhone(raw: string, iso?: string): string {
  const v = (raw ?? "").trim();
  if (!v) return "";
  if (!iso || iso === "US") return formatUsPhone(v);
  if (v.startsWith("+")) return v;
  try {
    return `+${getCountryCallingCode(iso as CountryCode)} ${v.replace(/^0+(?=\d)/, "")}`;
  } catch {
    return v;
  }
}

/** An example number for the placeholder, in the same look the field uses. */
export function phoneExample(iso?: string): string {
  if (!iso || iso === "US") return "(555) 123-4567";
  try {
    return getExampleNumber(iso as CountryCode, examples)?.formatNational() ?? "";
  } catch {
    return "";
  }
}
