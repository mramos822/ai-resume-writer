// src/components/profile/careerObjectiveSection.tsx
"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { useProfile } from "@/context/profileContext";
import JobTitleInput from "../jobTitleInput";
import ExperienceLevelPicker from "@/components/experienceLevelPicker";
import { useT } from "@/i18n/provider";

const EXAMPLES = [
  {
    who: "Software engineer",
    text: "Full-stack developer with five years of experience building web apps that people actually use. I like turning messy problems into simple tools, and I have led small teams through launches in React and Node.js. I am looking for a role where I can keep building and help others grow.",
  },
  {
    who: "Marketing",
    text: "Digital marketer who grew a brand's audience by 40% in two years through content and email campaigns. I enjoy mixing creative ideas with numbers to see what works. I want to bring that approach to a team that cares about its customers.",
  },
];

/** Where the person says which job they want and tells their story. Changes go straight to the profile (Save keeps them). */
const CareerObjectiveSection: React.FC = () => {
  const { tr } = useT();
  const { activeProfile: profile, updateJobTitle, updateCareerObjective } = useProfile();
  const [showExamples, setShowExamples] = useState(false);
  const text = profile.careerObjective ?? "";
  const n = text.trim().length;
  const state = n === 0 ? "empty" : n < 250 ? "short" : n <= 700 ? "good" : "long";
  const note = {
    empty: "Write three to five sentences about who you are and what you bring.",
    short: "Good start. A few more sentences will make it feel like a real introduction.",
    good: "This length reads well.",
    long: "It is getting long. Try to keep it to about five sentences.",
  }[state];

  return (
    <motion.div className="space-y-7">
      <div className="grid gap-x-6 gap-y-5 md:grid-cols-[minmax(0,1fr)_17rem]">
        <div>
          <label htmlFor="job-title" className="mb-1.5 block font-semibold">{tr("The job you are after")}</label>
          <JobTitleInput value={profile.jobTitle ?? ""} onChange={updateJobTitle} placeholder={tr("Start typing, e.g. Software Engineer")} />
          <p className="mt-1.5 text-sm text-muted-foreground">{tr("It goes under your name and helps match you with the right jobs.")}</p>
        </div>
        <ExperienceLevelPicker compact />
      </div>

      <div>
        <label htmlFor="summary" className="mb-1.5 block font-semibold">{tr("Your summary")}</label>
        <textarea
          id="summary"
          value={text}
          onChange={(e) => updateCareerObjective(e.target.value)}
          rows={7}
          placeholder={tr("Tell it like you would to someone you just met at an interview: who you are, what you are good at, and what you want to do next.")}
          className="w-full resize-y rounded-xl border bg-background px-4 py-3 text-[15px] leading-relaxed outline-none focus-visible:border-blue-500 focus-visible:ring-4 focus-visible:ring-blue-500/10"
        />
        <div className="mt-2 flex items-center justify-between gap-3 text-sm">
          <p className={state === "good" ? "font-medium text-green-600" : "text-muted-foreground"}>{note}</p>
          <p className="shrink-0 tabular-nums text-muted-foreground">{n}{" "}{tr("characters")}</p>
        </div>
      </div>

      <div className="rounded-xl bg-muted/40">
        <button type="button" aria-expanded={showExamples} onClick={() => setShowExamples((v) => !v)} className="flex w-full items-center justify-between px-4 py-3 text-left font-semibold">{tr("Need some inspiration?")}<ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-300 ${showExamples ? "rotate-180" : ""}`} />
        </button>
        <AnimatePresence initial={false}>
          {showExamples && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.28 }} style={{ overflow: "hidden" }}>
              <div className="space-y-4 px-4 pb-4">
                {EXAMPLES.map((e) => (
                  <div key={e.who}>
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{e.who}</p>
                    <p className="mt-1 text-sm leading-relaxed">&ldquo;{tr(e.text)}&rdquo;</p>
                    <button type="button" onClick={() => updateCareerObjective(e.text)} className="mt-1.5 text-sm font-semibold text-blue-500 hover:underline">{tr("Use it as a starting point")}</button>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

export default CareerObjectiveSection;
