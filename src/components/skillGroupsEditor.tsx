"use client";

import React, { useState } from "react";
import { FolderPlus, Layers, Wand2, X } from "lucide-react";
import { autoGroupSkills } from "@/lib/skillCategories";
import { GROUP_SUGGESTIONS, cleanSkillGroups, groupSkills, type SkillGroups } from "@/lib/skillGroups";
import { useT } from "@/i18n/provider";

/**
 * Optional: put the skills in groups, so the resume shows "Languages: Java, Python" and "Tools: Git, Excel" on separate lines
 * instead of one long list. Each skill is in one group or in none.
 */
export default function SkillGroupsEditor({
  skills,
  groups,
  onChange,
}: {
  skills: string[];
  groups: SkillGroups | undefined;
  onChange: (next: SkillGroups) => void;
}) {
  const { tr } = useT();
  const [open, setOpen] = useState(false);
  // groups that have no skill yet (a name is only saved with a skill that is in it)
  const [empty, setEmpty] = useState<string[]>([]);
  const [note, setNote] = useState("");

  if (skills.length < 2) return null;

  const current = groupSkills(skills, groups);
  const named = current.filter((g) => g.label);
  const names = Array.from(new Set([...named.map((g) => g.label), ...empty]));
  const loose = current.find((g) => !g.label)?.skills ?? [];
  const labelOf = (s: string) => (groups?.[s] ?? "").trim();

  const move = (skill: string, label: string) => {
    const next = { ...(groups ?? {}) };
    if (label) next[skill] = label;
    else delete next[skill];
    if (label) setEmpty((e) => e.filter((x) => x !== label));
    onChange(cleanSkillGroups(skills, next));
  };
  const rename = (from: string, to: string) => {
    const label = to.trim().slice(0, 40);
    if (!label || label === from) return;
    const next = { ...(groups ?? {}) };
    for (const s of skills) if (labelOf(s) === from) next[s] = label;
    setEmpty((e) => e.map((x) => (x === from ? label : x)));
    onChange(cleanSkillGroups(skills, next));
  };
  const addGroup = (name: string) => {
    const label = name.trim().slice(0, 40);
    if (!label || names.some((n) => n.toLowerCase() === label.toLowerCase())) return;
    setEmpty((e) => [...e, label]);
  };
  const removeGroup = (label: string) => {
    const next = { ...(groups ?? {}) };
    for (const s of skills) if (labelOf(s) === label) delete next[s];
    setEmpty((e) => e.filter((x) => x !== label));
    onChange(cleanSkillGroups(skills, next));
  };

  const auto = () => {
    const next = autoGroupSkills(skills, groups, (g) => tr(g));
    const changed = skills.some((x) => (next[x] ?? "") !== (groups?.[x] ?? ""));
    setNote(changed ? "" : tr("Nothing to group yet. Add a few more skills, or make a group by hand."));
    if (changed) {
      setOpen(true);
      onChange(next);
    }
  };

  const mover = (skill: string) => (
    <select
      aria-label={tr("Group of {s}", { s: skill })}
      value={labelOf(skill)}
      onChange={(e) => move(skill, e.target.value)}
      className="max-w-[9rem] cursor-pointer rounded border-0 bg-transparent py-0 pl-1 pr-5 text-xs text-muted-foreground focus:outline-none focus:ring-1 focus:ring-blue-600"
    >
      <option value="">{tr("No group")}</option>
      {names.map((n) => (
        <option key={n} value={n}>
          {n}
        </option>
      ))}
    </select>
  );

  return (
    <div className="mt-6 rounded-xl border">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-600/10 text-blue-600">
          <Layers className="h-5 w-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold">{tr("Group your skills")}</span>
          <span className="block text-xs text-muted-foreground">
            {named.length > 0
              ? tr("{n} groups. Each one goes on its own line of your resume.", { n: named.length })
              : tr("Optional. Show \"Languages: Java, Python\" and \"Tools: Git, Excel\" on separate lines.")}
          </span>
        </span>
        <span className="text-xs font-semibold text-blue-600">{open ? tr("Hide") : tr("Edit")}</span>
      </button>
      <div className="flex flex-wrap items-center gap-3 border-t px-4 py-2.5">
        <button type="button" onClick={auto} className="inline-flex items-center gap-1.5 rounded-full bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-blue-700">
          <Wand2 className="h-3.5 w-3.5" /> {tr("Group automatically")}
        </button>
        {note && <span className="text-xs text-muted-foreground" role="status">{note}</span>}
      </div>

      {open && (
        <div className="space-y-4 border-t px-4 py-4">
          {names.map((label) => (
            <GroupCard
              key={label}
              label={label}
              skills={current.find((g) => g.label === label)?.skills ?? []}
              onRename={(to) => rename(label, to)}
              onRemove={() => removeGroup(label)}
              onUngroup={(s) => move(s, "")}
            />
          ))}

          <div>
            <p className="mb-2 text-xs font-semibold text-muted-foreground">{tr("New group")}</p>
            <div className="flex flex-wrap gap-2">
              {GROUP_SUGGESTIONS.filter((g) => !names.some((n) => n.toLowerCase() === tr(g).toLowerCase())).map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => addGroup(tr(g))}
                  className="inline-flex items-center gap-1 rounded-full border border-dashed px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-blue-500 hover:text-blue-600"
                >
                  <FolderPlus className="h-3.5 w-3.5" /> {tr(g)}
                </button>
              ))}
              <NewGroupInput onAdd={addGroup} />
            </div>
          </div>

          {names.length > 0 && loose.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold text-muted-foreground">{tr("Not in a group yet")}</p>
              <ul className="flex flex-wrap gap-2">
                {loose.map((s) => (
                  <li key={s} className="inline-flex items-center gap-1 rounded-md bg-accent py-1 pl-3 pr-1 text-sm">
                    {s}
                    {mover(s)}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function GroupCard({
  label,
  skills,
  onRename,
  onRemove,
  onUngroup,
}: {
  label: string;
  skills: string[];
  onRename: (to: string) => void;
  onRemove: () => void;
  onUngroup: (skill: string) => void;
}) {
  const { tr } = useT();
  const [name, setName] = useState(label);
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="flex items-center gap-2">
        <input
          value={name}
          maxLength={40}
          aria-label={tr("Group name")}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => (name.trim() ? onRename(name) : setName(label))}
          onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
          className="h-9 flex-1 rounded-md border bg-background px-3 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600"
        />
        <button type="button" onClick={onRemove} aria-label={tr("Remove group {s}", { s: label })} className="rounded p-1.5 text-muted-foreground hover:text-red-600">
          <X className="h-4 w-4" />
        </button>
      </div>
      {skills.length === 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">{tr("Choose this group in the list of a skill below to add it here.")}</p>
      ) : (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {skills.map((s) => (
            <li key={s} className="inline-flex items-center gap-1 rounded-md bg-accent px-2.5 py-1 text-sm">
              {s}
              <button type="button" aria-label={tr("Take {s} out of the group", { s })} onClick={() => onUngroup(s)} className="text-muted-foreground hover:text-red-600">
                <X className="h-3 w-3" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function NewGroupInput({ onAdd }: { onAdd: (name: string) => void }) {
  const { tr } = useT();
  const [v, setV] = useState("");
  const add = () => {
    onAdd(v);
    setV("");
  };
  return (
    <input
      value={v}
      maxLength={40}
      onChange={(e) => setV(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          add();
        }
      }}
      onBlur={() => v.trim() && add()}
      placeholder={tr("Other name…")}
      aria-label={tr("New group")}
      className="h-7 w-32 rounded-full border bg-background px-3 text-xs focus:outline-none focus:ring-2 focus:ring-blue-600"
    />
  );
}
