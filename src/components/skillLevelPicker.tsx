"use client";

import React, { useState } from "react";
import { ChevronDown } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { SKILL_LEVEL_LABELS, skillLevel, skillLevelLabel, type SkillLevels } from "@/lib/skillLevels";

/**
 * Optional: how confident the person is with each skill (1 to 5).
 * Skills left without a level show no bars or dots on the resume.
 */
export default function SkillLevelPicker({
  skills,
  levels,
  onChange,
}: {
  skills: string[];
  levels: SkillLevels;
  onChange: (next: SkillLevels) => void;
}) {
  const [open, setOpen] = useState(false);
  // the dot under the cursor: it and every dot to its left light up, as a preview of the level you would set
  const [hover, setHover] = useState<{ skill: string; n: number } | null>(null);
  if (skills.length === 0) return null;
  const rated = skills.filter((s) => skillLevel(levels, s) > 0).length;

  const set = (skill: string, n: number) => {
    const next = { ...levels };
    if (skillLevel(levels, skill) === n) delete next[skill]; // tapping the same dot again clears it
    else next[skill] = n;
    onChange(next);
  };

  return (
    <div className="mt-6 rounded-xl border bg-card">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">
            How confident are you with each one? <span className="font-normal text-muted-foreground">(optional)</span>
          </span>
          <span className="block text-xs text-muted-foreground">
            {rated > 0
              ? `${rated} of ${skills.length} rated. Modern and Creative show it as bars or dots.`
              : "Rate from 1 to 5. If you skip it, no bars or dots appear on your resume."}
          </span>
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-300 ${open ? "rotate-180" : ""}`} />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="levels"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            style={{ overflow: "hidden" }}
          >
            <ul className="space-y-1 border-t px-4 py-3">
              {skills.map((s) => {
                const lv = skillLevel(levels, s);
                const shown = hover?.skill === s ? hover.n : lv;
                return (
                  <li key={s} className="flex items-center gap-3 py-1">
                    <span className="min-w-0 flex-1 truncate text-sm">{s}</span>
                    <span className="hidden w-24 text-right text-xs text-muted-foreground sm:block">{shown ? skillLevelLabel(shown) : "Not set"}</span>
                    <span className="flex items-center gap-1.5" role="group" aria-label={`Level of ${s}`} onMouseLeave={() => setHover(null)}>
                      {SKILL_LEVEL_LABELS.map((label, i) => {
                        const n = i + 1;
                        return (
                          <button
                            key={label}
                            type="button"
                            aria-label={`${s}: ${label}`}
                            aria-pressed={lv === n}
                            title={label}
                            onClick={() => set(s, n)}
                            onMouseEnter={() => setHover({ skill: s, n })}
                            onFocus={() => setHover({ skill: s, n })}
                            onBlur={() => setHover(null)}
                            className={`h-4 w-4 rounded-full border-2 transition-all duration-150 ${
                              n <= shown
                                ? hover?.skill === s
                                  ? "border-blue-400 bg-blue-400 scale-110"
                                  : "border-blue-600 bg-blue-600"
                                : "border-border bg-transparent"
                            }`}
                          />
                        );
                      })}
                    </span>
                  </li>
                );
              })}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
