"use client";

import { useEffect, useState } from "react";
import Link from "@/i18n/navigation";
import Image from "next/image";
import { MenuIcon, XIcon } from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { LoginForm } from "@/components/forms/loginForm";
import { useAuth } from "@/context/authContext";
import { useRouter } from "@/i18n/navigation";
import LanguageSwitch from "@/components/languageSwitch";
import { useT } from "@/i18n/provider";

const links = [
  { href: "#how", label: "How it works" },
  { href: "#features", label: "Features" },
  { href: "#templates", label: "Templates" },
  { href: "#faq", label: "FAQ" },
];

export default function TopBanner({ ready = true }: { ready?: boolean }) {
  const { tr } = useT();
  const router = useRouter();
  const { user, loading, signedInHint: hint } = useAuth();
  // The banner shows nothing until we know if someone is signed in (never longer than 2.5 s), so the guest buttons never show before "Go to dashboard".
  // To know sooner than Firebase can tell, the last answer (kept in localStorage, see authContext) is used; Firebase then confirms or corrects it.
  const [waited, setWaited] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setWaited(true), 2500);
    return () => clearTimeout(t);
  }, []);
  const authReady = ready && (!loading || hint !== null || waited);
  // a guest is not logged in: only a real account sees the dashboard shortcut
  const signedIn = loading ? hint === true : !!user && !user.uid.startsWith("guest-");
  const [showLogin, setShowLogin] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [progress, setProgress] = useState(0);
  const [active, setActive] = useState("");

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 8);
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(max > 0 ? (window.scrollY / max) * 100 : 0);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Highlight the nav link of the section currently in view
  useEffect(() => {
    const sections = links
      .map((l) => document.querySelector(l.href))
      .filter((el): el is Element => !!el);
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) setActive(`#${e.target.id}`);
        });
      },
      { rootMargin: "-40% 0px -55% 0px" }
    );
    sections.forEach((s) => obs.observe(s));
    return () => obs.disconnect();
  }, []);

  return (
    // A full-width bar with a light blur and a teal-to-indigo hairline underneath (the same gradient as the homepage title); links get an underline when active.
    <header className="public-site fixed left-0 top-0 z-50 w-full">
      <div
        className={`relative w-full backdrop-blur-md transition-shadow ${menuOpen ? "bg-white" : "bg-white/90"} ${scrolled || menuOpen ? "shadow-lg shadow-slate-900/10" : ""}`}
      >
      <div className={`mx-auto h-16 max-w-[1600px] px-4 lg:px-10 flex items-center justify-between lg:grid lg:grid-cols-[1fr_auto_1fr] ${authReady ? "" : "invisible"}`} aria-hidden={!authReady}>
        <Link href="/" className="flex items-center shrink-0">
          <Image
            src="/kaizologo-v2.png" unoptimized
            alt={tr("Kaizo Resume Builder logo")}
            width={118}
            height={39}
            className="h-9 w-auto"
            priority
          />
        </Link>

        {/* Desktop nav */}
        {/* From lg up the bar is three columns (logo | links | buttons): the links stay centred and do not move when the buttons or the language change the width. Below lg the links go in the menu. */}
        <nav className="hidden lg:flex items-center gap-8 whitespace-nowrap text-sm font-medium">
          {links.map((l) => (
            <Link
              key={l.href}
              href={`/${l.href}`}
              className={`relative py-1 transition-colors after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:rounded-full after:bg-gradient-to-r after:from-teal-500 after:to-indigo-500 after:transition-opacity ${
                active === l.href
                  ? "text-gray-900 after:opacity-100"
                  : "text-gray-500 hover:text-gray-900 after:opacity-0 hover:after:opacity-40"
              }`}
            >
              {tr(l.label)}
            </Link>
          ))}
        </nav>

        <div className="flex items-center justify-end gap-2 whitespace-nowrap">
          {/* the buttons have a fixed minimum width, so English and Spanish take the same room and nothing shifts when the language changes */}
          <LanguageSwitch className="max-sm:hidden min-w-[7.5rem] justify-center" />
          <div className="flex items-center gap-2">
          {signedIn ? (
            <Link href="/home" className="inline-flex min-w-[9rem] items-center justify-center text-center bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg shadow-md shadow-blue-600/25 transition">
              {tr("Go to dashboard")}
            </Link>
          ) : (
            <>
          <Popover open={showLogin} onOpenChange={setShowLogin}>
            <PopoverTrigger asChild>
              <button className="hidden sm:inline-flex min-w-[7.5rem] items-center justify-center text-center text-sm font-semibold text-gray-800 border border-gray-300 hover:border-blue-600 hover:text-blue-600 px-4 py-2 rounded-lg transition">
                {tr("Log in")}
              </button>
            </PopoverTrigger>
            <PopoverContent
              align="end"
              sideOffset={12}
              className="auth-light w-[22rem] p-6 bg-white text-gray-900 rounded-md border border-gray-200 shadow-2xl"
            >
              <h3 className="text-xl font-bold text-gray-900">{tr("Welcome back")}</h3>
              <p className="text-sm text-gray-500 mt-1 mb-5">
                {tr("Log in to keep working on your resume.")}
              </p>
              <LoginForm
                onLogin={() => setShowLogin(false)}
                onForgotPassword={() => {
                  router.push("/login?view=resetPassword");
                }}
              />
              <div className="mt-5 pt-4 border-t border-gray-200 text-center text-sm text-gray-600">
                {tr("New here?")}{" "}
                <Link href="/login?view=register" className="text-blue-600 font-semibold hover:underline">
                  {tr("Create a free account")}
                </Link>
              </div>
            </PopoverContent>
          </Popover>

          <Link
            href="/start"
            className="inline-flex min-w-[10rem] items-center justify-center text-center bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg shadow-md shadow-blue-600/25 transition"
          >
            {tr("Create my resume")}
          </Link>

            </>
          )}
          </div>

          <button
            className="lg:hidden p-2 text-gray-700"
            onClick={() => setMenuOpen((o) => !o)}
            aria-label={tr("Toggle menu")}
          >
            {menuOpen ? <XIcon className="w-6 h-6" /> : <MenuIcon className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Scroll progress */}
      <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-teal-300/60 via-gray-200 to-indigo-300/60" />
      <div className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-teal-500 to-indigo-500 transition-[width] duration-100" style={{ width: `${progress}%` }} />

      {/* Mobile menu */}
      {menuOpen && (
        <div className="lg:hidden border-t border-gray-200 px-4 py-3 flex flex-col">
          {links.map((l) => (
            <Link
              key={l.href}
              href={`/${l.href}`}
              onClick={() => setMenuOpen(false)}
              className="py-3 text-gray-800 font-medium border-b border-gray-100"
            >
              {tr(l.label)}
            </Link>
          ))}
          <LanguageSwitch className="my-3 w-fit" />
          {/* someone who is signed in already has "Go to dashboard" in the bar */}
          {!signedIn && (
            <Link href="/login?view=login" className="py-3 text-blue-600 font-semibold">
              {tr("Log in")}
            </Link>
          )}
        </div>
      )}
      </div>
    </header>
  );
}
