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

export default function TopBanner() {
  const { tr } = useT();
  const router = useRouter();
  const { user } = useAuth();
  // a guest is not logged in: only a real account sees the dashboard shortcut
  const signedIn = !!user && !user.uid.startsWith("guest-");
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
    <header
      className={`public-site w-full fixed top-0 left-0 z-50 bg-white transition-shadow ${
        scrolled ? "shadow-md" : "border-b border-gray-200"
      }`}
    >
      <div className="max-w-[1600px] mx-auto px-4 lg:px-10 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center shrink-0">
          <Image
            src="/kaizologo-v2.png" unoptimized
            alt={tr("Kaizo Resume Builder logo")}
            width={118}
            height={39}
            priority
          />
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1 text-sm font-medium">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className={`relative px-4 py-2 rounded-md transition-colors ${
                active === l.href
                  ? "text-blue-600 bg-blue-50"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
              }`}
            >
              {tr(l.label)}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <LanguageSwitch className="hidden sm:inline-flex" />
          {signedIn ? (
            <Link href="/home" className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-md transition-colors">
              {tr("Go to dashboard")}
            </Link>
          ) : (
            <>
          <Popover open={showLogin} onOpenChange={setShowLogin}>
            <PopoverTrigger asChild>
              <button className="hidden sm:inline-block text-sm font-semibold text-gray-800 border border-gray-300 hover:border-gray-900 px-4 py-2 rounded-md transition-colors">
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
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-md transition-colors"
          >
            {tr("Create my resume")}
          </Link>

            </>
          )}

          <button
            className="md:hidden p-2 text-gray-700"
            onClick={() => setMenuOpen((o) => !o)}
            aria-label={tr("Toggle menu")}
          >
            {menuOpen ? <XIcon className="w-6 h-6" /> : <MenuIcon className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Scroll progress */}
      <div className="absolute bottom-0 left-0 h-0.5 bg-blue-600 transition-[width] duration-100" style={{ width: `${progress}%` }} />

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden border-t border-gray-200 bg-white px-4 py-3 flex flex-col">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              onClick={() => setMenuOpen(false)}
              className="py-3 text-gray-800 font-medium border-b border-gray-100"
            >
              {tr(l.label)}
            </a>
          ))}
          <LanguageSwitch className="my-3 w-fit" />
          <Link href={signedIn ? "/home" : "/login?view=login"} className="py-3 text-blue-600 font-semibold">
            {signedIn ? tr("Go to dashboard") : tr("Log in")}
          </Link>
        </div>
      )}
    </header>
  );
}
