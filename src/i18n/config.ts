// Languages of the site. English is the default and lives at the plain address (/, /terms...); Spanish lives under /es.
export const LOCALES = ["en", "es"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";
export const LANG_COOKIE = "kaizo_lang"; // set only when the person chooses a language, so a first visit is always English
export const LOCALE_LABEL: Record<Locale, string> = { en: "English", es: "Español" };

export function isLocale(v: unknown): v is Locale {
  return v === "en" || v === "es";
}

export function localeOfPath(pathname: string): Locale {
  return pathname === "/es" || pathname.startsWith("/es/") ? "es" : "en";
}

/** "/es/home" -> "/home", "/es" -> "/" */
export function stripLocale(pathname: string): string {
  if (pathname === "/es") return "/";
  return pathname.startsWith("/es/") ? pathname.slice(3) : pathname;
}

/** An address of this site written for a language. Other sites, files, the API and plain anchors are left alone. */
export function withLocale(href: string, locale: Locale): string {
  if (!href.startsWith("/") || href.startsWith("//") || href.startsWith("/api/") || href === "/api" || href.startsWith("/_next")) return href;
  const cut = href.search(/[?#]/);
  const path = cut === -1 ? href : href.slice(0, cut);
  const rest = cut === -1 ? "" : href.slice(cut);
  if (/\.[a-z0-9]{2,5}$/i.test(path)) return href; // a file (logo.png, manifest.json...)
  const bare = stripLocale(path);
  if (locale === "es") return `${bare === "/" ? "/es" : `/es${bare}`}${rest}`;
  return `${bare}${rest}`;
}
