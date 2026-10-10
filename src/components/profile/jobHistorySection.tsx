// src/components/profile/jobHistorySection.tsx
"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus } from "lucide-react";
import { useProfile, JobEntry } from "@/context/profileContext";
import EntryCard from "./entryCard";
import JobEntryForm from "./jobEntryForm";
import { useDialog } from "@/context/dialogContext";

const JobHistorySection: React.FC = () => {
  const { activeProfile, deleteJobEntry } = useProfile();
  const dialog = useDialog();
  const [editingJob, setEditingJob] = useState<JobEntry | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  // Whenever we switch to a different profile, close any open form
  useEffect(() => {
    setEditingJob(null);
    setShowAddForm(false);
  }, [activeProfile]);

  const handleEdit = (job: JobEntry) => {
    setEditingJob(job);
    setShowAddForm(true);
  };

  const handleDelete = async (id: string) => {
    const ok = await dialog.confirm({
      title: "Remove this job?",
      description: "It will disappear from your profile and from resumes you generate next.",
      confirmText: "Remove",
      tone: "danger",
    });
    if (ok) deleteJobEntry(id);
  };

  const handleCloseForm = () => {
    setEditingJob(null);
    setShowAddForm(false);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "";
    const d = new Date(dateString);
    return d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
    });
  };

  return (
    <motion.div className="space-y-6">
      {/* Header + Add Button */}
      <div className="flex items-center justify-end">
        <button
          onClick={() => {
            setEditingJob(null);
            setShowAddForm(true);
          }}
          className="flex items-center gap-2 rounded-full bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          <span>Add a job</span>
        </button>
      </div>

      {/* Add / Edit Form */}
      <AnimatePresence>
        {(showAddForm || editingJob) && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <JobEntryForm job={editingJob} onClose={handleCloseForm} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Job list: a timeline, newest first */}
      {activeProfile.jobHistory.length === 0 ? (
        <div className="rounded-2xl border border-dashed px-6 py-12 text-center">
          <p className="text-lg font-bold">Your work history starts here</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            Add the jobs you have had, starting with the most recent. No experience yet? You can skip this and use projects instead.
          </p>
          <button
            onClick={() => {
              setEditingJob(null);
              setShowAddForm(true);
            }}
            className="mt-5 inline-flex items-center gap-2 rounded-full bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" /> Add your first job
          </button>
        </div>
      ) : (
        <ul className="ml-1.5 border-l-2 border-border pt-1">
          {activeProfile.jobHistory.map((job, idx) => (
            <EntryCard
              key={job.id}
              index={idx}
              when={`${formatDate(job.startDate)} – ${job.current || !job.endDate ? "Present" : formatDate(job.endDate)}`}
              where={job.location}
              title={job.title || "Untitled role"}
              subtitle={job.company}
              note={job.description}
              bullets={job.accomplishments}
              onEdit={() => handleEdit(job)}
              onDelete={() => handleDelete(job.id)}
            />
          ))}
        </ul>
      )}

      <p className="rounded-xl bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
        <span className="font-semibold text-foreground">A tip:</span> put your most recent job first and, when you can, add a number to what you did (&ldquo;served 40 customers a day&rdquo;).
      </p>
    </motion.div>
  );
};

export default JobHistorySection;
