"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Plus, X, GripVertical } from "lucide-react";
import { useProfile } from "@/context/profileContext";
import { POPULAR_SKILLS } from "@/lib/skills";

// dnd‑kit core + sortable helpers
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

/******************************
 * A single draggable skill
 ******************************/
interface SkillChipProps {
  skill: string;
  onRemove: (skill: string) => void;
}

function SkillChip({ skill, onRemove }: SkillChipProps) {
  // turn this chip into a sortable item
  const {
    setNodeRef,
    attributes,
    listeners,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: skill });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    opacity: isDragging ? 0.6 : 1,
    cursor: "grab",
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      // spread the drag listeners on the WHOLE chip so the user can grab anywhere
      {...attributes}
      {...listeners}
      className="flex items-center gap-2 rounded-xl border bg-card px-3 py-2.5 text-sm shadow-sm transition-all hover:border-blue-500/60 hover:shadow-md"
    >
      <GripVertical className="h-4 w-4 text-muted-foreground" />
      <span className="flex-1 select-none">{skill}</span>
      <button
        onClick={() => onRemove(skill)}
        className="p-1 text-red-500 hover:text-red-700"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

/******************************
 * Skills section with drag‑and‑drop ordering
 ******************************/
const SkillsSection: React.FC = () => {
  const { activeProfile, updateSkills } = useProfile();

  // Local copy of the skills so we can reorder instantly
  const [skills, setSkills] = useState<string[]>(activeProfile.skills);
  const [newSkill, setNewSkill] = useState<string>("");

  // Make sure local state stays in sync when profile changes
  useEffect(() => setSkills(activeProfile.skills), [activeProfile.skills]);

  /***** dnd‑kit sensors *****/
  const sensors = useSensors(
    useSensor(PointerSensor), // mouse / touch
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }) // a11y
  );

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
            value={newSkill}
            onChange={(e) => setNewSkill(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addSkill()}
            placeholder="e.g. TypeScript"
            className="h-11 flex-1 rounded-xl border border-border bg-background px-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
          <button
            onClick={addSkill}
            disabled={!newSkill.trim() || skills.includes(newSkill.trim())}
            className="flex h-11 items-center gap-1.5 rounded-xl bg-blue-600 px-5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            <span>Add</span>
          </button>
        </div>
        {newSkill.trim() && skills.includes(newSkill.trim()) && (
          <p className="mt-1 text-xs text-red-500">Skill already exists</p>
        )}
      </div>

      {/** Ideas to tap **/}
      {(() => {
        const ideas = POPULAR_SKILLS.filter((x) => !skills.some((y) => y.toLowerCase() === x.toLowerCase())).slice(0, 10);
        if (ideas.length === 0) return null;
        return (
          <div>
            <p className="mb-2 text-sm font-semibold">Need ideas? Tap to add</p>
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

      {/** List of draggable skills **/}
      {skills.length === 0 ? (
        <p className="rounded-xl border border-dashed py-8 text-center text-sm text-muted-foreground">No skills yet. Add the first one above.</p>
      ) : (
        <>
        <p className="text-xs text-muted-foreground">Drag a skill to reorder them. The first ones are the ones recruiters see first.</p>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={skills} strategy={verticalListSortingStrategy}>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {skills.map((skill) => (
                <SkillChip key={skill} skill={skill} onRemove={removeSkill} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
        </>
      )}
    </section>
  );
};

export default SkillsSection;
