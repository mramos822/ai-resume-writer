// src/app/home/page.tsx
"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Check,
  ChevronDown,
  Circle,
  FileText as FileTextIcon,
  Wand2,
  User,
  Plus,
  Pencil,
  Trash2,
  PlayCircle,
  LifeBuoy,
  Lightbulb,
  PartyPopper,
  ArrowRight,
  UploadCloud,
  Pen,
  Rocket,
} from "lucide-react";
import { useAuth } from "@/context/authContext";
import { useToast } from "@/context/toastContext";
import { useDialog } from "@/context/dialogContext";
import { useProfile } from "@/context/profileContext";
import { getProfileProgress } from "@/lib/profileProgress";
import { openTour } from "@/components/guidedTour";
import FileUpload from "@/components/fileUpload";
import BiographyForm from "@/components/biographyForm";
import UploadedItems from "@/components/uploadedItems";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

/* ---------- helpers ---------- */

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 19) return "Good afternoon";
  return "Good evening";
}

/** Counts up to `value` so numbers feel alive when the page loads. */
function useCountUp(value: number, ms = 900) {
  const [n, setN] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / ms);
      setN(Math.round(value * (1 - Math.pow(1 - t, 3))));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, ms]);
  return n;
}

function ProgressRing({ percent }: { percent: number }) {
  const shown = useCountUp(percent);
  const r = 46;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative h-28 w-28 shrink-0">
      <svg viewBox="0 0 110 110" className="h-full w-full -rotate-90">
        <circle cx="55" cy="55" r={r} fill="none" strokeWidth="9" className="stroke-white/25" />
        <circle
          cx="55"
          cy="55"
          r={r}
          fill="none"
          strokeWidth="9"
          strokeLinecap="round"
          className="stroke-white"
          strokeDasharray={c}
          strokeDashoffset={c - (c * percent) / 100}
          style={{ transition: "stroke-dashoffset 1s cubic-bezier(0.22,1,0.36,1)" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
        <span className="text-2xl font-extrabold leading-none">{shown}%</span>
        <span className="mt-1 text-[10px] uppercase tracking-wide text-blue-100">ready</span>
      </div>
    </div>
  );
}

function Stat({ label, value, href }: { label: string; value: number; href: string }) {
  return (
    <Link
      href={href}
      className="rounded-md bg-white/15 px-3 py-1.5 text-sm text-white transition-colors hover:bg-white/25"
    >
      <strong className="mr-1 font-bold">{value}</strong>
      <span className="text-blue-100">{label}</span>
    </Link>
  );
}

/* ---------- page ---------- */

export default function HomePage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const dialog = useDialog();
  const {
    profiles,
    activeProfileId,
    activeProfile: profile,
    setActiveProfileId,
    createProfile,
    renameProfile,
    deleteProfile,
  } = useProfile();

  const [visitedGenerate, setVisitedGenerate] = useState(false);
  useEffect(() => {
    try {
      setVisitedGenerate(localStorage.getItem("kaizo_visited_generate") === "1");
    } catch {
      /* ignore */
    }
  }, []);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!loading && !user) router.push("/");
  }, [user, loading, router]);

  if (loading || profiles.length === 0) {
    return (
      <div className="mx-auto max-w-6xl animate-pulse space-y-6">
        <div className="h-10 w-72 rounded-md bg-muted" />
        <div className="h-52 rounded-lg bg-muted" />
        <div className="grid gap-4 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-20 rounded-lg bg-muted" />
          ))}
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="h-96 rounded-lg bg-muted lg:col-span-2" />
          <div className="h-96 rounded-lg bg-muted" />
        </div>
      </div>
    );
  }

  const progress = getProfileProgress(profile);
  const firstName = (user?.displayName || user?.email?.split("@")[0] || "").split(/[\s._-]/)[0];
  const activeName = profiles.find((p) => p.id === activeProfileId)?.name ?? profile.name;
  const isEmpty = progress.doneCount === 0;

  const onCreate = async () => {
    await createProfile();
    toast.success("New profile created. Switch between profiles from the menu at the top.");
  };

  const onRename = async () => {
    const newName = await dialog.prompt({
      title: "Rename profile",
      description: "Pick a name that helps you tell your profiles apart, like “Marketing jobs”.",
      label: "Profile name",
      defaultValue: activeName,
      confirmText: "Save name",
    });
    if (!newName || newName === activeName) return;
    try {
      await renameProfile(newName);
      toast.success(`Profile renamed to “${newName}”.`);
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const onDelete = async () => {
    if (profiles.length <= 1) {
      toast.info("You need at least one profile, so this one can't be deleted.");
      return;
    }
    const ok = await dialog.confirm({
      title: `Delete “${activeName}”?`,
      description:
        "Everything in this profile (details, uploads and saved job ads) will be removed for good. Your other profiles are not affected.",
      confirmText: "Delete profile",
      tone: "danger",
    });
    if (!ok) return;
    await deleteProfile(activeProfileId);
    toast.success("Profile deleted.");
  };

  const markGenerate = () => {
    try {
      localStorage.setItem("kaizo_visited_generate", "1");
    } catch {
      /* ignore */
    }
  };

  const goImport = () => document.getElementById("import")?.scrollIntoView({ behavior: "smooth", block: "start" });

  /* ---- the ONE thing to do next ---- */
  const nextAction = isEmpty
    ? {
        eyebrow: "Start here",
        title: "Bring in your resume",
        text: "Upload an old resume or write a short bio. We fill your profile for you, so you don't type it all again.",
        primary: { label: "Import my resume", onClick: goImport, icon: UploadCloud },
        secondary: { label: "I'll fill it in myself", href: "/home/profile" },
      }
    : progress.next
    ? {
        eyebrow: "Your next step",
        title: progress.next.hint,
        text: `${progress.doneCount} of ${progress.sections.length} profile sections done. Each one makes your resumes better.`,
        primary: { label: `Add ${progress.next.label.toLowerCase()}`, href: `/home/profile#${progress.next.key}`, icon: Pencil },
        secondary: { label: "Or generate a resume now", href: "/home/job-ads" },
      }
    : {
        eyebrow: "You're ready",
        title: "Make a resume for a real job",
        text: "Paste a job posting and Kaizo tailors your resume to it. It takes about a minute.",
        primary: { label: "Generate a resume", href: "/home/job-ads", icon: Wand2, onClick: markGenerate },
        secondary: { label: "See saved resumes", href: "/home/resumes" },
      };
  const PrimaryIcon = nextAction.primary.icon;

  /* checklist: profile steps + generating a first resume */
  const checklist: {
    id: string;
    title: string;
    done: boolean;
    hint: string;
    href: string;
    cta: string;
    onClick?: () => void;
  }[] = [
    ...progress.sections.map((s) => ({
      id: s.key,
      title: s.label,
      done: s.done,
      hint: s.done ? s.status : s.hint,
      href: `/home/profile#${s.key}`,
      cta: s.done ? "Edit" : "Add",
    })),
    {
      id: "resume",
      title: "Generate your first resume",
      done: visitedGenerate,
      hint: visitedGenerate ? "You've started. Nice!" : "Paste a job ad and let Kaizo tailor your resume",
      href: "/home/job-ads",
      cta: visitedGenerate ? "Open" : "Start",
      onClick: markGenerate,
    },
  ];
  const doneCount = checklist.filter((c) => c.done).length;
  const allDone = doneCount === checklist.length;
  const nextStep = checklist.find((c) => !c.done);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* ===== Greeting + profile switcher ===== */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-wrap items-center justify-between gap-3"
      >
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
          {greeting()}
          {firstName ? `, ${firstName}` : ""} 👋
        </h1>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="h-10 gap-2 bg-card">
              <User className="h-4 w-4 text-blue-600" />
              <span className="max-w-[10rem] truncate">{activeName}</span>
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuLabel>Your profiles</DropdownMenuLabel>
            {profiles.map((p) => (
              <DropdownMenuItem key={p.id} onClick={() => setActiveProfileId(p.id)} className="justify-between">
                <span className="truncate">{p.name}</span>
                {p.id === activeProfileId && <Check className="h-4 w-4 text-blue-600" />}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onCreate} className="gap-2">
              <Plus className="h-4 w-4" /> New profile
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onRename} className="gap-2">
              <Pencil className="h-4 w-4" /> Rename this profile
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onDelete} className="gap-2 text-red-600 focus:text-red-600">
              <Trash2 className="h-4 w-4" /> Delete this profile
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </motion.div>

      {/* ===== 1. What to do next (most important, always first) ===== */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="relative overflow-hidden rounded-lg bg-gradient-to-br from-blue-600 via-blue-600 to-indigo-600 p-6 text-white shadow-lg sm:p-8"
      >
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10 blur-2xl" />
        <div className="relative flex flex-col items-start gap-6 md:flex-row md:items-center md:justify-between">
          <div className="max-w-xl">
            <span className="mb-3 inline-flex items-center gap-1.5 rounded-md bg-white/15 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide">
              <Rocket className="h-3.5 w-3.5" /> {nextAction.eyebrow}
            </span>
            <h2 className="text-2xl font-extrabold leading-tight sm:text-3xl">{nextAction.title}</h2>
            <p className="mt-2 text-blue-100">{nextAction.text}</p>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              {"href" in nextAction.primary ? (
                <Link
                  href={nextAction.primary.href as string}
                  onClick={nextAction.primary.onClick}
                  className="inline-flex h-11 items-center gap-2 rounded-md bg-white px-5 text-sm font-bold text-blue-700 shadow transition-transform hover:-translate-y-0.5"
                >
                  <PrimaryIcon className="h-4 w-4" /> {nextAction.primary.label}
                </Link>
              ) : (
                <button
                  onClick={nextAction.primary.onClick}
                  className="inline-flex h-11 items-center gap-2 rounded-md bg-white px-5 text-sm font-bold text-blue-700 shadow transition-transform hover:-translate-y-0.5"
                >
                  <PrimaryIcon className="h-4 w-4" /> {nextAction.primary.label}
                </button>
              )}
              <Link
                href={nextAction.secondary.href}
                className="text-sm font-semibold text-white underline-offset-4 hover:underline"
              >
                {nextAction.secondary.label}
              </Link>
            </div>
          </div>

          <div className="flex w-full flex-col items-start gap-4 md:w-auto md:items-center">
            <ProgressRing percent={progress.percent} />
            <div className="flex flex-wrap gap-2 md:justify-center">
              <Stat label="skills" value={profile.skills.length} href="/home/profile#skills" />
              <Stat label="jobs" value={profile.jobHistory.length} href="/home/profile#jobs" />
              <Stat label="projects" value={profile.projects?.length ?? 0} href="/home/profile#projects" />
            </div>
          </div>
        </div>
      </motion.section>

      {/* ===== 2. Quick actions ===== */}
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { href: "/home/job-ads", icon: Wand2, title: "Generate a resume", sub: "Tailored to a job ad", onClick: markGenerate },
          { href: "/home/profile", icon: User, title: "Edit my profile", sub: "Contact, skills, jobs, projects" },
          { href: "/home/resumes", icon: FileTextIcon, title: "My resumes", sub: "Preview and download" },
        ].map(({ href, icon: Icon, title, sub, onClick }, i) => (
          <motion.div
            key={href}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + i * 0.05 }}
          >
            <Link
              href={href}
              onClick={onClick}
              className="group flex items-center gap-3 rounded-lg border bg-card p-4 transition-all hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-accent text-blue-600 transition-colors group-hover:bg-blue-600 group-hover:text-white">
                <Icon className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{title}</span>
                <span className="block truncate text-xs text-muted-foreground">{sub}</span>
              </span>
              <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </Link>
          </motion.div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* ===== Left: import + uploads ===== */}
        <div className="space-y-6 lg:col-span-2">
          <motion.div
            id="import"
            className="scroll-mt-24"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card>
              <CardHeader>
                <CardTitle>Import your professional history</CardTitle>
                <CardDescription>
                  Upload an old resume or write a short bio and we&apos;ll pull out the details for you.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="upload" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="upload" className="gap-2">
                      <UploadCloud className="h-4 w-4" /> Upload files
                    </TabsTrigger>
                    <TabsTrigger value="biography" className="gap-2">
                      <Pen className="h-4 w-4" /> Write a bio
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="upload" className="mt-6">
                    <FileUpload />
                  </TabsContent>
                  <TabsContent value="biography" className="mt-6">
                    <BiographyForm />
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
            <Card>
              <CardHeader>
                <CardTitle>Your uploads</CardTitle>
                <CardDescription>
                  Press <strong>Parse</strong> on a file to read it into your profile.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <UploadedItems />
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* ===== Right: checklist, help, tips ===== */}
        <div className="space-y-6">
          <motion.div initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}>
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    {allDone ? (
                      <PartyPopper className="h-5 w-5 text-amber-500" />
                    ) : (
                      <Wand2 className="h-5 w-5 text-blue-600" />
                    )}
                    {allDone ? "All set!" : "Getting started"}
                  </CardTitle>
                  <span className="text-sm font-bold text-blue-600">
                    {doneCount}/{checklist.length}
                  </span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-border">
                  <div
                    className="progress-fill h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-[width] duration-700"
                    style={{ width: `${(doneCount / checklist.length) * 100}%` }}
                  />
                </div>
              </CardHeader>
              <CardContent className="space-y-1.5">
                {checklist.map((c) => {
                  const isNext = nextStep?.id === c.id;
                  return (
                    <Link
                      key={c.id}
                      href={c.href}
                      onClick={c.onClick}
                      className={`flex items-center gap-3 rounded-md border p-2.5 transition-colors hover:bg-accent ${
                        isNext ? "border-blue-300 bg-accent/60" : "border-transparent"
                      }`}
                    >
                      {c.done ? (
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-green-500 text-white">
                          <Check className="h-3 w-3" strokeWidth={3} />
                        </span>
                      ) : (
                        <Circle className={`h-5 w-5 shrink-0 ${isNext ? "text-blue-600" : "text-border"}`} />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className={`text-sm font-semibold ${c.done ? "text-muted-foreground line-through" : ""}`}>
                          {c.title}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">{c.hint}</p>
                      </div>
                      <span className="shrink-0 text-xs font-semibold text-blue-600">{c.cta}</span>
                    </Link>
                  );
                })}
              </CardContent>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.25 }}>
            <Card className="border-blue-200 bg-accent/50">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <LifeBuoy className="h-5 w-5 text-blue-600" /> Need a hand?
                </CardTitle>
                <CardDescription>A one-minute tour shows you where everything is.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-2">
                <Button onClick={openTour} className="justify-start gap-2">
                  <PlayCircle className="h-4 w-4" /> Take the tour
                </Button>
                <Button variant="outline" asChild className="justify-start gap-2 bg-card">
                  <Link href="/home/help">
                    <LifeBuoy className="h-4 w-4" /> Help center and guides
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }}>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Lightbulb className="h-5 w-5 text-amber-500" /> Quick tips
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2.5 text-sm text-muted-foreground">
                  {[
                    "Upload more than one document for better results.",
                    "Fix anything the import got wrong in Profile.",
                    "Add numbers: “managed a team of 5” beats “managed a team”.",
                    "Use a different job ad for every application.",
                  ].map((t) => (
                    <li key={t} className="flex gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
                      {t}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
