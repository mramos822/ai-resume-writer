"use client";

// "What is your level?": Kaizo says what it thinks from the jobs in the profile, and the person confirms or changes it.
// The confirmed level is saved in the profile and used to filter the job search. `mention` (optional) lets the person choose
// whether the level is written in the objective of the resume.
import React from "react";
import { Check, Sparkles } from "lucide-react";
import { useProfile } from "@/context/profileContext";
import { asLevel, inferLevel, LEVELS, LEVEL_LABEL, type Level } from "@/lib/experienceLevel";
import { useT } from "@/i18n/provider";

/** Whether the level is written in the objective of the resume: two buttons, the chosen one filled. */
function MentionChoice({ level, mention, onMention }: { level: Level; mention: boolean; onMention: (v: boolean) => void }) {
  const { tr } = useT();
  const options = [
    { on: true, label: tr("{level} in my objective", { level: tr(LEVEL_LABEL[level]) }) },
    { on: false, label: tr("Do not mention it") },
  ];
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <span className="flex items-center gap-1.5 text-sm font-semibold">
        <Sparkles className="h-4 w-4 text-blue-500" />
        {tr("Your level on the resume")}
      </span>
      <div role="radiogroup" aria-label={tr("Your level on the resume")} className="inline-flex rounded-full bg-muted p-1">
        {options.map((o) => (
          <button
            key={String(o.on)}
            type="button"
            role="radio"
            aria-checked={mention === o.on}
            onClick={() => onMention(o.on)}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-all ${mention === o.on ? "bg-blue-600 text-white shadow-md shadow-blue-600/30" : "text-muted-foreground hover:text-foreground"}`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function ExperienceLevelPicker({
  mention,
  onMention,
  compact = false,
}: {
  /** the person wants the level in the objective of this resume */
  mention?: boolean;
  onMention?: (v: boolean) => void;
  /** a single dropdown with its label, for a narrow place (next to the job you are after in the profile) */
  compact?: boolean;
}) {
  const { tr } = useT();
  const { activeProfile, applyProfileData } = useProfile();
  const guess = inferLevel(activeProfile);
  const confirmed = asLevel(activeProfile.experienceLevel);
  const shown: Level = confirmed ?? guess.level;

  const choose = (l: Level) => {
    if (l === confirmed) return;
    applyProfileData({ experienceLevel: l }).catch(() => {});
  };

  // already confirmed in the profile: nothing to ask here, only whether it goes in the objective of this resume
  if (confirmed && onMention && !compact) {
    return (
      <MentionChoice level={confirmed} mention={!!mention} onMention={onMention} />
    );
  }

  if (compact) {
    return (
      <div>
        <label htmlFor="experience-level" className="mb-1.5 block font-semibold">{tr("Your level")}</label>
        <select
          id="experience-level"
          value={confirmed ?? ""}
          onChange={(e) => choose((asLevel(e.target.value) ?? guess.level) as Level)}
          className="h-11 w-full rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50"
        >
          {!confirmed && <option value="">{tr("Kaizo thinks:")} {tr(LEVEL_LABEL[guess.level])}</option>}
          {LEVELS.map((l) => (
            <option key={l} value={l}>{tr(LEVEL_LABEL[l])}</option>
          ))}
        </select>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {confirmed ? tr("It decides which jobs are shown to you.") : `${tr(guess.reason, { years: guess.years, title: guess.title ?? "" })} ${tr("Pick one to confirm it.")}`}
        </p>
      </div>
    );
  }

  return (
    <section className={"rounded-xl border p-4"}>
      <p className="flex items-center gap-2 text-sm font-bold">
        <Sparkles className="h-4 w-4 text-blue-500" />
        {tr("What is your level?")}
      </p>
      <p className="mb-3 mt-1 text-sm text-muted-foreground">
        {confirmed ? tr("This is the level you confirmed. It is used to show you the jobs that fit it.") : `${tr("Kaizo thinks:")} ${tr(LEVEL_LABEL[guess.level])}. ${tr(guess.reason, { years: guess.years, title: guess.title ?? "" })} ${tr("Confirm it or change it.")}`}
      </p>
      <div role="radiogroup" aria-label={tr("Your level")} className="flex flex-wrap gap-1.5">
        {LEVELS.map((l) => (
          <button
            key={l}
            type="button"
            role="radio"
            aria-checked={shown === l}
            onClick={() => choose(l)}
            className={`inline-flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-sm font-semibold transition-colors ${shown === l ? (confirmed === l ? "border-blue-600 bg-blue-600 text-white" : "border-blue-600 bg-blue-600/10 text-blue-600") : "text-muted-foreground hover:border-blue-500 hover:text-foreground"}`}
          >
            {confirmed === l && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
            {tr(LEVEL_LABEL[l])}
          </button>
        ))}
      </div>
      {!confirmed && (
        <button type="button" onClick={() => choose(guess.level)} className="mt-2 text-xs font-semibold text-blue-500 underline-offset-4 hover:underline">
          {tr("Yes, I am {level}", { level: tr(LEVEL_LABEL[guess.level]) })}
        </button>
      )}
      {onMention && (
        <div className="mt-4">
          <MentionChoice
            level={shown}
            mention={!!mention}
            onMention={(v) => {
              if (v && !confirmed) choose(guess.level); // the level that is written is confirmed
              onMention(v);
            }}
          />
        </div>
      )}
    </section>
  );
}
