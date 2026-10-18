"use client";

import React, { useMemo, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { ALL_SKILLS, POPULAR_SKILLS } from "@/lib/skills";
import { fold } from "@/lib/fold";
import { Input } from "@/components/ui/input";
import { useT } from "@/i18n/provider";

/**
 * Skill field with autocomplete from a big list of common resume skills, plus one-tap popular suggestions.
 * Anything not in the list can still be typed and added with Enter or a comma.
 */
export default function SkillInput({
  draft,
  onDraftChange,
  skills,
  onAdd,
  autoFocus,
}: {
  draft: string;
  onDraftChange: (v: string) => void;
  skills: string[];
  onAdd: (raw: string) => void;
  autoFocus?: boolean;
}) {
  const { tr } = useT();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const wrap = useRef<HTMLDivElement>(null);

  const taken = useMemo(() => new Set(skills.map((s) => s.toLowerCase())), [skills]);

  const allSkills = useMemo(() => ALL_SKILLS.map((s) => tr(s)), [tr]);
  const matches = useMemo(() => {
    // accents and capitals do not matter ("gestion" finds "Gestión de proyectos")
    const q = fold(draft);
    if (!q) return [];
    const pool = allSkills.filter((s) => !taken.has(s.toLowerCase()));
    // exact match first, then names that start with the text (shortest first), then names that contain it
    const exact = pool.filter((s) => fold(s) === q);
    const starts = pool.filter((s) => fold(s) !== q && fold(s).startsWith(q)).sort((x, y) => x.length - y.length);
    const inside = pool.filter((s) => !fold(s).startsWith(q) && fold(s).includes(q));
    return [...exact, ...starts, ...inside].slice(0, 8);
  }, [draft, taken, allSkills]);

  // on a phone only a few ideas show at first, so the list does not push everything else far down
  const [more, setMore] = useState(false);
  const popular = useMemo(() => POPULAR_SKILLS.map((s) => tr(s)).filter((s) => !taken.has(s.toLowerCase())).slice(0, 14), [taken, tr]);

  const pick = (s: string) => {
    onAdd(s);
    setOpen(false);
    setActive(-1);
  };

  return (
    <div>
      <div
        ref={wrap}
        className="relative"
        onBlur={(e) => {
          if (!wrap.current?.contains(e.relatedTarget as Node)) {
            setOpen(false);
            if (draft.trim()) onAdd(draft);
          }
        }}
      >
        <Input
          value={draft}
          autoFocus={autoFocus}
          placeholder={tr("Start typing, e.g. Customer service, Python, Excel…")}
          role="combobox"
          aria-expanded={open}
          autoComplete="off"
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            onDraftChange(e.target.value);
            setOpen(true);
            setActive(-1);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((i) => Math.min(i + 1, matches.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((i) => Math.max(i - 1, -1));
            } else if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              if (e.key === "Enter" && active >= 0) pick(matches[active]);
              else onAdd(draft);
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
        />
        {open && matches.length > 0 && (
          <ul role="listbox" className="absolute z-20 mt-1 no-scrollbar max-h-72 w-full overflow-auto rounded-md border bg-popover py-1 text-sm shadow-lg">
            {matches.map((s, i) => (
              <li key={s} role="option" aria-selected={i === active}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(s)}
                  className={`block w-full px-3 py-2 text-left ${i === active ? "bg-accent" : "hover:bg-accent"}`}
                >
                  {s}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {popular.length > 0 && (
        <div className="mt-5">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{tr("Popular on resumes")}</p>
          <ul className="flex flex-wrap gap-2">
            {popular.map((s, i) => (
              <li key={s} className={!more && i >= 6 ? "hidden sm:block" : ""}>
                <button
                  type="button"
                  onClick={() => onAdd(s)}
                  className="inline-flex items-center gap-1 rounded-full border border-dashed px-3 py-1 text-sm text-muted-foreground transition-colors hover:border-blue-500 hover:bg-accent hover:text-foreground"
                >
                  <Plus className="h-3 w-3" /> {s}
                </button>
              </li>
            ))}
          </ul>
          {!more && popular.length > 6 && (
            <button type="button" onClick={() => setMore(true)} className="mt-1.5 inline-flex min-h-6 items-center text-sm font-semibold text-blue-600 hover:underline sm:hidden">{tr("More ideas")}</button>
          )}
        </div>
      )}
    </div>
  );
}
