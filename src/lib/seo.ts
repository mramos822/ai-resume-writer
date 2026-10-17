import type { Metadata } from "next";
import { withLocale, type Locale } from "@/i18n/config";

/**
 * The canonical address of a page and its versions in each language, for search engines. Every page must say its OWN address: a page that
 * names the home page as its canonical tells Google to treat it as a copy of the home page and to leave it out.
 */
export function alternatesFor(path: string, locale: Locale): NonNullable<Metadata["alternates"]> {
  return {
    canonical: withLocale(path, locale),
    languages: { en: withLocale(path, "en"), es: withLocale(path, "es"), "x-default": withLocale(path, "en") },
  };
}
