// src/components/profile/educationSection.tsx
"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus } from "lucide-react";
import { useProfile, EducationEntry, formatEducationDates } from "@/context/profileContext";
import EntryCard from "./entryCard";
import EducationEntryForm from "./educationEntryForm";
import { useDialog } from "@/context/dialogContext";

const EducationSection: React.FC = () => {
  const { activeProfile, deleteEducationEntry } = useProfile();
  const dialog = useDialog();
  const [editingEducation, setEditingEducation] = useState<EducationEntry | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  // Close any open form when switching profiles
  useEffect(() => {
    setEditingEducation(null);
    setShowAddForm(false);
  }, [activeProfile]);

  const handleEdit = (education: EducationEntry) => {
    setEditingEducation(education);
    setShowAddForm(true);
  };

  const handleDelete = async (id: string) => {
    const ok = await dialog.confirm({
      title: "Remove this education entry?",
      description: "It will disappear from your profile and from resumes you generate next.",
      confirmText: "Remove",
      tone: "danger",
    });
    if (ok) deleteEducationEntry(id);
  };

  const handleCloseForm = () => {
    setEditingEducation(null);
    setShowAddForm(false);
  };

  return (
    <motion.div className="space-y-6">
      {/* Header + Add Button */}
      <div className="flex items-center justify-end">
        <button
          onClick={() => {
            setEditingEducation(null);
            setShowAddForm(true);
          }}
          className="flex items-center gap-2 rounded-full bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          <span>Add Education</span>
        </button>
      </div>

      {/* Add / Edit Form */}
      <AnimatePresence>
        {(showAddForm || editingEducation) && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <EducationEntryForm
              education={editingEducation}
              onClose={handleCloseForm}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Education list: a timeline, newest first */}
      {activeProfile.education.length === 0 ? (
        <div className="rounded-2xl border border-dashed px-6 py-12 text-center">
          <p className="text-lg font-bold">Where did you study?</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            Add your school, degree or course. Even a course you are still taking counts.
          </p>
          <button
            onClick={() => {
              setEditingEducation(null);
              setShowAddForm(true);
            }}
            className="mt-5 inline-flex items-center gap-2 rounded-full bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" /> Add your school
          </button>
        </div>
      ) : (
        <ul className="ml-1.5 border-l-2 border-border pt-1">
          {activeProfile.education.map((education, index) => (
            <EntryCard
              key={education.id}
              index={index}
              when={formatEducationDates(education)}
              where={education.location}
              title={education.school}
              subtitle={education.degree}
              note={[education.gpa ? `GPA ${education.gpa}` : "", education.honors ?? ""].filter(Boolean).join("  ·  ") || undefined}
              onEdit={() => handleEdit(education)}
              onDelete={() => handleDelete(education.id)}
            />
          ))}
        </ul>
      )}
    </motion.div>
  );
};

export default EducationSection;
