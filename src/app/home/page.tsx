// src/app/home/page.tsx
"use client";

// The dashboard: say what you want to do today (make a resume, look for a job, bring in an old resume), see how far you
// are, and work from there. Resumes come first; the job search is an option.
import { realName } from "@/lib/previewData";
import { fromShouting } from "@/lib/nameCase";
import { asTemplateId } from "@/lib/templates";
import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "@/i18n/navigation";
import { useRouter } from "@/i18n/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Briefcase, Download, FileText, Heart, Linkedin, Pen, Pencil, Plus, Send, UploadCloud, User, Wand2 } from "lucide-react";
import { useAuth } from "@/context/authContext";
import { useToast } from "@/context/toastContext";
import { useDialog } from "@/context/dialogContext";
import { useProfile } from "@/context/profileContext";
import { authFetch } from "@/lib/authFetch";
import { jobSearchParams, withPhase } from "@/lib/jobSearchClient";
import { getProfileProgress } from "@/lib/profileProgress";
import type { Tr } from "@/i18n/translate";
import { aboveLevel } from "@/lib/jobLevel";
import { ago, skillsForFit } from "@/lib/jobFit";
import { jobScore, profileBasics } from "@/lib/jobScore";
import { yearsFor } from "@/lib/experienceLevel";
import type { JobListing } from "@/lib/jobSearch";
import CompanyLogo from "@/components/companyLogo";
import JobDetail from "@/components/jobDetail";
import ApplicationKit, { type Application } from "@/components/applicationKit";
import FileUpload from "@/components/fileUpload";
import LinkedInImport from "@/components/linkedinImport";
import BiographyForm from "@/components/biographyForm";
import UploadedItems from "@/components/uploadedItems";
import ResumePreviewModal from "@/components/resumePreviewModal";
import { Button } from "@/components/ui/button";
import ProfileSwitcher from "@/components/profileSwitcher";
import { useT } from "@/i18n/provider";

interface ResumeRow {
  id: string;
  filename: string;
  uploadDate: string;
  metadata: { template: string; createdAt: string; origin?: string };
}
interface AppRow {
  job: JobListing;
  status: "prepared" | "applied" | "interview" | "offer" | "rejected";
}

type Goal = "resumes" | "jobs" | "import";
const GOALS: { id: Goal; label: string; icon: typeof FileText }[] = [
  { id: "resumes", label: "Make a resume", icon: FileText },
  { id: "jobs", label: "Find a job", icon: Briefcase },
  { id: "import", label: "About you", icon: UploadCloud },
];

/** The content of a goal comes in from the side of the button chosen and the old one leaves the other way. */
const slide = {
  enter: (d: number) => ({ opacity: 0, x: d * 36 }),
  center: { opacity: 1, x: 0 },
  exit: (d: number) => ({ opacity: 0, x: d * -36 }),
};

function greeting(tr: Tr) {
  const h = new Date().getHours();
  return h < 12 ? tr("Good morning") : h < 19 ? tr("Good afternoon") : tr("Good evening");
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
  const { tr, locale } = useT();
  const { user, loading, unverified } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const dialog = useDialog();
  const { profiles, activeProfileId, activeProfile: profile, setActiveProfileId, createProfile, renameProfile, deleteProfile } = useProfile();

  const [resumes, setResumes] = useState<ResumeRow[] | null>(null);
  const [apps, setApps] = useState<AppRow[] | null>(null);
  const [saved, setSaved] = useState<JobListing[] | null>(null);
  const [picks, setPicks] = useState<{ job: JobListing; pct: number }[] | null>(null);
  const [savedAtLoad, setSavedAtLoad] = useState<Set<string> | null>(null); // the favorites that were already there when the page opened
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [goal, setGoal] = useState<Goal>("resumes");
  const [detailJob, setDetailJob] = useState<JobListing | null>(null); // the page of one job
  const [kitJob, setKitJob] = useState<JobListing | null>(null); // its application
  const [dir, setDir] = useState(1); // which way the content slides: towards the side of the goal chosen
  const [way, setWay] = useState<"upload" | "linkedin" | "write">("upload"); // in the import section: a file, or write it yourself

  useEffect(() => {
    if (!loading && !user) router.push(unverified ? "/login?view=login" : "/");
  }, [user, loading, unverified, router]);
  useEffect(() => {
    if (!activeProfileId) return;
    authFetch(`/api/resumes?profileId=${activeProfileId}`).then((r) => (r.ok ? r.json() : [])).then(setResumes).catch(() => setResumes([]));
    authFetch(`/api/applications?profileId=${activeProfileId}`).then((r) => (r.ok ? r.json() : [])).then(setApps).catch(() => setApps([]));
    authFetch("/api/saved-jobs")
      .then((r) => (r.ok ? r.json() : []))
      .then((list: JobListing[]) => {
        setSaved(list);
        setSavedAtLoad(new Set(list.map((j) => j.key)));
      })
      .catch(() => {
        setSaved([]);
        setSavedAtLoad(new Set());
      });
  }, [activeProfileId]);

  // jobs that fit: the role from the profile, without roles far above the person's experience
  const role = profile.jobTitle?.trim() || "";
  const place = [profile.contactInfo?.city, profile.contactInfo?.state].filter(Boolean).join(", ");
  const country = profile.contactInfo?.countryCode || "US";
  const years = useMemo(() => yearsFor(profile), [profile]);
  const asked = useRef(new Map<string, Promise<{ jobs?: JobListing[]; more?: boolean }>>()); // the job questions already asked in the background
  const skills = useMemo(() => skillsForFit(profile), [profile]);
  useEffect(() => {
    if (!role) {
      setPicks([]);
      return;
    }
    let alive = true;
    // The same question the job search page asks (see lib/jobSearchClient): our own jobs come at once and fill the matches; then Adzuna's part
    // is asked too, so the server remembers it and the job search page, when the person goes there, shows it without waiting.
    const params = jobSearchParams({ q: role, place, country, skills: profile.skills, lang: locale });
    // (the effect runs again while the profile finishes loading: the same question is asked once, and its answer is shared)
    const ask = (phase: "own" | "adzuna") => {
      const key = withPhase(params, phase).toString();
      let answer = asked.current.get(key);
      if (!answer) {
        answer = authFetch(`/api/jobs/search?${key}`)
          .then((r) => (r.ok ? r.json() : { jobs: [] }))
          .then((d: { jobs?: JobListing[]; more?: boolean }) => d);
        asked.current.set(key, answer);
        answer.catch(() => asked.current.delete(key));
      }
      return answer;
    };
    const best = (jobs: JobListing[]) =>
      jobs
        .filter((j) => !aboveLevel(j, years))
        .map((job) => ({ job, pct: jobScore(profile, job, [], "classic", [], profileBasics(profile)).score }))
        .sort((a, b) => b.pct - a.pct)
        .slice(0, 6);
    ask("own")
      .then(async (own) => {
        if (!alive) return;
        setPicks(best(own.jobs ?? []));
        if (own.more) {
          const more = await ask("adzuna").catch(() => ({ jobs: [] as JobListing[] }));
          const seen = new Set((own.jobs ?? []).flatMap((j) => [j.key, `${j.title}|${j.company}`.toLowerCase()]));
          const extra = (more.jobs ?? []).filter((j) => !seen.has(j.key) && !seen.has(`${j.title}|${j.company}`.toLowerCase()));
          if (alive && extra.length) setPicks(best([...(own.jobs ?? []), ...extra]));
        }
      })
      .catch(() => alive && setPicks([]));
    return () => {
      alive = false;
    };
  }, [role, place, country, years, skills]);

  // the heart on a job match: it goes to the favorites (the Saved tab of the job search) and leaves this list
  const savedKeys = useMemo(() => new Set((saved ?? []).map((j) => j.key)), [saved]);
  const favorite = async (job: JobListing) => {
    const isSaved = savedKeys.has(job.key);
    setSaved((list) => (isSaved ? (list ?? []).filter((x) => x.key !== job.key) : [job, ...(list ?? []).filter((x) => x.key !== job.key)]));
    try {
      const res = isSaved
        ? await authFetch(`/api/saved-jobs?key=${encodeURIComponent(job.key)}`, { method: "DELETE" })
        : await authFetch("/api/saved-jobs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(job) });
      if (!res.ok) throw new Error();
    } catch {
      setSaved((list) => (isSaved ? [job, ...(list ?? [])] : (list ?? []).filter((x) => x.key !== job.key)));
      toast.error(tr("We couldn't update your saved jobs. Try again."));
    }
  };

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

  // jobs already applied to, or saved before this visit, are not suggested again (a heart pressed now just fills in)
  const matches = (picks ?? []).filter(({ job }) => {
    const st = (apps ?? []).find((a) => a.job.key === job.key)?.status;
    return (!st || st === "prepared") && !(savedAtLoad?.has(job.key));
  });
  const progress = getProfileProgress(profile, tr);
  // the name on the resume comes first (the account may be a Google name or a shared address); then the account
  const profileName = fromShouting(realName(profile.name).trim()); // a name saved in capitals is greeted as a name
  const firstName = (profileName || user?.displayName || user?.email?.split("@")[0] || "").split(/[\s._-]/)[0];
  const activeName = profiles.find((p) => p.id === activeProfileId)?.name ?? profile.name;
  const empty = progress.doneCount === 0;
  const recent = (resumes ?? []).slice().sort((a, b) => +new Date(b.uploadDate || b.metadata?.createdAt) - +new Date(a.uploadDate || a.metadata?.createdAt)).slice(0, 6);

  const onCreate = async (name: string) => {
    await createProfile(name);
    toast.success(tr("Profile “{name}” created.", { name }));
  };
  const onRename = async () => {
    const newName = await dialog.prompt({ title: tr("Rename profile"), description: tr("Pick a name that helps you tell your profiles apart, like “Marketing jobs”."), label: tr("Profile name"), defaultValue: activeName, confirmText: tr("Save name") });
    if (!newName || newName === activeName) return;
    try {
      await renameProfile(newName);
      toast.success(tr("Profile renamed to “{newName}”.", { newName }));
    } catch (err) {
      toast.error((err as Error).message);
    }
  };
  const onDelete = async () => {
    if (profiles.length <= 1) {
      toast.info(tr("You need at least one profile, so this one can't be deleted."));
      return;
    }
    const ok = await dialog.confirm({ title: tr("Delete “{activeName}”?", { activeName }), description: tr("Everything in this profile will be removed for good. Your other profiles are not affected."), confirmText: tr("Delete profile"), tone: "danger" });
    if (!ok) return;
    await deleteProfile(activeProfileId);
    toast.success(tr("Profile deleted."));
  };

  // the message of the big panel and its next step
  const nResumes = resumes?.length ?? 0;
  // null while the resumes load, so the panel does not show one message and then swap it for another
  const panel: { tone: string; title: string; text: string; cta: string; href: string; goal?: Goal } | null = empty
    ? { tone: "from-amber-100 to-orange-50 dark:from-amber-950/40 dark:to-orange-950/20", title: tr("Let's start your profile"), text: tr("Bring in an old resume or fill it in yourself. Everything you add goes into every resume you make."), cta: tr("Import a resume"), href: "", goal: "import" }
    : progress.next
    ? { tone: "from-sky-100 to-indigo-50 dark:from-sky-950/40 dark:to-indigo-950/20", title: tr("{percent}% of your profile is done", { percent: progress.percent }), text: tr("{hint}. It makes every resume better.", { hint: progress.next.hint }), cta: tr("Add {label}", { label: progress.next.label.toLowerCase() }), href: `/home/profile#${progress.next.key}` }
    : resumes === null
    ? null
    : nResumes === 0
    ? { tone: "from-emerald-100 to-teal-50 dark:from-emerald-950/40 dark:to-teal-950/20", title: tr("Profile complete!"), text: tr("Nice work. Pick a look and your first resume is ready in a minute."), cta: tr("Make my first resume"), href: "/home/resumes/new" }
    : { tone: "from-emerald-100 to-teal-50 dark:from-emerald-950/40 dark:to-teal-950/20", title: tr("Resume ready!"), text: tr("Your profile is complete. Try a new look, or tailor a resume to a job you like."), cta: tr("Make another resume"), href: "/home/resumes/new" };

  // on a phone the "all done" message only repeats the resume list below, so it is hidden there; the ones that ask for a step stay
  const allDone = !empty && !progress.next && nResumes > 0;

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
        <div className="mb-4 flex items-center justify-between gap-2 sm:absolute sm:right-0 sm:top-0 sm:mb-0 sm:block">
          <div className="min-w-0 shrink">
          <ProfileSwitcher
            profiles={profiles}
            activeId={activeProfileId}
            activeName={activeName}
            onSelect={setActiveProfileId}
            onCreate={onCreate}
            onRename={onRename}
            onDelete={onDelete}
          />
          </div>
          {/* on a phone the numbers of "your progress" live here, next to the profile button, and the big card is not drawn */}
          <ul className="flex shrink-0 items-center gap-1 sm:hidden">
            {progressRows.map((r) => (
              <li key={r.label}>
                <Link href={r.href} aria-label={`${tr(r.label)}: ${r.value}`} title={tr(r.label)} className="inline-flex h-8 items-center gap-1 rounded-full bg-muted/60 px-2 text-xs font-bold tabular-nums transition-colors hover:bg-muted">
                  <r.icon className="h-3.5 w-3.5 text-blue-500" />
                  {r.value}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <h1 className="text-3xl font-black tracking-tight sm:text-5xl">
          {greeting(tr)},{" "}
          <span className="relative inline-block">
            {firstName || tr("there")}
            <svg viewBox="0 0 300 14" preserveAspectRatio="none" className="absolute -bottom-1.5 left-0 h-2.5 w-full text-amber-400" aria-hidden>
              <path d="M2 9 C 60 2, 120 13, 180 6 S 270 4, 298 8" fill="none" stroke="currentColor" strokeWidth="4.5" strokeLinecap="round" />
            </svg>
          </span>
        </h1>
        <p className="mt-2 text-base text-muted-foreground sm:mt-3 sm:text-lg">{tr("What do you want to do today?")}</p>

        {/* the goal: three paths, the first one is the main one */}
        <div className="mt-5 grid grid-cols-3 gap-2.5 sm:mt-6 sm:flex sm:flex-wrap sm:items-center sm:justify-center sm:gap-y-2">
          {GOALS.map((g, i) => (
            <React.Fragment key={g.id}>
              <button
                onClick={() => {
                  setDir(GOALS.findIndex((x) => x.id === g.id) >= GOALS.findIndex((x) => x.id === goal) ? 1 : -1);
                  setGoal(g.id);
                }}
                aria-pressed={goal === g.id}
                className={`relative inline-flex flex-col items-center justify-center gap-1.5 rounded-2xl border px-2 py-3 text-center text-[13px] font-semibold leading-tight transition-colors duration-300 sm:flex-row sm:gap-2 sm:rounded-full sm:px-5 sm:py-2.5 sm:text-[15px] ${
                  goal === g.id ? "border-transparent text-white" : "bg-card text-muted-foreground hover:border-blue-500/40 hover:text-foreground"
                }`}
              >
                {/* one highlight that slides from button to button */}
                {goal === g.id && <motion.span layoutId="goal-pill" className="absolute inset-0 -z-0 rounded-2xl bg-blue-600 shadow-lg shadow-blue-600/30 sm:rounded-full" transition={{ type: "spring", stiffness: 420, damping: 34 }} />}
                <span className={`relative z-10 flex h-9 w-9 items-center justify-center rounded-full transition-colors duration-300 sm:h-auto sm:w-auto sm:bg-transparent ${goal === g.id ? "bg-white/20" : "bg-blue-600/10 text-blue-500"}`}>
                  <g.icon className="h-[18px] w-[18px] sm:h-4 sm:w-4" />
                </span>
                <span className="relative z-10">{tr(g.label)}</span>
              </button>
              {i < GOALS.length - 1 && <span className="mx-2 hidden h-px w-7 border-t-2 border-dashed border-border sm:block" aria-hidden />}
            </React.Fragment>
          ))}
        </div>
      </motion.header>

      {/* ---------- progress and what comes next ---------- */}
      <div className={`mt-6 grid items-stretch gap-4 sm:mt-9 sm:gap-5 md:grid-cols-[21rem_1fr] ${allDone ? "max-sm:hidden" : ""}`}>
        <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="rounded-2xl border bg-card p-3 shadow-sm sm:p-5 max-sm:hidden">
          <p className="mb-2 hidden text-center text-[11px] font-bold uppercase tracking-[0.22em] text-muted-foreground md:block">{tr("Your progress")}</p>
          <ul className="grid grid-cols-4 gap-1 md:block">
            {progressRows.map((r) => (
              <li key={r.label}>
                <Link href={r.href} className="group flex flex-col items-center gap-1 rounded-xl px-1 py-1 text-center transition-colors hover:bg-accent/50 md:flex-row md:gap-3.5 md:px-2 md:py-2.5 md:text-left">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blue-600/10 text-blue-600 md:h-10 md:w-10">
                    <r.icon className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 md:flex-1">
                    <span className="flex flex-col-reverse items-center md:flex-row md:items-baseline md:justify-between">
                      <span className="truncate text-[11px] font-medium text-muted-foreground md:text-[15px] md:text-foreground">{tr(r.label)}</span>
                      <span className="text-base font-bold tabular-nums md:text-sm">{r.value}</span>
                    </span>
                    <span className="mt-1.5 hidden h-1 overflow-hidden rounded-full bg-border md:block">
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
        <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className={`relative flex items-center overflow-hidden rounded-3xl bg-gradient-to-br p-4 sm:p-8 ${allDone ? "max-md:hidden " : ""}${panel.tone}`}>
          <div className="relative z-10 w-full max-w-sm">
            <h2 className="text-lg font-extrabold leading-tight sm:text-2xl">{tr(panel.title)}</h2>
            <p className="mt-2 hidden leading-relaxed text-foreground/70 sm:block">{tr(panel.text)}</p>
            {panel.href ? (
              <Button asChild className="mt-3 h-11 w-full justify-between gap-6 sm:mt-6 sm:h-12 rounded-xl bg-background px-5 text-base font-semibold text-foreground shadow-md hover:bg-background/90 sm:w-auto">
                <Link href={panel.href}>
                  {panel.cta} <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            ) : (
              <Button onClick={() => setGoal(panel.goal ?? "resumes")} className="mt-3 h-11 w-full justify-between gap-6 sm:mt-6 sm:h-12 rounded-xl bg-background px-5 text-base font-semibold text-foreground shadow-md hover:bg-background/90 sm:w-auto">
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
      <div className="mt-8 sm:mt-12">
        <AnimatePresence mode="popLayout" initial={false} custom={dir}>
          {goal === "resumes" && (
            <motion.section key="resumes" custom={dir} variants={slide} initial="enter" animate="center" exit="exit" transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}>
              <div className="mb-6 flex items-center justify-between gap-3">
                <h2 className="text-xl font-extrabold sm:text-2xl">{tr("Your resumes")}</h2>
                <Button asChild className="h-10 gap-1.5 rounded-lg px-5 font-bold">
                  <Link href="/home/resumes/new">
                    <Plus className="h-4 w-4" />{" "}{tr("Create new")}</Link>
                </Button>
              </div>
              <div className="grid grid-cols-1 gap-x-10 gap-y-6 sm:gap-y-10 md:grid-cols-2">
                {resumes === null ? (
                  <div className="shimmer h-64 rounded-xl bg-muted" />
                ) : (
                  recent.map((r) => {
                    const tpl = asTemplateId(r.metadata?.template);
                    return (
                      <article key={r.id} className="flex gap-4 sm:gap-6">
                        <button onClick={() => setPreviewId(r.id)} className="w-28 shrink-0 self-start overflow-hidden rounded-md shadow-md sm:w-[10.5rem] ring-1 ring-black/10 transition-transform duration-300 hover:-translate-y-1 hover:shadow-xl" aria-label={tr("Open this resume")}>
                          {/* the sample sheet of the look: nothing to draw, so the dashboard opens at once (the real resume opens when you click it) */}
                          <img src={`/templates/${tpl}.png`} alt="" width={802} height={1135} loading="lazy" decoding="async" className="block h-auto w-full bg-white" />
                        </button>
                        <div className="min-w-0 flex-1">
                          <h3 className="truncate text-base font-bold sm:text-xl">{r.filename.replace(/\.pdf$/i, "").replace(/_/g, " ")}</h3>
                          <p className="mt-1 text-sm capitalize text-muted-foreground">
                            {tpl}{" "}{tr("look · updated")}{" "}{ago(r.uploadDate || r.metadata?.createdAt, tr).toLowerCase()}
                          </p>
                          <ul className="mt-3 flex flex-col gap-2.5 text-sm font-medium sm:mt-5 sm:text-[15px]">
                            <li>
                              <button onClick={() => setPreviewId(r.id)} className="inline-flex min-h-6 items-center gap-2.5 hover:text-blue-500">
                                <Download className="h-4 w-4 text-blue-500" />{" "}{tr("Download")}</button>
                            </li>
                            <li>
                              <Link href="/home/job-ads" className="inline-flex min-h-6 items-center gap-2.5 hover:text-blue-500">
                                <Wand2 className="h-4 w-4 text-blue-500" />{" "}{tr("Tailor to a job")}</Link>
                            </li>
                            <li>
                              {r.metadata?.origin === "created" || r.metadata?.origin === "builder" ? (
                                <Link href={`/home/resumes/new?edit=${encodeURIComponent(r.id)}&look=${encodeURIComponent(tpl)}`} className="inline-flex min-h-6 items-center gap-2.5 hover:text-blue-500">
                                  <Pencil className="h-4 w-4 text-blue-500" />{" "}{tr("Edit this resume")}</Link>
                              ) : (
                                <Link href="/home/profile" className="inline-flex min-h-6 items-center gap-2.5 hover:text-blue-500">
                                  <Pencil className="h-4 w-4 text-blue-500" />{" "}{tr("Edit my details")}</Link>
                              )}
                            </li>
                          </ul>
                        </div>
                      </article>
                    );
                  })
                )}

                {/* the empty slot: a new resume */}
                {resumes !== null && (
                  <Link href="/home/resumes/new" className="group flex gap-4 sm:gap-6">
                    <span className="flex aspect-[8.5/11] w-28 shrink-0 sm:w-[10.5rem] items-center justify-center self-start rounded-md border border-dashed bg-card/40 transition-colors group-hover:border-blue-500 group-hover:bg-blue-600/5">
                      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-muted text-muted-foreground transition-all duration-300 group-hover:rotate-90 group-hover:bg-blue-600 group-hover:text-white">
                        <Plus className="h-7 w-7" />
                      </span>
                    </span>
                    <span className="min-w-0 flex-1 pt-1">
                      <span className="block text-xl font-bold text-muted-foreground transition-colors group-hover:text-foreground">{tr("New resume")}</span>
                      <span className="mt-1 block text-sm leading-relaxed text-muted-foreground">{tr("Make another one from your profile in a new look, or tailor it for a different job.")}</span>
                    </span>
                  </Link>
                )}
              </div>
            </motion.section>
          )}

          {goal === "jobs" && (
            <motion.section key="jobs" custom={dir} variants={slide} initial="enter" animate="center" exit="exit" transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}>
              <div className="mb-6 flex flex-wrap items-baseline justify-between gap-3">
                <h2 className="text-2xl font-extrabold">{tr("Your job matches")}</h2>
                <p className="text-sm text-muted-foreground">{tr("Based on your target job.")}{" "}
                  <Link href="/home/profile#objective" className="font-semibold text-blue-500 hover:underline">{tr("Change it")}</Link>
                </p>
              </div>
              {picks === null ? (
                <div className="grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-2" aria-busy>
                  {[0, 1, 2, 3].map((i) => (
                    <div key={i} className="shimmer h-28 rounded-xl bg-muted" />
                  ))}
                </div>
              ) : picks.length === 0 ? (
                <p className="rounded-xl border border-dashed px-5 py-10 text-center text-muted-foreground">
                  {role ? tr("No openings matched your role right now. The full search has more.") : tr("Set the job you are after in your profile and the openings that fit you appear here.")}{" "}
                  <Link href={role ? "/home/job-ads" : "/home/profile#objective"} className="font-semibold text-blue-500 hover:underline">
                    {role ? tr("Open job search") : tr("Set my target job")}
                  </Link>
                </p>
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-2">
                  <>
                    {matches.map(({ job }) => (
                      <div key={job.key} className="relative">
                        <button type="button" onClick={() => setDetailJob(job)} className="group flex w-full items-start gap-3 rounded-2xl border bg-card p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-md sm:gap-4 sm:p-5">
                          <CompanyLogo company={job.company} logo={job.logo} size={46} />
                          <span className="min-w-0 flex-1">
                            <span className="line-clamp-2 pr-10 text-base font-bold leading-snug group-hover:text-blue-500 sm:text-lg">{tr(job.title)}</span>
                            <span className="mt-0.5 block truncate pr-10 text-sm text-foreground/80 sm:text-base">
                              {job.company} <span className="text-muted-foreground">· {job.remote ? tr("Remote") : job.location || "—"}</span>
                            </span>
                            {job.postedAt && <span className="mt-0.5 block pr-10 text-xs text-muted-foreground/80">{tr("Posted")}{" "}{ago(job.postedAt, tr).toLowerCase()}</span>}
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => favorite(job)}
                          aria-label={savedKeys.has(job.key) ? tr("Remove from favorites") : tr("Save to favorites")}
                          aria-pressed={savedKeys.has(job.key)}
                          title={savedKeys.has(job.key) ? tr("Remove from favorites") : tr("Save to favorites")}
                          className="absolute right-2 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition-all hover:scale-110 hover:text-rose-500 active:scale-95"
                        >
                          <Heart className={`h-6 w-6 transition-colors ${savedKeys.has(job.key) ? "fill-rose-500 text-rose-500" : ""}`} />
                        </button>
                      </div>
                    ))}
                  </>
                  {matches.length === 0 && (
                    <p className="rounded-xl border border-dashed px-5 py-8 text-center text-muted-foreground md:col-span-2">
                      {tr("You went through all of them. Your favorites are waiting, or open the full search for more.")}
                    </p>
                  )}
                </div>
              )}
              <div className="mt-6 flex flex-wrap items-center justify-center gap-3 text-center">
                {(saved?.length ?? 0) > 0 && (
                  <Button asChild variant="outline" className="rounded-full px-6 font-semibold">
                    <Link href="/home/job-ads?tab=saved"><Heart className="mr-2 h-4 w-4 text-rose-500" />{tr("My favorites")} ({saved?.length})</Link>
                  </Button>
                )}
                <Button asChild variant="outline" className="rounded-full px-6 font-semibold">
                  <Link href="/home/job-ads">{tr("Open the full job search")}{" "}<ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </motion.section>
          )}

          {goal === "import" && (
            <motion.section key="import" id="import" custom={dir} variants={slide} initial="enter" animate="center" exit="exit" transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }} className="mx-auto max-w-3xl">
              <h2 className="text-xl font-extrabold sm:text-2xl">{tr("Tell Kaizo about you")}</h2>
              <p className="mb-4 mt-1 text-sm text-muted-foreground sm:mb-5 sm:text-base">{tr("Bring in an old resume, or just write about yourself. Either way your profile fills itself.")}</p>
              <div role="tablist" className="mb-5 grid grid-cols-3 gap-2.5 sm:mb-6 sm:max-w-xl">
                {[
                  { id: "upload" as const, label: "Upload a file", icon: UploadCloud },
                  { id: "linkedin" as const, label: "LinkedIn", icon: Linkedin },
                  { id: "write" as const, label: "Write", icon: Pen },
                ].map((t) => (
                  <button
                    key={t.id}
                    role="tab"
                    aria-selected={way === t.id}
                    onClick={() => setWay(t.id)}
                    className={`flex flex-col items-center justify-center gap-1.5 rounded-2xl border px-2 py-3 text-center text-[13px] font-semibold leading-tight transition-colors sm:flex-row sm:gap-2 sm:px-4 sm:text-sm ${way === t.id ? "border-blue-500 bg-blue-600/10 text-blue-500" : "bg-card text-muted-foreground hover:border-blue-500/40 hover:text-foreground"}`}
                  >
                    <t.icon className="h-5 w-5 sm:h-4 sm:w-4" /> {tr(t.label)}
                  </button>
                ))}
              </div>
              {way === "upload" ? (
                <>
                  <FileUpload />
                  <div className="mt-8 sm:mt-10">
                    <UploadedItems />
                  </div>
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
            return asTemplateId(t);
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
