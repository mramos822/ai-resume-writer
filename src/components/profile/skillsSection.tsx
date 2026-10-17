"use client";

import { dndAccessibility } from "@/i18n/dnd";
import React, { useState, useEffect, useCallback } from "react";
import { Plus, X, GripVertical } from "lucide-react";
import { useProfile } from "@/context/profileContext";
import { POPULAR_SKILLS } from "@/lib/skills";
import { looksLikeSentence } from "@/lib/skillCategories";

// dnd‑kit core + sortable helpers
import {
  DndContext,
  DragOverlay,
  closestCenter,
  MouseSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  rectSortingStrategy,
  arrayMove,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useT } from "@/i18n/provider";

/******************************
 * A single draggable skill
 ******************************/
interface SkillChipProps {
  skill: string;
  onRemove: (skill: string) => void;
}

/** How a skill looks. The same one is drawn in the list and, bigger and floating, under the cursor while it is dragged. */
function ChipView({ skill, floating = false, onRemove }: { skill: string; floating?: boolean; onRemove?: (skill: string) => void }) {
  return (
    <div
      className={`flex items-center gap-2 rounded-xl border bg-card px-3 py-2.5 text-sm ${floating ? "scale-105 cursor-grabbing border-blue-500 shadow-xl shadow-blue-900/20 ring-2 ring-blue-500/30" : "cursor-grab shadow-sm transition-colors hover:border-blue-500/60"}`}
    >
      <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground" />
      <span className="flex-1 select-none truncate">{skill}</span>
      {onRemove && (
        <button
          type="button"
          aria-label={skill}
          // a click on the X is a click, never the start of a drag
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          onClick={() => onRemove(skill)}
          className="shrink-0 rounded p-1 text-red-500 hover:bg-red-500/10 hover:text-red-700"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

function SkillChip({ skill, onRemove }: SkillChipProps) {
  // turn this chip into a sortable item
  const { setNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({ id: skill });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      // the whole chip can be grabbed; while it is dragged its place shows a dashed gap and the moving copy is drawn on top
      {...attributes}
      {...listeners}
      className={`rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${isDragging ? "opacity-40" : ""}`}
    >
      {isDragging ? <div className="h-[2.75rem] rounded-xl border-2 border-dashed border-blue-500/50 bg-blue-500/5" /> : <ChipView skill={skill} onRemove={onRemove} />}
    </div>
  );
}

/******************************
 * Skills section with drag‑and‑drop ordering
 ******************************/
const SkillsSection: React.FC = () => {
  const { tr } = useT();
  const { activeProfile, updateSkills } = useProfile();

  // Local copy of the skills so we can reorder instantly
  const [skills, setSkills] = useState<string[]>(activeProfile.skills);
  const [newSkill, setNewSkill] = useState<string>("");

  // Make sure local state stays in sync when profile changes
  useEffect(() => setSkills(activeProfile.skills), [activeProfile.skills]);

  /***** dnd‑kit sensors *****/
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }), // a click is not a drag
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }), // a short press starts a drag; a swipe still scrolls the page
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }) // a11y
  );
  const [dragging, setDragging] = useState<string | null>(null);

  /***** CRUD helpers *****/
  const addSkill = () => {
    const trimmed = newSkill.trim();
    if (!trimmed || skills.includes(trimmed)) return;
    const next = [...skills, trimmed];
    setSkills(next);
    updateSkills(next);
    setNewSkill("");
  };

  const removeSkill = useCallback(
    (skill: string) => {
      const next = skills.filter((s) => s !== skill);
      setSkills(next);
      updateSkills(next);
    },
    [skills, updateSkills]
  );

  /***** Handle the actual re‑ordering *****/
  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setDragging(null);
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const oldIndex = skills.indexOf(active.id as string);
      const newIndex = skills.indexOf(over.id as string);
      const next = arrayMove(skills, oldIndex, newIndex);
      setSkills(next);
      updateSkills(next);
    },
    [skills, updateSkills]
  );

  return (
    <section className="space-y-5">
      {/** Add new skill **/}
      <div>
        <div className="flex gap-2">
          <input
            aria-label={tr("New skill")}
            value={newSkill}
            onChange={(e) => setNewSkill(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addSkill()}
            placeholder={tr("e.g. TypeScript")}
            className="h-11 flex-1 rounded-xl border border-border bg-background px-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
          <button
            onClick={addSkill}
            disabled={!newSkill.trim() || skills.includes(newSkill.trim())}
            className="flex h-11 items-center gap-1.5 rounded-xl bg-blue-600 px-5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            <span>{tr("Add")}</span>
          </button>
        </div>
        {newSkill.trim() && skills.includes(newSkill.trim()) && (
          <p className="mt-1 text-xs text-red-500">{tr("Skill already exists")}</p>
        )}
      </div>

      {/** Ideas to tap **/}
      {(() => {
        const ideas = POPULAR_SKILLS.map((x) => tr(x)).filter((x) => !skills.some((y) => y.toLowerCase() === x.toLowerCase())).slice(0, 10);
        if (ideas.length === 0) return null;
        return (
          <div>
            <p className="mb-2 text-sm font-semibold">{tr("Need ideas? Tap to add")}</p>
            <div className="flex flex-wrap gap-2">
              {ideas.map((idea) => (
                <button
                  key={idea}
                  type="button"
                  onClick={() => {
                    const next = [...skills, idea];
                    setSkills(next);
                    updateSkills(next);
                  }}
                  className="rounded-full border border-dashed px-3.5 py-1.5 text-sm text-muted-foreground transition-colors hover:border-blue-500 hover:bg-blue-500/5 hover:text-blue-500"
                >
                  + {idea}
                </button>
              ))}
            </div>
          </div>
        );
      })()}

      {/** Entries that are phrases from the resume, not skills (a read resume sometimes leaves them here) **/}
      {skills.some(looksLikeSentence) && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/40 bg-amber-500/5 px-4 py-3 text-sm">
          <p className="min-w-0 flex-1">
            <span className="font-semibold">{tr("Some entries look like sentences, not skills:")}</span>{" "}
            <span className="text-muted-foreground">{skills.filter(looksLikeSentence).join(" · ")}</span>
          </p>
          <button
            type="button"
            onClick={() => {
              const next = skills.filter((s) => !looksLikeSentence(s));
              setSkills(next);
              updateSkills(next);
            }}
            className="shrink-0 rounded-lg bg-amber-500 px-3 py-1.5 font-semibold text-white hover:bg-amber-600"
          >
            {tr("Remove them")}
          </button>
        </div>
      )}

      {/** List of draggable skills **/}
      {skills.length === 0 ? (
        <p className="rounded-xl border border-dashed py-8 text-center text-sm text-muted-foreground">{tr("No skills yet. Add the first one above.")}</p>
      ) : (
        <>
        <p className="text-xs text-muted-foreground">{tr("Drag a skill to reorder them. The first ones are the ones recruiters see first.")}</p>
        <DndContext
          accessibility={dndAccessibility(tr)}
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={(e: DragStartEvent) => setDragging(String(e.active.id))}
          onDragCancel={() => setDragging(null)}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={skills} strategy={rectSortingStrategy}>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {skills.map((skill) => (
                <SkillChip key={skill} skill={skill} onRemove={removeSkill} />
              ))}
            </div>
          </SortableContext>
          <DragOverlay dropAnimation={{ duration: 180, easing: "cubic-bezier(0.22, 1, 0.36, 1)" }}>{dragging ? <ChipView skill={dragging} floating /> : null}</DragOverlay>
        </DndContext>
        </>
      )}
    </section>
  );
};

export default SkillsSection;
