import React from "react";
import Image from "next/image";
import Link from "@/i18n/navigation";
import { ArrowLeftIcon } from "lucide-react";
import SiteFooter from "@/components/siteFooter";
import { LEGAL_UPDATED, LEGAL_UPDATED_ES } from "@/lib/legal";
import { getT } from "@/i18n/server";
import LanguageSwitch from "@/components/languageSwitch";

export interface LegalSection {
  id: string;
  title: string;
  body: React.ReactNode;
}

/** The page of a legal text: title, date, a contents list and numbered sections. Always light, like the landing page. */
export default async function LegalLayout({ title, intro, sections, updated = true }: { title: string; intro: React.ReactNode; sections: LegalSection[]; updated?: boolean }) {
  const { tr, locale } = await getT();
  return (
    <div className="public-site min-h-screen bg-white font-sans text-gray-900" style={{ colorScheme: "light" }}>
      <header className="border-b border-gray-200">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Link href="/" aria-label={tr("Kaizo home")}>
            <Image src="/kaizologo-v2.png" unoptimized alt={tr("Kaizo Resume Builder")} width={105} height={35} priority />
          </Link>
          <div className="flex items-center gap-4">
            <LanguageSwitch />
            <Link href="/" className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-blue-600">
              <ArrowLeftIcon className="h-4 w-4" /> {tr("Back to home")}
            </Link>
          </div>
        </div>
      </header>

      <main id="main" tabIndex={-1} className="mx-auto max-w-6xl px-4 py-14 outline-none">
        <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">{title}</h1>
        {updated && <p className="mt-3 text-sm text-gray-500">{tr("Last updated:")} {locale === "es" ? LEGAL_UPDATED_ES : LEGAL_UPDATED}</p>}
        <div className="mt-6 max-w-3xl text-lg leading-relaxed text-gray-600">{intro}</div>

        <div className="mt-12 grid gap-12 lg:grid-cols-[16rem_minmax(0,1fr)]">
          <nav aria-label={tr("Contents")} className="hidden lg:block">
            <div className="sticky top-8">
              <p className="mb-3 text-xs font-bold uppercase tracking-wider text-gray-500">{tr("Contents")}</p>
              <ol className="space-y-2 border-l border-gray-200 text-sm">
                {sections.map((s, i) => (
                  <li key={s.id}>
                    <a href={`#${s.id}`} className="-ml-px block border-l-2 border-transparent py-0.5 pl-3 text-gray-600 hover:border-blue-600 hover:text-blue-600">
                      {i + 1}. {s.title}
                    </a>
                  </li>
                ))}
              </ol>
            </div>
          </nav>

          <article className="max-w-3xl space-y-10">
            {sections.map((s, i) => (
              <section key={s.id} id={s.id} className="scroll-mt-8">
                <h2 className="text-2xl font-bold tracking-tight">
                  {i + 1}. {s.title}
                </h2>
                <div className="mt-3 space-y-3 leading-relaxed text-gray-700 [&_a]:font-medium [&_a]:text-blue-600 [&_a]:underline [&_li]:pl-1 [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-6 [&_strong]:text-gray-900">{s.body}</div>
              </section>
            ))}
            {locale === "es" && <p className="border-t border-gray-200 pt-6 text-sm text-gray-500">{tr("This is a translation for your convenience. If the two versions differ, the English one prevails.")}</p>}
          </article>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
