// src/app/home/page.tsx
"use client";

// The dashboard: say what you want to do today (make a resume, look for a job, bring in an old resume), see how far you
// are, and work from there. Resumes come first; the job search is an option.
import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Briefcase, Check, ChevronDown, Download, FileText, Linkedin, Pen, Pencil, Plus, Send, Sparkles, Trash2, UploadCloud, User, Wand2 } from "lucide-react";
import { useAuth } from "@/context/authContext";
import { useToast } from "@/context/toastContext";
import { useDialog } from "@/context/dialogContext";
import { useProfile } from "@/context/profileContext";
import { authFetch } from "@/lib/authFetch";
import { getProfileProgress } from "@/lib/profileProgress";
import { aboveLevel } from "@/lib/jobLevel";
import { ago, fitOf } from "@/lib/jobFit";
import { seniorityOf } from "@/lib/reviewRubric";
import { previewFromProfile } from "@/lib/previewData";
import type { JobListing } from "@/lib/jobSearch";
import CompanyLogo from "@/components/companyLogo";
import JobDetail from "@/components/jobDetail";
import ApplicationKit, { type Application } from "@/components/applicationKit";
import LivePreview from "@/components/livePreview";
import FileUpload from "@/components/fileUpload";
import LinkedInImport from "@/components/linkedinImport";
import BiographyForm from "@/components/biographyForm";
import UploadedItems from "@/components/uploadedItems";
import ResumePreviewModal from "@/components/resumePreviewModal";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";

interface ResumeRow {
  id: string;
  filename: string;
  uploadDate: string;
  metadata: { template: string; createdAt: string };
}
interface AppRow {
  job: JobListing;
  status: "prepared" | "applied" | "interview" | "offer" | "rejected";
}

type Goal = "resumes" | "jobs" | "import";
const GOALS: { id: Goal; label: string; icon: typeof FileText }[] = [
  { id: "resumes", label: "Make a resume", icon: FileText },
  { id: "jobs", label: "Find a job", icon: Briefcase },
  { id: "import", label: "Import or write about you", icon: UploadCloud },
];

/** The content of a goal comes in from the side of the button chosen and the old one leaves the other way. */
const slide = {
  enter: (d: number) => ({ opacity: 0, x: d * 36 }),
  center: { opacity: 1, x: 0 },
  exit: (d: number) => ({ opacity: 0, x: d * -36 }),
};

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 19 ? "Good afternoon" : "Good evening";
}

/** Kaizo's own picture: a sheet being scanned, with a check. (The same sheet as the loading screen.) */
function Illustration() {
  return (
    <svg viewBox="0 0 220 200" className="h-full w-full" aria-hidden>
      <defs>
        <linearGradient id="paper" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#eef2ff" />
        </linearGradient>
        <linearGradient id="check" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fbbf24" />
          <stop offset="1" stopColor="#f59e0b" />
        </linearGradient>
      </defs>
      <ellipse cx="110" cy="186" rx="78" ry="8" fill="currentColor" opacity="0.08" />
      <g transform="rotate(-6 100 100)">
        <rect x="46" y="22" width="112" height="146" rx="8" fill="url(#paper)" stroke="#c7d2fe" strokeWidth="2" />
        <circle cx="70" cy="48" r="10" fill="#93c5fd" />
        <rect x="88" y="42" width="52" height="7" rx="3.5" fill="#1e3a8a" />
        <rect x="88" y="54" width="34" height="5" rx="2.5" fill="#bfdbfe" />
        {[78, 90, 102, 120, 132, 144].map((y, i) => (
          <rect key={y} x="60" y={y} width={[78, 64, 70, 78, 56, 66][i]} height="5" rx="2.5" fill={i === 3 ? "#93c5fd" : "#e0e7ff"} />
        ))}
        <rect x="42" y="94" width="120" height="3" rx="1.5" fill="#3b82f6">
          <animate attributeName="y" values="30;158;30" dur="3.2s" repeatCount="indefinite" />
        </rect>
      </g>
      <g transform="translate(140 108)">
        <circle r="30" fill="url(#check)" />
        <path d="M-13 1 L-4 10 L14 -9" fill="none" stroke="#fff" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
      </g>
      <path d="M26 54 l3 8 8 3 -8 3 -3 8 -3 -8 -8 -3 8 -3z" fill="#fbbf24" />
      <path d="M190 40 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2z" fill="#60a5fa" />
    </svg>
  );
}

export default function HomePage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const dialog = useDialog();
  const { profiles, activeProfileId, activeProfile: profile, setActiveProfileId, createProfile, renameProfile, deleteProfile } = useProfile();

  const [resumes, setResumes] = useState<ResumeRow[] | null>(null);
  const [apps, setApps] = useState<AppRow[] | null>(null);
  const [saved, setSaved] = useState<JobListing[] | null>(null);
  const [picks, setPicks] = useState<{ job: JobListing; pct: number }[] | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [goal, setGoal] = useState<Goal>("resumes");
  const [detailJob, setDetailJob] = useState<JobListing | null>(null); // the page of one job
  const [kitJob, setKitJob] = useState<JobListing | null>(null); // its application
  const [dir, setDir] = useState(1); // which way the content slides: towards the side of the goal chosen
  const [way, setWay] = useState<"upload" | "linkedin" | "write">("upload"); // in the import section: a file, or write it yourself

  useEffect(() => {
    if (!loading && !user) router.push("/");
  }, [user, loading, router]);
  useEffect(() => {
    if (!activeProfileId) return;
    authFetch(`/api/resumes?profileId=${activeProfileId}`).then((r) => (r.ok ? r.json() : [])).then(setResumes).catch(() => setResumes([]));
    authFetch("/api/applications").then((r) => (r.ok ? r.json() : [])).then(setApps).catch(() => setApps([]));
    authFetch("/api/saved-jobs").then((r) => (r.ok ? r.json() : [])).then(setSaved).catch(() => setSaved([]));
  }, [activeProfileId]);

  // jobs that fit: the role from the profile, without roles far above the person's experience
  const role = profile.jobTitle?.trim() || "";
  const place = [profile.contactInfo?.city, profile.contactInfo?.state].filter(Boolean).join(", ");
  const country = profile.contactInfo?.countryCode || "US";
  const years = useMemo(() => seniorityOf(profile).years, [profile]);
  const skills = useMemo(() => profile.skills ?? [], [profile.skills]);
  useEffect(() => {
    if (!role) {
      setPicks([]);
      return;
    }
    let alive = true;
    authFetch(`/api/jobs/search?${new URLSearchParams({ q: role, location: place, country })}`)
      .then((r) => (r.ok ? r.json() : { jobs: [] }))
      .then((d: { jobs?: JobListing[] }) => {
        if (!alive) return;
        setPicks(
          (d.jobs ?? [])
            .filter((j) => !aboveLevel(j, years))
            .map((job) => ({ job, pct: fitOf(job, skills, role).pct }))
            .sort((a, b) => b.pct - a.pct)
            .slice(0, 6)
        );
      })
      .catch(() => alive && setPicks([]));
    return () => {
      alive = false;
    };
  }, [role, place, country, years, skills]);

  const previewData = useMemo(() => previewFromProfile(profile), [profile]);

  if (loading || profiles.length === 0) {
    return (
      <div className="mx-auto max-w-[1180px] animate-pulse space-y-8">
        <div className="mx-auto h-20 w-72 rounded-md bg-muted" />
        <div className="grid gap-6 md:grid-cols-[22rem_1fr]">
          <div className="h-72 rounded-2xl bg-muted" />
          <div className="h-72 rounded-3xl bg-muted" />
        </div>
      </div>
    );
  }

  const progress = getProfileProgress(profile);
  const firstName = (user?.displayName || user?.email?.split("@")[0] || "").split(/[\s._-]/)[0];
  const activeName = profiles.find((p) => p.id === activeProfileId)?.name ?? profile.name;
  const empty = progress.doneCount === 0;
  const recent = (resumes ?? []).slice().sort((a, b) => +new Date(b.uploadDate || b.metadata?.createdAt) - +new Date(a.uploadDate || a.metadata?.createdAt)).slice(0, 6);

  const onCreate = async () => {
    await createProfile();
    toast.success("New profile created. Switch between profiles from this menu.");
  };
  const onRename = async () => {
    const newName = await dialog.prompt({ title: "Rename profile", description: "Pick a name that helps you tell your profiles apart, like “Marketing jobs”.", label: "Profile name", defaultValue: activeName, confirmText: "Save name" });
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
    const ok = await dialog.confirm({ title: `Delete “${activeName}”?`, description: "Everything in this profile will be removed for good. Your other profiles are not affected.", confirmText: "Delete profile", tone: "danger" });
    if (!ok) return;
    await deleteProfile(activeProfileId);
    toast.success("Profile deleted.");
  };

  // the message of the big panel and its next step
  const nResumes = resumes?.length ?? 0;
  // null while the resumes load, so the panel does not show one message and then swap it for another
  const panel: { tone: string; title: string; text: string; cta: string; href: string; goal?: Goal } | null = empty
    ? { tone: "from-amber-100 to-orange-50 dark:from-amber-950/40 dark:to-orange-950/20", title: "Let's start your profile", text: "Bring in an old resume or fill it in yourself. Everything you add goes into every resume you make.", cta: "Import a resume", href: "", goal: "import" }
    : progress.next
    ? { tone: "from-sky-100 to-indigo-50 dark:from-sky-950/40 dark:to-indigo-950/20", title: `${progress.percent}% of your profile is done`, text: `${progress.next.hint}. It makes every resume better.`, cta: `Add ${progress.next.label.toLowerCase()}`, href: `/home/profile#${progress.next.key}` }
    : resumes === null
    ? null
    : nResumes === 0
    ? { tone: "from-emerald-100 to-teal-50 dark:from-emerald-950/40 dark:to-teal-950/20", title: "Profile complete!", text: "Nice work. Pick a look and your first resume is ready in a minute.", cta: "Make my first resume", href: "/home/resumes/new" }
    : { tone: "from-emerald-100 to-teal-50 dark:from-emerald-950/40 dark:to-teal-950/20", title: "Resume ready!", text: "Your profile is complete. Try a new look, or tailor a resume to a job you like.", cta: "Make another resume", href: "/home/resumes/new" };

  const progressRows = [
    { icon: User, label: "Profile", value: `${progress.percent}%`, pct: progress.percent, href: "/home/profile" },
    { icon: FileText, label: "Resumes", value: String(nResumes), pct: Math.min(100, nResumes * 34), href: "/home/resumes" },
    { icon: Briefcase, label: "Saved jobs", value: String(saved?.length ?? 0), pct: Math.min(100, (saved?.length ?? 0) * 20), href: "/home/job-ads" },
    { icon: Send, label: "Applications", value: String(apps?.length ?? 0), pct: Math.min(100, (apps?.length ?? 0) * 20), href: "/home/job-ads" },
  ];

  return (
    <div className="mx-auto max-w-[1180px] pb-10 pt-4 sm:pt-10">
      {/* ---------- hello and the goal of the day ---------- */}
      <motion.header initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="relative text-center">
        <div className="absolute right-0 top-0">
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <button className="inline-flex items-center gap-2 rounded-full border bg-card px-3.5 py-1.5 text-sm font-medium transition-colors hover:border-blue-500/50">
                <User className="h-4 w-4 text-blue-600" />
                <span className="max-w-[9rem] truncate">{activeName}</span>
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </button>
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
        </div>
        <h1 className="text-4xl font-black tracking-tight sm:text-5xl">
          {greeting()},{" "}
          <span className="relative inline-block">
            {firstName || "there"}
            <svg viewBox="0 0 300 14" preserveAspectRatio="none" className="absolute -bottom-1.5 left-0 h-2.5 w-full text-amber-400" aria-hidden>
              <path d="M2 9 C 60 2, 120 13, 180 6 S 270 4, 298 8" fill="none" stroke="currentColor" strokeWidth="4.5" strokeLinecap="round" />
            </svg>
          </span>
        </h1>
        <p className="mt-3 text-lg text-muted-foreground">What do you want to do today?</p>

        {/* the goal: three paths, the first one is the main one */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-y-2">
          {GOALS.map((g, i) => (
            <React.Fragment key={g.id}>
              <button
                onClick={() => {
                  setDir(GOALS.findIndex((x) => x.id === g.id) >= GOALS.findIndex((x) => x.id === goal) ? 1 : -1);
                  setGoal(g.id);
                }}
                aria-pressed={goal === g.id}
                className={`relative inline-flex items-center gap-2 rounded-full border px-5 py-2.5 text-[15px] font-semibold transition-colors duration-300 ${
                  goal === g.id ? "border-transparent text-blue-500" : "bg-card text-muted-foreground hover:border-blue-500/40 hover:text-foreground"
                }`}
              >
                {/* one highlight that slides from button to button */}
                {goal === g.id && <motion.span layoutId="goal-pill" className="absolute inset-0 -z-0 rounded-full border border-blue-500 bg-blue-600/10 shadow-sm" transition={{ type: "spring", stiffness: 420, damping: 34 }} />}
                <span className="relative z-10 inline-flex items-center gap-2">
                  <g.icon className="h-4 w-4" /> {g.label}
                </span>
              </button>
              {i < GOALS.length - 1 && <span className="mx-2 hidden h-px w-7 border-t-2 border-dashed border-border sm:block" aria-hidden />}
            </React.Fragment>
          ))}
        </div>
      </motion.header>

      {/* ---------- progress and what comes next ---------- */}
      <div className="mt-9 grid items-stretch gap-5 md:grid-cols-[21rem_1fr]">
        <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="rounded-2xl border bg-card p-5 shadow-sm">
          <p className="mb-3 text-center text-[11px] font-bold uppercase tracking-[0.22em] text-muted-foreground">Your progress</p>
          <ul>
            {progressRows.map((r) => (
              <li key={r.label}>
                <Link href={r.href} className="group flex items-center gap-3.5 rounded-xl px-2 py-2.5 transition-colors hover:bg-accent/50">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600/10 text-blue-600">
                    <r.icon className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between">
                      <span className="text-[15px] font-medium">{r.label}</span>
                      <span className="text-sm font-bold tabular-nums">{r.value}</span>
                    </span>
                    <span className="mt-1.5 block h-1 overflow-hidden rounded-full bg-border">
                      <span className="block h-full rounded-full bg-blue-500 transition-[width] duration-700" style={{ width: `${r.pct}%` }} />
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </motion.section>

        {!panel ? (
          <div className="shimmer rounded-3xl bg-muted" aria-hidden />
        ) : (
        <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className={`relative flex items-center overflow-hidden rounded-3xl bg-gradient-to-br p-8 ${panel.tone}`}>
          <div className="relative z-10 max-w-sm">
            <h2 className="text-2xl font-extrabold leading-tight">{panel.title}</h2>
            <p className="mt-2 leading-relaxed text-foreground/70">{panel.text}</p>
            {panel.href ? (
              <Button asChild className="mt-6 h-12 w-full justify-between gap-6 rounded-xl bg-background px-5 text-base font-semibold text-foreground shadow-md hover:bg-background/90 sm:w-auto">
                <Link href={panel.href}>
                  {panel.cta} <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            ) : (
              <Button onClick={() => setGoal(panel.goal ?? "resumes")} className="mt-6 h-12 w-full justify-between gap-6 rounded-xl bg-background px-5 text-base font-semibold text-foreground shadow-md hover:bg-background/90 sm:w-auto">
                {panel.cta} <ArrowRight className="h-4 w-4" />
              </Button>
            )}
          </div>
          <div className="pointer-events-none absolute -right-2 bottom-0 hidden h-[88%] w-[46%] text-foreground sm:block">
            <Illustration />
          </div>
        </motion.section>
        )}
      </div>

      {/* ---------- what you chose ---------- */}
      <div className="mt-12">
        <AnimatePresence mode="popLayout" initial={false} custom={dir}>
          {goal === "resumes" && (
            <motion.section key="resumes" custom={dir} variants={slide} initial="enter" animate="center" exit="exit" transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}>
              <div className="mb-6 flex items-center justify-between gap-3">
                <h2 className="text-2xl font-extrabold">Your resumes</h2>
                <Button asChild className="h-10 gap-1.5 rounded-lg px-5 font-bold">
                  <Link href="/home/resumes/new">
                    <Plus className="h-4 w-4" /> Create new
                  </Link>
                </Button>
              </div>
              <div className="grid gap-x-10 gap-y-10 md:grid-cols-2">
                {resumes === null ? (
                  <div className="shimmer h-64 rounded-xl bg-muted" />
                ) : (
                  recent.map((r) => {
                    const tpl = r.metadata?.template === "modern" || r.metadata?.template === "creative" ? r.metadata.template : "classic";
                    return (
                      <article key={r.id} className="flex gap-6">
                        <button onClick={() => setPreviewId(r.id)} className="w-[10.5rem] shrink-0 self-start overflow-hidden rounded-md shadow-md ring-1 ring-black/10 transition-transform duration-300 hover:-translate-y-1 hover:shadow-xl" aria-label="Open this resume">
                          <LivePreview d={previewData} template={tpl} active={null} inline bare />
                        </button>
                        <div className="min-w-0 flex-1">
                          <h3 className="truncate text-xl font-bold">{r.filename.replace(/\.pdf$/i, "").replace(/_/g, " ")}</h3>
                          <p className="mt-1 text-sm capitalize text-muted-foreground">
                            {tpl} look · updated {ago(r.uploadDate || r.metadata?.createdAt).toLowerCase()}
                          </p>
                          <ul className="mt-5 space-y-2.5 text-[15px] font-medium">
                            <li>
                              <button onClick={() => setPreviewId(r.id)} className="inline-flex items-center gap-2.5 hover:text-blue-500">
                                <Download className="h-4 w-4 text-blue-500" /> Download
                              </button>
                            </li>
                            <li>
                              <Link href="/home/job-ads" className="inline-flex items-center gap-2.5 hover:text-blue-500">
                                <Wand2 className="h-4 w-4 text-blue-500" /> Tailor to a job
                              </Link>
                            </li>
                            <li>
                              <Link href="/home/profile" className="inline-flex items-center gap-2.5 hover:text-blue-500">
                                <Pencil className="h-4 w-4 text-blue-500" /> Edit my details
                              </Link>
                            </li>
                          </ul>
                        </div>
                      </article>
                    );
                  })
                )}

                {/* the empty slot: a new resume */}
                {resumes !== null && (
                  <Link href="/home/resumes/new" className="group flex gap-6">
                    <span className="flex aspect-[8.5/11] w-[10.5rem] shrink-0 items-center justify-center self-start rounded-md border border-dashed bg-card/40 transition-colors group-hover:border-blue-500 group-hover:bg-blue-600/5">
                      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-muted text-muted-foreground transition-all duration-300 group-hover:rotate-90 group-hover:bg-blue-600 group-hover:text-white">
                        <Plus className="h-7 w-7" />
                      </span>
                    </span>
                    <span className="min-w-0 flex-1 pt-1">
                      <span className="block text-xl font-bold text-muted-foreground transition-colors group-hover:text-foreground">New resume</span>
                      <span className="mt-1 block text-sm leading-relaxed text-muted-foreground">Make another one from your profile in a new look, or tailor it for a different job.</span>
                    </span>
                  </Link>
                )}
              </div>
            </motion.section>
          )}

          {goal === "jobs" && (
            <motion.section key="jobs" custom={dir} variants={slide} initial="enter" animate="center" exit="exit" transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}>
              <div className="mb-6 flex flex-wrap items-baseline justify-between gap-3">
                <h2 className="text-2xl font-extrabold">Your job matches</h2>
                <p className="text-sm text-muted-foreground">
                  Not right? Update your{" "}
                  <Link href="/home/profile#objective" className="font-semibold text-blue-500 hover:underline">
                    profile
                  </Link>
                </p>
              </div>
              {picks === null ? (
                <div className="grid gap-4 md:grid-cols-2" aria-busy>
                  {[0, 1, 2, 3].map((i) => (
                    <div key={i} className="shimmer h-28 rounded-xl bg-muted" />
                  ))}
                </div>
              ) : picks.length === 0 ? (
                <p className="rounded-xl border border-dashed px-5 py-10 text-center text-muted-foreground">
                  {role ? "No openings matched your role right now. The full search has more." : "Set the job you are after in your profile and the openings that fit you appear here."}{" "}
                  <Link href={role ? "/home/job-ads" : "/home/profile#objective"} className="font-semibold text-blue-500 hover:underline">
                    {role ? "Open job search" : "Set my target job"}
                  </Link>
                </p>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {picks.map(({ job, pct }) => (
                    <button key={job.key} type="button" onClick={() => setDetailJob(job)} className="group flex gap-4 rounded-xl border bg-card p-5 text-left transition-all hover:-translate-y-0.5 hover:shadow-md">
                      <CompanyLogo company={job.company} logo={job.logo} size={52} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-lg font-bold group-hover:text-blue-500">{job.title}</span>
                        <span className="block truncate text-foreground/80">
                          {job.company} · {job.remote ? "Remote" : job.location || "—"}
                        </span>
                        <span className="mt-2 flex items-center gap-3 text-sm text-muted-foreground">
                          {job.postedAt && <span>Posted {ago(job.postedAt).toLowerCase()}</span>}
                          <span className={`inline-flex items-center gap-1 font-bold ${pct >= 70 ? "text-green-500" : "text-amber-500"}`}>
                            <Sparkles className="h-3.5 w-3.5" /> {pct}% fit
                          </span>
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              )}
              <div className="mt-6 text-center">
                <Button asChild variant="outline" className="rounded-full px-6 font-semibold">
                  <Link href="/home/job-ads">
                    Open the full job search <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </motion.section>
          )}

          {goal === "import" && (
            <motion.section key="import" id="import" custom={dir} variants={slide} initial="enter" animate="center" exit="exit" transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }} className="mx-auto max-w-3xl">
              <h2 className="text-2xl font-extrabold">Tell Kaizo about you</h2>
              <p className="mb-5 mt-1 text-muted-foreground">Bring in an old resume, or just write about yourself. Either way your profile fills itself.</p>
              <div role="tablist" className="mb-6 inline-flex rounded-full border bg-card p-1 shadow-sm">
                {[
                  { id: "upload" as const, label: "Upload a file", icon: UploadCloud },
                  { id: "linkedin" as const, label: "From LinkedIn", icon: Linkedin },
                  { id: "write" as const, label: "Write about yourself", icon: Pen },
                ].map((t) => (
                  <button
                    key={t.id}
                    role="tab"
                    aria-selected={way === t.id}
                    onClick={() => setWay(t.id)}
                    className={`inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold transition-all ${way === t.id ? "bg-blue-600 text-white shadow-md shadow-blue-600/30" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    <t.icon className="h-4 w-4" /> {t.label}
                  </button>
                ))}
              </div>
              {way === "upload" ? (
                <>
                  <FileUpload />
                  <h3 className="mb-3 mt-10 text-lg font-extrabold">Files you imported</h3>
                  <UploadedItems />
                </>
              ) : way === "linkedin" ? (
                <LinkedInImport />
              ) : (
                <BiographyForm />
              )}
            </motion.section>
          )}
        </AnimatePresence>
      </div>

      <JobDetail
        job={detailJob}
        saved={detailJob ? (saved ?? []).some((j) => j.key === detailJob.key) : false}
        prepared={detailJob ? (apps ?? []).some((a) => a.job.key === detailJob.key) : false}
        onClose={() => setDetailJob(null)}
        onPrepare={(j) => {
          setDetailJob(null);
          setKitJob(j);
        }}
        onSavedChange={(j, isSaved) => setSaved((list) => (isSaved ? [j, ...(list ?? []).filter((x) => x.key !== j.key)] : (list ?? []).filter((x) => x.key !== j.key)))}
      />
      <ApplicationKit
        job={kitJob}
        profileId={activeProfileId}
        template={(() => {
          try {
            const t = localStorage.getItem("kaizo_template");
            return t === "modern" || t === "creative" ? t : "classic";
          } catch {
            return "classic";
          }
        })()}
        existing={kitJob ? ((apps ?? []).find((a) => a.job.key === kitJob.key) as unknown as Application | undefined) ?? null : null}
        onClose={() => setKitJob(null)}
        onChanged={(a) => setApps((list) => [a as unknown as AppRow, ...(list ?? []).filter((x) => x.job.key !== a.job.key)])}
      />

      <ResumePreviewModal isOpen={!!previewId} onClose={() => setPreviewId(null)} fileId={previewId} />
    </div>
  );
}
