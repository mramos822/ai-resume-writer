"use client";

// The language selector: English | Español. It is on every page, public or inside the app, and it keeps the person where they
// are (same page, other language). The choice is remembered in a cookie, and only this choice ever makes Spanish the default.
import React from "react";
import { usePathname as useNextPathname } from "next/navigation";
import { LANG_COOKIE, LOCALES, LOCALE_LABEL, withLocale, type Locale } from "@/i18n/config";
import { useLocale } from "@/i18n/provider";
import { Check, ChevronDown, Globe } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export default function LanguageSwitch({ tone = "light", className = "", compact = false }: { tone?: "light" | "dark" | "app"; className?: string; compact?: boolean }) {
  const locale = useLocale();
  const pathname = useNextPathname() ?? "/";

  const choose = (next: Locale) => {
    if (next === locale) return;
    try {
      document.cookie = `${LANG_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    } catch {
      /* cookies blocked: the address still carries the language */
    }
    const rest = `${window.location.search}${window.location.hash}`;
    // a full load: every text of the page (the ones the server writes too) is made again in the new language
    window.location.assign(`${withLocale(pathname, next)}${rest}`);
  };

  const trigger =
    tone === "dark"
      ? "border-white/30 bg-white/10 text-white hover:bg-white/20"
      : tone === "app"
        ? "border-transparent text-muted-foreground hover:bg-accent hover:text-foreground"
        : "border-gray-300 bg-white text-gray-700 hover:border-blue-400 hover:text-blue-600";

  // a small menu: the globe and the current language open a list with both languages
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={locale === "es" ? "Idioma" : "Language"}
          className={`inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-sm font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-ring ${trigger} ${className}`}
        >
          <Globe className="h-4 w-4" aria-hidden />
          <span>{compact ? locale.toUpperCase() : LOCALE_LABEL[locale]}</span>
          <ChevronDown className="h-3.5 w-3.5 opacity-70" aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className={`z-[110] min-w-40 ${tone === "app" ? "" : "border-gray-200 bg-white text-gray-900 shadow-xl"}`}>
        {LOCALES.map((l) => (
          <DropdownMenuItem key={l} lang={l} onSelect={() => choose(l)} className={`justify-between gap-6 font-medium ${tone === "app" ? "" : "focus:bg-gray-100 focus:text-gray-900"}`}>
            {LOCALE_LABEL[l]}
            {locale === l && <Check className="h-4 w-4 text-blue-600" aria-hidden />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
