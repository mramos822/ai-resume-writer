"use client";

import React, { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/context/themeContext";
import { useT } from "@/i18n/provider";

/** The look of the day / night switch: a pill with a sun and a moon and a sliding knob. */
export function ThemeSwitch({ dark, onToggle }: { dark: boolean; onToggle: () => void }) {
  const { tr } = useT();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={dark}
      aria-label={tr("Dark mode")}
      onClick={onToggle}
      className={`relative h-8 w-14 shrink-0 rounded-full p-0.5 transition-colors duration-300 ${dark ? "bg-blue-600" : "bg-neutral-300"}`}
    >
      <Sun className="absolute left-2 top-2 h-4 w-4 text-white/90" />
      <Moon className="absolute right-2 top-2 h-4 w-4 text-white/90" />
      <span
        className={`relative block h-7 w-7 rounded-full bg-white shadow-md transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${
          dark ? "translate-x-6" : "translate-x-0"
        }`}
      />
    </button>
  );
}

/** The switch wired to the app's theme (for the places that are not the builder). */
export default function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { tr } = useT();
  const { setTheme } = useTheme();
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const root = document.documentElement;
    const sync = () => setDark(root.classList.contains("dark"));
    sync();
    const obs = new MutationObserver(sync);
    obs.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);
  const toggle = () => setTheme(dark ? "light" : "dark");
  if (!compact) return <ThemeSwitch dark={dark} onToggle={toggle} />;
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? tr("Switch to light mode") : tr("Switch to dark mode")}
      className="relative flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
    >
      <Sun className={`absolute h-[18px] w-[18px] transition-all duration-300 ${dark ? "rotate-90 scale-0 opacity-0" : "rotate-0 scale-100 opacity-100"}`} />
      <Moon className={`absolute h-[18px] w-[18px] transition-all duration-300 ${dark ? "rotate-0 scale-100 opacity-100" : "-rotate-90 scale-0 opacity-0"}`} />
    </button>
  );
}
