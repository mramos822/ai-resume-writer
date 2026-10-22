"use client";

import { useState } from "react";
import Image from "next/image";
import { ChevronDown } from "lucide-react";
import Link from "@/i18n/navigation";
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
  const [open, setOpen] = useState<string | null>(null);
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
    <footer className="public-site w-full border-t border-white/10 bg-gray-950 text-white">
      <div className="mx-auto max-w-[1600px] px-4 lg:px-10 py-14">
        <div className="grid gap-y-6 md:grid-cols-[1.4fr_repeat(3,1fr)] md:gap-10">
          <div className="max-md:mb-2">
            <Link href="/" aria-label={tr("Kaizo home")}>
              <Image src="/kaizologo-dark-v2.png" unoptimized alt={tr("Kaizo Resume Builder")} width={120} height={40} />
            </Link>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-gray-400">{tr("Build a resume that passes applicant tracking systems, tailor it to each job and download it as PDF or DOCX.")}</p>
          </div>

          {cols.map((c) => (
            <nav key={c.title} aria-label={c.title} className="max-md:border-b max-md:border-white/10 max-md:pb-4">
              {/* on a phone each column is a dropdown; from md up the list is always shown */}
              <h2 className="text-sm font-bold uppercase tracking-wider text-gray-400">
                <button
                  type="button"
                  aria-expanded={open === c.title}
                  onClick={() => setOpen(open === c.title ? null : c.title)}
                  className="flex w-full items-center justify-between text-left uppercase max-md:py-1 md:pointer-events-none md:cursor-default"
                >
                  {tr(c.title)}
                  <ChevronDown aria-hidden className={`h-4 w-4 transition-transform md:hidden ${open === c.title ? "rotate-180" : ""}`} />
                </button>
              </h2>
              {/* the grid-rows 0fr -> 1fr trick animates the height; "invisible" keeps the closed links out of the tab order */}
              <div
                className={`grid transition-[grid-template-rows,opacity,visibility] duration-300 ease-out md:visible md:grid-rows-[1fr] md:opacity-100 ${
                  open === c.title ? "visible grid-rows-[1fr] opacity-100" : "invisible grid-rows-[0fr] opacity-0"
                }`}
              >
                <ul className="min-h-0 space-y-2.5 overflow-hidden pt-4 text-sm">
                  {c.links.map((l) => (
                    <li key={l.label}>
                      <Link href={l.href} className="text-gray-300 hover:text-white">
                        {tr(l.label)}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </nav>
          ))}
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-white/10 pt-6 text-sm text-gray-400 sm:flex-row">
          <p>© {new Date().getFullYear()}{" "}{tr("Kaizo Resume Builder. All rights reserved.")}</p>
          <p className="flex flex-wrap justify-center gap-x-4 gap-y-1">
            <Link href="/terms" className="hover:text-white">{tr("Terms")}</Link>
            <Link href="/privacy" className="hover:text-white">{tr("Privacy")}</Link>
            <Link href="/cookies" className="hover:text-white">{tr("Cookies")}</Link>
            <Link href="/contact" className="hover:text-white">{tr("Contact")}</Link>
          </p>
        </div>
      </div>
    </footer>
  );
}
