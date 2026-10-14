"use client";

import { useCallback } from "react";
import { useDialog } from "@/context/dialogContext";
import { useToast } from "@/context/toastContext";
import { useT } from "@/i18n/provider";
import type { ProfileData } from "@/context/profileContext";
import { detectOtherLanguage, detectResumeLanguage } from "@/lib/resumeTranslate";
import { translateProfile } from "@/utils/translateClient";

/**
 * After a resume is read: when it is written in a different language than the one the site is shown in, offer to translate it.
 * Returns the translated profile when the person accepts, or null (same language, not sure, declined, or the translation failed).
 */
/** The name of a language in the language of the site ("alemán", "German"), from its two-letter code. */
function languageName(code: string, locale: string): string {
  try {
    return new Intl.DisplayNames([locale === "es" ? "es" : "en"], { type: "language" }).of(code) ?? code;
  } catch {
    return code;
  }
}

export function useTranslationOffer() {
  const { tr, locale } = useT();
  const dialog = useDialog();
  const toast = useToast();

  return useCallback(
    async (data: Partial<ProfileData>): Promise<Partial<ProfileData> | null> => {
      const site = locale === "es" ? "es" : "en";
      // the reader of the resume says which language it is written in; the words of the text are the fallback
      const told = (data.resumeLanguage ?? "").toLowerCase().slice(0, 2);
      const known = /^[a-z]{2}$/.test(told) ? told : "";
      const found = known === "en" || known === "es" ? known : known ? null : detectResumeLanguage(data);
      // a resume in any other language (German, French, Portuguese, Italian...) is offered the same: it is translated to the language of the site
      const other = found ? null : known ? languageName(known, locale) : detectOtherLanguage(data);
      if ((!found && !other) || found === site) return null;
      const ok = await dialog.confirm({
        title: other
          ? tr("This resume looks like it is written in {language}. Translate it to {target}?", { language: known ? other : tr(other), target: site === "es" ? tr("Spanish") : tr("English") })
          : found === "en"
            ? tr("This resume looks like it is written in English. Translate it to Spanish?")
            : tr("This resume looks like it is written in Spanish. Translate it to English?"),
        description: tr("We'll translate the text of your resume: summary, job titles, bullets, degrees and skills. Names of companies and schools, tools and dates stay as they are, and you can review everything afterwards."),
        confirmText: tr("Translate it"),
        cancelText: tr("Keep it as it is"),
      });
      if (!ok) return null;
      toast.info(tr("Translating your resume..."));
      try {
        const { resumeLanguage: _told, ...content } = data;
      void _told;
      const translated = await translateProfile(content, site);
        toast.success(tr("Your resume was translated."));
        return translated;
      } catch (err) {
        toast.error((err as Error).message || tr("We couldn't translate your resume right now."));
        return null;
      }
    },
    [dialog, toast, tr, locale]
  );
}
