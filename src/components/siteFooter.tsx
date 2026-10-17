"use client";

import LanguageSwitch from "@/components/languageSwitch";
import Image from "next/image";
import Link from "@/i18n/navigation";
import { ArrowRightIcon } from "lucide-react";
import { useAuth } from "@/context/authContext";
import { useT } from "@/i18n/provider";

// The footer of the public side of the site (landing and legal pages).
const columns: { title: string; links: { label: string; href: string }[] }[] = [
  {
    title: "Product",
    links: [
      { label: "Resume builder", href: "/start" },
      { label: "How it works", href: "/#how" },
      { label: "Resume templates", href: "/#templates" },
      { label: "ATS score", href: "/#features" },
      { label: "Job search", href: "/login?view=login" },
    ],
  },
  {
    title: "Help",
    links: [
      { label: "Frequently asked questions", href: "/#faq" },
      { label: "Contact us", href: "/contact" },
      { label: "Log in", href: "/login?view=login" },
      { label: "Create an account", href: "/login?view=register" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Terms of service", href: "/terms" },
      { label: "Privacy policy", href: "/privacy" },
      { label: "Cookie policy", href: "/cookies" },
      { label: "Accessibility", href: "/accessibility" },
      { label: "Your privacy choices", href: "/privacy#choices" },
    ],
  },
];

export default function SiteFooter() {
  const { tr } = useT();
  const { user, loading, signedInHint } = useAuth();
  // while Firebase is still starting, the last known answer decides, so the links do not change after the page is shown
  const signedIn = loading ? signedInHint === true : !!user && !user.uid.startsWith("guest-");
  // someone who is already in does not need "log in" or "create an account"
  const cols = columns.map((c) => ({
    ...c,
    links: signedIn
      ? c.links.filter((l) => !l.href.startsWith("/login")).concat(c.title === "Help" ? [{ label: "Dashboard", href: "/home" }] : [])
      : c.links,
  }));
  return (
    <footer className="public-site w-full border-t border-gray-200 bg-gray-50 text-gray-900">
      <div className="mx-auto max-w-[1600px] px-4 lg:px-10 py-14">
        <div className="grid gap-10 md:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div>
            <Link href="/" aria-label={tr("Kaizo home")}>
              <Image src="/kaizologo-v2.png" unoptimized alt={tr("Kaizo Resume Builder")} width={120} height={40} />
            </Link>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-gray-600">{tr("Build a resume that passes applicant tracking systems, tailor it to each job and download it as PDF or DOCX.")}</p>
            <Link href={signedIn ? "/home" : "/start"} className="mt-5 inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700">
              {signedIn ? tr("Go to dashboard") : tr("Create my resume")} <ArrowRightIcon className="h-4 w-4" />
            </Link>
          </div>

          {cols.map((c) => (
            <nav key={c.title} aria-label={c.title}>
              <h3 className="text-sm font-bold uppercase tracking-wider text-gray-500">{tr(c.title)}</h3>
              <ul className="mt-4 space-y-2.5 text-sm">
                {c.links.map((l) => (
                  <li key={l.label}>
                    <Link href={l.href} className="text-gray-700 hover:text-blue-600">
                      {tr(l.label)}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-gray-200 pt-6 text-sm text-gray-500 sm:flex-row">
          <p>© {new Date().getFullYear()}{" "}{tr("Kaizo Resume Builder. All rights reserved.")}</p>
          <LanguageSwitch />
          <p className="flex flex-wrap justify-center gap-x-4 gap-y-1">
            <Link href="/terms" className="hover:text-blue-600">{tr("Terms")}</Link>
            <Link href="/privacy" className="hover:text-blue-600">{tr("Privacy")}</Link>
            <Link href="/cookies" className="hover:text-blue-600">{tr("Cookies")}</Link>
            <Link href="/contact" className="hover:text-blue-600">{tr("Contact")}</Link>
          </p>
        </div>
      </div>
    </footer>
  );
}
