import { headers } from "next/headers";
import { DEFAULT_LOCALE, isLocale, type Locale } from "@/i18n/config";
import { makeT } from "@/i18n/translate";

/** The language of this request (the middleware sets it from the /es prefix). */
export async function getLocale(): Promise<Locale> {
  const v = (await headers()).get("x-locale");
  return isLocale(v) ? v : DEFAULT_LOCALE;
}

export async function getT() {
  return makeT(await getLocale());
}
