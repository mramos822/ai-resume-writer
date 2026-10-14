"use client";

// A resume for one job (see components/applyWorkspace): this page finds the job that was chosen and the profile, and gives the person a
// copy of the profile to edit for it. The saved profile never changes.
import React, { useEffect, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { Loader2 } from "lucide-react";
import ApplyWorkspace from "@/components/applyWorkspace";
import { ProfileDraftProvider, useProfile, type ProfileData } from "@/context/profileContext";
import { useAuth } from "@/context/authContext";
import { APPLY_JOB_KEY } from "@/lib/applyJob";
import type { JobListing } from "@/lib/jobSearch";
import { useT } from "@/i18n/provider";

export default function ApplyPage() {
  const { tr } = useT();
  const router = useRouter();
  const { user, loading } = useAuth();
  const { profiles, activeProfileId, activeProfile, hasUnsavedChanges, reloadProfile } = useProfile();
  const [job, setJob] = useState<JobListing | null | undefined>(undefined); // undefined: not read yet
  // The base of the resume is ALWAYS the profile as it is now: it is read again from the server before the copy is made (the one in
  // memory can be the short version from the list of profiles, or an old one). Edits not saved yet in the profile section are newer, so they stay.
  const [fresh, setFresh] = useState(false);
  useEffect(() => {
    if (!activeProfileId || profiles.length === 0 || fresh) return;
    if (hasUnsavedChanges) {
      setFresh(true);
      return;
    }
    let off = false;
    reloadProfile()
      .catch(() => {})
      .finally(() => !off && setFresh(true));
    return () => {
      off = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProfileId, profiles.length]);

  useEffect(() => {
    if (!loading && !user) router.replace("/");
  }, [loading, user, router]);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(APPLY_JOB_KEY);
      setJob(raw ? (JSON.parse(raw) as JobListing) : null);
    } catch {
      setJob(null);
    }
  }, []);

  // no job to work on (the page was opened by hand): back to the jobs
  useEffect(() => {
    if (job === null) router.replace("/home/job-ads");
  }, [job, router]);

  if (!job || !activeProfileId || profiles.length === 0 || !fresh) {
    return (
      <p className="flex items-center justify-center gap-2 py-24 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        {tr("Loading…")}
      </p>
    );
  }
  const { name: _name, ...data } = activeProfile; // eslint-disable-line @typescript-eslint/no-unused-vars
  return (
    <ProfileDraftProvider key={`${job.key}:${activeProfileId}`} initial={{ ...(data as ProfileData), name: activeProfile.name }}>
      <ApplyWorkspace job={job} profileId={activeProfileId} />
    </ProfileDraftProvider>
  );
}
