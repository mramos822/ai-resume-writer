// src/app/home/profile/page.tsx
"use client";

import React, { useCallback, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Save,
  RefreshCw,
  Check,
  Mail,
  Target,
  Wrench,
  Building2,
  GraduationCap,
  Sprout,
  FolderKanban,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

import { useProfile } from "@/context/profileContext";
import ContactInfoSection from "@/components/profile/contactInfoSection";
import CareerObjectiveSection from "@/components/profile/careerObjectiveSection";
import SkillsSection from "@/components/profile/skillsSection";
import JobHistorySection from "@/components/profile/jobHistorySection";
import EducationSection from "@/components/profile/educationSection";
import InternshipSection from "@/components/profile/internshipSection";
import ProjectsSection from "@/components/profile/projectsSection";
import PageHeader from "@/components/pageHeader";
import AdviceView from "@/components/adviceView";
import { getProfileProgress } from "@/lib/profileProgress";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/context/toastContext";
import { useDialog } from "@/context/dialogContext";
import { usePathname } from "next/navigation";
import { authFetch } from "@/lib/authFetch";

const VALID_SECTIONS = ["contact", "objective", "skills", "jobs", "education", "projects", "internships"] as const;
type SectionKey = (typeof VALID_SECTIONS)[number];

/** Each section gets its own color so people can find their place at a glance. */
const META: Record<
  SectionKey,
  { label: string; blurb: string; icon: LucideIcon; tile: string; ring: string }
> = {
  contact: {
    label: "Contact",
    blurb: "How employers can reach you.",
    icon: Mail,
    tile: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
    ring: "ring-blue-300",
  },
  objective: {
    label: "Objective",
    blurb: "Two lines about the role you want.",
    icon: Target,
    tile: "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
    ring: "ring-violet-300",
  },
  skills: {
    label: "Skills",
    blurb: "What you're good at. Add at least three.",
    icon: Wrench,
    tile: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
    ring: "ring-amber-300",
  },
  jobs: {
    label: "Jobs",
    blurb: "Where you've worked, newest first.",
    icon: Building2,
    tile: "bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300",
    ring: "ring-teal-300",
  },
  education: {
    label: "Education",
    blurb: "Schools, degrees and courses.",
    icon: GraduationCap,
    tile: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
    ring: "ring-rose-300",
  },
  projects: {
    label: "Projects",
    blurb: "Things you've built, for school or for fun.",
    icon: FolderKanban,
    tile: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
    ring: "ring-sky-300",
  },
  internships: {
    label: "Internships",
    blurb: "Formal internships at a company.",
    icon: Sprout,
    tile: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
    ring: "ring-emerald-300",
  },
};

/**
 * Reads location.hash and updates whenever:
 *  - the hash changes (in-page navigation)
 *  - the pathname changes to /home/profile (cross-page Link→hash)
 */
function useHash(): SectionKey {
  const pathname = usePathname();
  const getHash = (): SectionKey => {
    const h = window.location.hash.slice(1) as SectionKey;
    return VALID_SECTIONS.includes(h) ? h : "contact";
  };

  const [hash, setHash] = useState<SectionKey>(() => {
    if (typeof window !== "undefined") return getHash();
    return "contact";
  });

  React.useEffect(() => {
    const onHashChange = () => setHash(getHash());
    window.addEventListener("hashchange", onHashChange);
    if (pathname === "/home/profile") setHash(getHash());
    return () => window.removeEventListener("hashchange", onHashChange);
  }, [pathname]);

  return hash;
}

function ResumeAdviceSection() {
  const [advice, setAdvice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { activeProfile } = useProfile();

  const handleRequestAdvice = async () => {
    setLoading(true);
    setAdvice(null);
    setError(null);
    try {
      const res = await authFetch("/api/job-ads/advice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile: activeProfile }),
      });
      if (!res.ok) throw new Error("Failed to get advice");
      const data = await res.json();
      setAdvice(data.advice || data.text || "No advice returned.");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="mt-6 overflow-hidden border-blue-200">
      <CardContent className="p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
              <Sparkles className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-lg font-bold">Want a second opinion?</h2>
              <p className="text-sm text-muted-foreground">
                Kaizo reads your whole profile and tells you what could be stronger.
              </p>
            </div>
          </div>
          <Button onClick={handleRequestAdvice} disabled={loading} className="gap-2">
            {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {loading ? "Reading your profile…" : "Get advice"}
          </Button>
        </div>

        {loading && (
          <div className="mt-5 space-y-2">
            <div className="shimmer h-3 w-11/12 rounded bg-muted" />
            <div className="shimmer h-3 w-9/12 rounded bg-muted" />
            <div className="shimmer h-3 w-10/12 rounded bg-muted" />
          </div>
        )}
        {error && (
          <p className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            We couldn&apos;t get advice right now ({error}). Please try again in a moment.
          </p>
        )}
        {advice && !loading && (
          <AdviceView text={advice} />
        )}
      </CardContent>
    </Card>
  );
}

export default function ProfilePage() {
  const { hasUnsavedChanges, saveChanges, activeProfile, parseFile } = useProfile();
  const dialog = useDialog();
  const [isReParsing, setIsReParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  const activeTab = useHash();
  const progress = getProfileProgress(activeProfile);
  const doneMap: Record<string, boolean> = Object.fromEntries(progress.sections.map((s) => [s.key, s.done]));
  doneMap.internships = (activeProfile.internships?.length ?? 0) > 0;
  doneMap.projects = (activeProfile.projects?.length ?? 0) > 0;

  const onTabChange = useCallback((val: string) => {
    window.location.hash = val;
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveChanges();
      toast.success("Profile saved. Your next resume will use these details.");
    } catch {
      toast.error("We couldn't save your changes. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  };

  // Warn before closing the tab or reloading while there are unsaved edits
  React.useEffect(() => {
    if (!hasUnsavedChanges) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [hasUnsavedChanges]);

  /** Reads your most recent upload again and refreshes this profile with it. */
  const handleReParse = async () => {
    setIsReParsing(true);
    try {
      const res = await authFetch("/api/uploads");
      const files: { id: string; filename: string; createdAt: string }[] = res.ok ? await res.json() : [];
      const latest = [...files].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))[0];
      if (!latest) {
        toast.info("You haven't uploaded anything yet. Import a resume from the Dashboard first.");
        return;
      }
      const ok = await dialog.confirm({
        title: `Re-read “${latest.filename}”?`,
        description:
          "We'll read your most recent upload again and replace the details in this profile with what we find. Anything you edited by hand will be overwritten.",
        confirmText: "Re-read it",
        tone: "danger",
      });
      if (!ok) return;
      await parseFile(latest.id);
    } catch (err) {
      toast.error(`We couldn't re-read your file: ${(err as Error).message}`);
    } finally {
      setIsReParsing(false);
    }
  };

  const meta = META[activeTab];
  const ActiveIcon = meta.icon;

  return (
    <div className="mx-auto max-w-6xl pb-24">
      <PageHeader
        title="Your profile"
        subtitle="Everything a resume is built from. Fill it in once, reuse it for every job."
        tip="Pick a section on the left, edit it, then press Save."
        actions={
          <Button variant="outline" onClick={handleReParse} disabled={isReParsing} className="gap-2">
            <RefreshCw className={`h-4 w-4 ${isReParsing ? "animate-spin" : ""}`} />
            Re-read my latest upload
          </Button>
        }
      />

      {/* overall progress */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="mb-6 rounded-lg border bg-card p-4"
      >
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="font-semibold">
            {progress.percent === 100 ? "Profile complete. Nice work!" : `Profile ${progress.percent}% complete`}
          </span>
          {progress.next && <span className="text-muted-foreground">Next: {progress.next.hint.toLowerCase()}</span>}
        </div>
        <div className="h-2.5 overflow-hidden rounded-full bg-border">
          <div
            className="progress-fill h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-[width] duration-700"
            style={{ width: `${progress.percent}%` }}
          />
        </div>
      </motion.div>

      <div className="grid gap-6 lg:grid-cols-[16rem_1fr]">
        {/* Section list */}
        <nav aria-label="Profile sections" className="lg:sticky lg:top-24 lg:self-start">
          <ul className="flex gap-2 overflow-x-auto pb-2 lg:flex-col lg:overflow-visible lg:pb-0">
            {VALID_SECTIONS.map((key) => {
              const m = META[key];
              const Icon = m.icon;
              const active = key === activeTab;
              return (
                <li key={key} className="shrink-0 lg:shrink">
                  <button
                    onClick={() => onTabChange(key)}
                    aria-current={active ? "page" : undefined}
                    className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-all ${
                      active
                        ? `bg-card shadow-md ring-2 ${m.ring}`
                        : "border-transparent hover:border-border hover:bg-card"
                    }`}
                  >
                    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md ${m.tile}`}>
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold">{m.label}</span>
                      <span className="hidden truncate text-xs text-muted-foreground lg:block">{m.blurb}</span>
                    </span>
                    {doneMap[key] && (
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-green-500 text-white">
                        <Check className="h-3 w-3" strokeWidth={3} />
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Active section */}
        <div className="min-w-0">
          <Card>
            <CardContent className="p-6">
              <div className="mb-6 flex items-center gap-3 border-b pb-5">
                <span className={`flex h-12 w-12 items-center justify-center rounded-md ${meta.tile}`}>
                  <ActiveIcon className="h-6 w-6" />
                </span>
                <div>
                  <h2 className="text-xl font-bold">{meta.label}</h2>
                  <p className="text-sm text-muted-foreground">{meta.blurb}</p>
                </div>
              </div>

              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                >
                  {activeTab === "contact" && <ContactInfoSection />}
                  {activeTab === "objective" && <CareerObjectiveSection />}
                  {activeTab === "skills" && <SkillsSection />}
                  {activeTab === "jobs" && <JobHistorySection />}
                  {activeTab === "education" && <EducationSection />}
                  {activeTab === "projects" && <ProjectsSection />}
                  {activeTab === "internships" && <InternshipSection />}
                </motion.div>
              </AnimatePresence>
            </CardContent>
          </Card>

          <ResumeAdviceSection />
        </div>
      </div>

      {/* Save bar appears only when there is something to save */}
      <AnimatePresence>
        {hasUnsavedChanges && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            className="fixed inset-x-4 bottom-4 z-30 mx-auto flex max-w-xl items-center justify-between gap-4 rounded-lg border border-amber-300 bg-card p-3 pl-4 shadow-2xl sm:bottom-6"
          >
            <p className="text-sm font-medium">You have changes that aren&apos;t saved yet.</p>
            <Button onClick={handleSave} disabled={saving} className="gap-2">
              {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
