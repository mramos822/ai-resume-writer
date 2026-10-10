"use client";

import React, { useMemo, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { ALL_SKILLS, POPULAR_SKILLS } from "@/lib/skills";
import { Input } from "@/components/ui/input";

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
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const wrap = useRef<HTMLDivElement>(null);

  const taken = useMemo(() => new Set(skills.map((s) => s.toLowerCase())), [skills]);

  const matches = useMemo(() => {
    const q = draft.trim().toLowerCase();
    if (!q) return [];
    const pool = ALL_SKILLS.filter((s) => !taken.has(s.toLowerCase()));
    // exact match first, then names that start with the text (shortest first), then names that contain it
    const exact = pool.filter((s) => s.toLowerCase() === q);
    const starts = pool.filter((s) => s.toLowerCase() !== q && s.toLowerCase().startsWith(q)).sort((x, y) => x.length - y.length);
    const inside = pool.filter((s) => !s.toLowerCase().startsWith(q) && s.toLowerCase().includes(q));
    return [...exact, ...starts, ...inside].slice(0, 8);
  }, [draft, taken]);

  const popular = useMemo(() => POPULAR_SKILLS.filter((s) => !taken.has(s.toLowerCase())).slice(0, 14), [taken]);

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
          placeholder="Start typing, e.g. Customer service, Python, Excel…"
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
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Popular on resumes</p>
          <ul className="flex flex-wrap gap-2">
            {popular.map((s) => (
              <li key={s}>
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
        </div>
      )}
    </div>
  );
}
