import type { Locale } from "@/i18n/config";

/** A function that writes a country (stored in English) in the language of the page, with the browser's own country names. */
export function countryNamer(locale: Locale, countries: { name: string; isoCode: string }[] | undefined): (name: string) => string {
  if (locale === "en" || !countries) return (n) => n;
  let names: Intl.DisplayNames;
  try {
    names = new Intl.DisplayNames([locale], { type: "region" });
  } catch {
    return (n) => n;
  }
  const iso = new Map(countries.map((c) => [c.name, c.isoCode]));
  return (n) => {
    const code = iso.get(n);
    return (code && names.of(code)) || n;
  };
}
