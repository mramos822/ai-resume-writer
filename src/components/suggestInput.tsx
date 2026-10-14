"use client";

import React, { useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useT } from "@/i18n/provider";
import { fold } from "@/lib/fold";

/**
 * Text field that suggests entries from a list while you type (best matches first).
 * Anything that is not in the list can still be typed freely.
 */
export default function SuggestInput({
  value,
  onChange,
  options: rawOptions,
  placeholder,
  autoFocus,
  max = 8,
  browse,
  terms,
  translate = true,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder?: string;
  autoFocus?: boolean;
  max?: number;
  /** shows an arrow that opens the whole list, to look for an entry instead of typing it */
  browse?: boolean;
  /** other names an option is known by (initials, nicknames): typing one of them finds the option */
  terms?: (option: string) => string[];
  /** show the options in the language of the site (default); false keeps them as they are written, in English */
  translate?: boolean;
}) {
  const { tr } = useT();
  // the suggestions are shown (and searched, and stored when picked) in the language of the site
  const options = useMemo(() => (translate ? rawOptions.map((o) => tr(o)) : rawOptions), [rawOptions, tr, translate]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  // the arrow opened the whole list: it stays until something is typed or picked
  const [browsing, setBrowsing] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  // The list is drawn on <body>, next to the field: a card or a window that clips its content (a folded section, a dialog) never
  // cuts it, and it opens upwards when there is no room below.
  const [pos, setPos] = useState<{ left: number; width: number; top?: number; bottom?: number; maxH: number } | null>(null);
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const r = wrap.current?.getBoundingClientRect();
      if (!r) return;
      const below = window.innerHeight - r.bottom - 100; // the pinned bottom bar
      const above = r.top - 72; // the top bar
      const down = below >= 180 || below >= above;
      setPos(
        down
          ? { left: r.left, width: r.width, top: r.bottom + 4, maxH: Math.max(120, Math.min(288, below)) }
          : { left: r.left, width: r.width, bottom: window.innerHeight - r.top + 4, maxH: Math.max(120, Math.min(288, above)) }
      );
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, value]);

  const matches = useMemo(() => {
    // accents, capitals and punctuation do not matter: "universidad catolica" finds "Pontificia Universidad Católica…"
    const q = fold(value);
    if (browsing) return options.slice(0, 400);
    if (!q) return [];
    // every word typed has to appear, so "ut austin" finds "University of Texas at Austin"-style names too
    const words = q.split(" ");
    const folded = options.map((o) => ({ o, f: fold(o), t: (terms?.(o) ?? []).map(fold) }));
    // an acronym or nickname typed whole ("njit", "georgia tech") finds that option first
    const exact = folded.filter(({ t }) => t.includes(q)).map(({ o }) => o);
    const hit = folded.filter(({ o, f, t }) => !exact.includes(o) && (words.every((w) => f.includes(w)) || (q.length >= 2 && t.some((x) => x.startsWith(q)))));
    const starts = hit.filter(({ f }) => f.startsWith(q)).map(({ o }) => o);
    const rest = hit.filter(({ f }) => !f.startsWith(q)).map(({ o }) => o);
    return [...exact, ...starts, ...rest].slice(0, max);
  }, [value, options, max, browsing, terms]);

  const pick = (o: string) => {
    onChange(o);
    setOpen(false);
    setActive(-1);
    setBrowsing(false);
  };

  return (
    <div
      ref={wrap}
      className="relative"
      onBlur={(e) => {
        if (!wrap.current?.contains(e.relatedTarget as Node)) setOpen(false);
      }}
    >
      <Input
        value={value}
        autoFocus={autoFocus}
        placeholder={placeholder}
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        autoComplete="off"
        // not opened by just landing on the field (a form that opens takes the focus): a click, typing or the arrows open it
        onClick={() => setOpen(true)}
        className={browse ? "pr-10" : undefined}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setActive(-1);
          setBrowsing(false);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
            setActive((i) => Math.min(i + 1, matches.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((i) => Math.max(i - 1, -1));
          } else if (e.key === "Enter" && open && active >= 0) {
            e.preventDefault();
            pick(matches[active]);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
      />
      {browse && options.length > 0 && (
        <button
          type="button"
          tabIndex={-1}
          aria-label={browsing && open ? tr("Close the list") : tr("Browse the list")}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            const next = !(open && browsing);
            setBrowsing(next);
            setOpen(next);
            setActive(-1);
          }}
          className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${open && browsing ? "rotate-180" : ""}`} />
        </button>
      )}
      {typeof document !== "undefined" && createPortal(
        <AnimatePresence>
        {open && pos && matches.length > 0 && (
        <motion.ul
          key="list"
          role="listbox"
          initial={{ opacity: 0, y: pos.bottom !== undefined ? 6 : -6, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: pos.bottom !== undefined ? 4 : -4, scale: 0.98 }}
          transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
          className="no-scrollbar overflow-auto overscroll-contain rounded-md border bg-popover py-1 text-sm text-popover-foreground shadow-lg"
          style={{ position: "fixed", left: pos.left, width: pos.width, top: pos.top, bottom: pos.bottom, maxHeight: pos.maxH, zIndex: 90, transformOrigin: pos.bottom !== undefined ? "bottom" : "top" }}
        >
          {matches.map((o, i) => (
            <li key={o} role="option" aria-selected={i === active}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(o)}
                className={`block w-full px-3 py-2 text-left transition-colors ${i === active ? "bg-accent" : "hover:bg-accent"}`}
              >
                {o}
              </button>
            </li>
          ))}
        </motion.ul>
        )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
}
