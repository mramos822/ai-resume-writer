"use client";

import React, { createContext, useContext, useMemo } from "react";
import { es as dateEs } from "date-fns/locale";
import { enUS as dateEn } from "date-fns/locale";
import type { Locale } from "@/i18n/config";
import { makeT } from "@/i18n/translate";

const LocaleContext = createContext<Locale>("en");

export function LocaleProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}

export const useLocale = () => useContext(LocaleContext);

/** { t, tx, locale } for the current language. */
export function useT() {
  const locale = useLocale();
  return useMemo(() => makeT(locale), [locale]);
}

/** The date-fns language for the current language. */
export function useDateLocale() {
  return useLocale() === "es" ? dateEs : dateEn;
}

/** The BCP-47 tag for Intl and toLocaleString. */
export function useLocaleTag() {
  return useLocale() === "es" ? "es" : "en-US";
}
