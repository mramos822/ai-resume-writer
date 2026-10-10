// src/app/home/profile/page.tsx
"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Save,
  RefreshCw,
  Mail,
  Target,
  Wrench,
  Building2,
  GraduationCap,
  Sprout,
  FolderKanban,
  Globe,
  Languages,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

import { useProfile } from "@/context/profileContext";
import ContactInfoSection from "@/components/profile/contactInfoSection";
import CareerObjectiveSection from "@/components/profile/careerObjectiveSection";
import SkillsSection from "@/components/profile/skillsSection";
import JobHistorySection from "@/components/profile/jobHistorySection";
import EducationSection from "@/components/profile/educationSection";
import ExtrasEditor from "@/components/extrasEditor";
import SkillLevelPicker from "@/components/skillLevelPicker";
import PageHeader from "@/components/pageHeader";
import AdviceView from "@/components/adviceView";
import { getProfileProgress } from "@/lib/profileProgress";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/context/toastContext";
import { useDialog } from "@/context/dialogContext";
import { usePathname } from "next/navigation";
import { authFetch } from "@/lib/authFetch";

const VALID_SECTIONS = ["contact", "objective", "skills", "jobs", "education", "projects", "internships", "links", "languages"] as const;
type SectionKey = (typeof VALID_SECTIONS)[number];

/** Each section gets its own color so people can find their place at a glance. */
const META: Record<
  SectionKey,
  { label: string; blurb: string; icon: LucideIcon; tile: string; ring: string; title?: string }
> = {
  contact: {
    label: "Contact",
    blurb: "Your name and where to find you. It only goes on the resumes you make.",
    title: "How can employers reach you?",
    icon: Mail,
    tile: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
    ring: "ring-blue-300",
  },
  objective: {
    label: "Objective",
    blurb: "The job you want and a few lines about you. This is the first thing people read.",
    title: "Tell your story",
    icon: Target,
    tile: "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
    ring: "ring-violet-300",
  },
  skills: {
    label: "Skills",
    blurb: "Add what you do well. The first ones are the ones people see first.",
    title: "What are you good at?",
    icon: Wrench,
    tile: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
    ring: "ring-amber-300",
  },
  jobs: {
    label: "Jobs",
    blurb: "Your jobs, newest first. Short bullets with results work best.",
    title: "Where have you worked?",
    icon: Building2,
    tile: "bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300",
    ring: "ring-teal-300",
  },
  education: {
    label: "Education",
    blurb: "Schools, degrees and courses.",
    title: "Where did you study?",
    icon: GraduationCap,
    tile: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
    ring: "ring-rose-300",
  },
  projects: {
    label: "Projects",
    blurb: "Class, personal or open-source projects. Great when you have little work experience.",
    title: "What have you built?",
    icon: FolderKanban,
    tile: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
    ring: "ring-sky-300",
  },
  links: {
    label: "Links",
    blurb: "Your portfolio, LinkedIn, GitHub, and any certifications.",
    title: "Where can people see your work?",
    icon: Globe,
    tile: "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300",
    ring: "ring-indigo-300",
  },
  languages: {
    label: "Languages",
    blurb: "Add them with your level in each.",
    title: "Which languages do you speak?",
    icon: Languages,
    tile: "bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-950 dark:text-fuchsia-300",
    ring: "ring-fuchsia-300",
  },
  internships: {
    label: "Internships",
    blurb: "Formal internships, co-ops or traineeships.",
    title: "Any internships?",
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
  const { hasUnsavedChanges, saveChanges, activeProfile, parseFile, updateSkillLevels, updateLanguages } = useProfile();
  const dialog = useDialog();
  const [isReParsing, setIsReParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  const activeTab = useHash();
  const progress = getProfileProgress(activeProfile);
  const doneMap: Record<string, boolean> = Object.fromEntries(progress.sections.map((s) => [s.key, s.done]));
  doneMap.internships = (activeProfile.internships?.length ?? 0) > 0;
  doneMap.projects = (activeProfile.projects?.length ?? 0) > 0;
  doneMap.links = (activeProfile.links?.length ?? 0) + (activeProfile.certifications?.length ?? 0) > 0;
  doneMap.languages = (activeProfile.languages?.length ?? 0) > 0;


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
    <div className="mx-auto max-w-[1600px] pb-24">
      <PageHeader
        title="Your profile"
        subtitle="Tell us about yourself once and we will use it for every resume you make. Pick a section on the left."
        actions={
          // how complete the profile is: a plain figure with a thin line, no box around it
          <div className="min-w-[15rem] text-right">
            <p className="flex items-baseline justify-end gap-2 leading-none">
              <span className="text-5xl font-black tabular-nums tracking-tight">{progress.percent}</span>
              <span className="text-xl font-bold text-muted-foreground">%</span>
              <span className="ml-1 text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">{progress.percent === 100 ? "complete" : "done"}</span>
            </p>
            <div className="mt-3 flex gap-1" aria-hidden>
              {progress.sections.map((sec) => (
                <span key={sec.key} title={sec.label} className={`h-1.5 flex-1 rounded-full transition-colors duration-500 ${sec.done ? "bg-blue-600" : "bg-border"}`} />
              ))}
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              {progress.next ? <>Next: {progress.next.hint.toLowerCase()}</> : "Everything a resume needs is here."}
            </p>
            <button
              type="button"
              onClick={handleReParse}
              disabled={isReParsing}
              title="Reads the newest file you uploaded again and refreshes this profile with it (it replaces what you edited by hand)"
              className="mt-1.5 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline disabled:opacity-60"
            >
              <RefreshCw className={`h-3 w-3 ${isReParsing ? "animate-spin" : ""}`} />
              {isReParsing ? "Reading your upload…" : "Refresh from my latest upload"}
            </button>
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-1">

        {/* Active section */}
        <div className="w-full min-w-0">
          <Card className="rounded-2xl shadow-sm">
            <CardContent className="p-6 sm:p-8">
              {/* header and content change together as one piece: one short fade, no empty gap in between */}
              <motion.div key={activeTab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22, ease: "easeOut" }}>
              <div className="mb-7 flex items-center gap-4">
                <span className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${meta.tile}`}>
                  <ActiveIcon className="h-7 w-7" />
                </span>
                <div className="min-w-0">
                  <h2 className="text-2xl font-extrabold leading-tight">{meta.title ?? meta.label}</h2>
                  <p className="text-sm text-muted-foreground">{meta.blurb}</p>
                </div>
              </div>

                {activeTab === "contact" && <ContactInfoSection />}
                  {activeTab === "objective" && <CareerObjectiveSection />}
                  {activeTab === "skills" && (
                    <>
                      <SkillsSection />
                      <SkillLevelPicker skills={activeProfile.skills ?? []} levels={activeProfile.skillLevels ?? {}} onChange={updateSkillLevels} />
                    </>
                  )}
                  {activeTab === "jobs" && <JobHistorySection />}
                  {activeTab === "education" && <EducationSection />}
                  {activeTab === "projects" && <ExtrasEditor only={["projects"]} />}
                  {activeTab === "internships" && <ExtrasEditor only={["internships"]} />}
                  {activeTab === "links" && <ExtrasEditor only={["links", "certifications"]} />}
                  {activeTab === "languages" && <ExtrasEditor only={["languages"]} languages={activeProfile.languages ?? []} onLanguagesChange={updateLanguages} />}
              </motion.div>
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
