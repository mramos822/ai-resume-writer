"use client";

import React, { useState } from "react";
import { ChevronDown, Lock } from "lucide-react";
import { TEMPLATES, supportsSkillLevels } from "@/lib/templates";
import { AnimatePresence, motion } from "framer-motion";
import { SKILL_LEVEL_LABELS, skillLevel, skillLevelLabel, type SkillLevels } from "@/lib/skillLevels";
import { useT } from "@/i18n/provider";

/**
 * Optional: how confident the person is with each skill (1 to 5).
 * Skills left without a level show no bars or dots on the resume.
 */
export default function SkillLevelPicker({
  skills,
  levels,
  onChange,
  template,
}: {
  skills: string[];
  levels: SkillLevels;
  onChange: (next: SkillLevels) => void;
  /** The look chosen for the resume: the ones that write skills as plain text have no use for levels. */
  template?: string;
}) {
  const { tr } = useT();
  const [open, setOpen] = useState(false);
  // the dot under the cursor: it and every dot to its left light up, as a preview of the level you would set
  const [hover, setHover] = useState<{ skill: string; n: number } | null>(null);
  if (skills.length === 0) return null;
  if (!supportsSkillLevels(template)) {
    const name = TEMPLATES.find((t) => t.id === template)?.name.replace(" (Default)", "") ?? "";
    return (
      <div className="mt-6 flex items-start gap-3 rounded-xl border border-dashed bg-muted/40 px-4 py-3 opacity-80" aria-disabled="true">
        <Lock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-muted-foreground">{tr("How confident are you with each one?")}</span>
          <span className="block text-xs text-muted-foreground">
            {tr("The {name} look writes skills as plain text, so levels are not used. Switch to Classic, Modern or Creative to rate them.", { name: tr(name) })}
          </span>
        </span>
      </div>
    );
  }
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
          <span className="block text-sm font-semibold">{tr("How confident are you with each one?")}{" "}<span className="font-normal text-muted-foreground">{tr("(optional)")}</span>
          </span>
          <span className="block text-xs text-muted-foreground">
            {rated > 0
              ? tr("{rated} of {length} rated. Classic, Modern and Creative show it as stars, bars or dots.", { rated, length: skills.length })
              : tr("Rate from 1 to 5. If you skip it, no bars or dots appear on your resume.")}
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
                    <span className="hidden w-24 text-right text-xs text-muted-foreground sm:block">{shown ? tr(skillLevelLabel(shown)) : tr("Not set")}</span>
                    <span className="flex items-center gap-1.5" role="group" aria-label={tr("Level of {s}", { s })} onMouseLeave={() => setHover(null)}>
                      {SKILL_LEVEL_LABELS.map((label, i) => {
                        const n = i + 1;
                        return (
                          <button
                            key={label}
                            type="button"
                            aria-label={`${s}: ${tr(label)}`}
                            aria-pressed={lv === n}
                            title={tr(label)}
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
