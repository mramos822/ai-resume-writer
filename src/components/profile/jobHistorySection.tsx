// src/components/profile/jobHistorySection.tsx
"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus } from "lucide-react";
import { useProfile, JobEntry } from "@/context/profileContext";
import EntryCard from "./entryCard";
import JobEntryForm from "./jobEntryForm";
import { useDialog } from "@/context/dialogContext";
import { formatPeriod, asResumeLang } from "@/lib/dateFormat";
import { companyLabel } from "@/lib/selfEmployed";
import { useT } from "@/i18n/provider";

const JobHistorySection: React.FC = () => {
  const { tr, locale } = useT();
  const { activeProfile, deleteJobEntry } = useProfile();
  const dialog = useDialog();
  const [editingJob, setEditingJob] = useState<JobEntry | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  // Whenever we switch to a different profile, close any open form
  useEffect(() => {
    setEditingJob(null);
    setShowAddForm(false);
  }, [activeProfile]);

  // a job is a fold: a tap opens its details to edit and a second tap closes it
  const handleEdit = (job: JobEntry) => {
    setShowAddForm(false);
    setEditingJob((cur) => (cur?.id === job.id ? null : job));
  };

  const handleDelete = async (id: string) => {
    const ok = await dialog.confirm({
      title: tr("Remove this job?"),
      description: tr("It will disappear from your profile and from resumes you generate next."),
      confirmText: tr("Remove"),
      tone: "danger",
    });
    if (ok) deleteJobEntry(id);
  };

  const handleCloseForm = () => {
    setEditingJob(null);
    setShowAddForm(false);
  };

  return (
    <motion.div className="space-y-4">
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
          <span>{tr("Add a job")}</span>
        </button>
      </div>

      {/* Add form (the edit form opens in the place of the job being edited) */}
      <AnimatePresence>
        {showAddForm && !editingJob && (
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
          <p className="text-lg font-bold">{tr("Your work history starts here")}</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{tr("Add the jobs you have had, starting with the most recent. No experience yet? You can skip this and use projects instead.")}</p>
          <button
            onClick={() => {
              setEditingJob(null);
              setShowAddForm(true);
            }}
            className="mt-5 inline-flex items-center gap-2 rounded-full bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />{" "}{tr("Add your first job")}</button>
        </div>
      ) : (
        <ul className="relative ml-2 space-y-3 border-l-2 border-border/70 pl-6">
          {activeProfile.jobHistory.map((job, idx) => (
            <EntryCard
              key={job.id}
              index={idx}
              when={formatPeriod({ startDate: job.startDate, endDate: job.endDate, current: job.current }, " – ", asResumeLang(locale))}
              where={job.location}
              title={job.title || tr("Untitled role")}
              subtitle={companyLabel(job, asResumeLang(locale))}
              current={Boolean(job.current) || !job.endDate}
              open={editingJob?.id === job.id}
              onToggle={() => handleEdit(job)}
              onDelete={() => handleDelete(job.id)}
            >
              <JobEntryForm job={job} onClose={handleCloseForm} embedded />
            </EntryCard>
          ))}
        </ul>
      )}

      <p className="rounded-xl bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
        <span className="font-semibold text-foreground">{tr("A tip:")}</span>{" "}{tr("put your most recent job first and, when you can, add a number to what you did (“served 40 customers a day”).")}</p>
    </motion.div>
  );
};

export default JobHistorySection;
