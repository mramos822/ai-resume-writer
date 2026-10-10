"use client";

// Job search: find real openings, see how well they fit your profile and save the ones you like.
// Resumes are made in the Resumes section, not here.
import AddJobLink from "@/components/addJobLink";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Bookmark, BookmarkCheck, Briefcase, Check, Globe2, Link2, Loader2, MapPin, Search, Wallet, Wand2 } from "lucide-react";
import { useProfile } from "@/context/profileContext";
import { useToast } from "@/context/toastContext";
import { authFetch } from "@/lib/authFetch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import PageHeader from "@/components/pageHeader";
import CompanyLogo from "@/components/companyLogo";
import ApplicationKit, { type Application } from "@/components/applicationKit";
import JobDetail from "@/components/jobDetail";
import type { JobListing } from "@/lib/jobSearch";
import { aboveLevel, levelOf } from "@/lib/jobLevel";
import { ago, fitOf } from "@/lib/jobFit";
import { seniorityOf } from "@/lib/reviewRubric";

type Saved = JobListing & { savedAt?: string };
const PAGE = 15;

const SOURCE_NAME: Record<JobListing["source"], string> = { remotive: "Remotive", arbeitnow: "Arbeitnow", adzuna: "Adzuna", link: "a link you added" };

function Fit({ pct }: { pct: number }) {
  const color = pct >= 70 ? "#22c55e" : pct >= 40 ? "#3b82f6" : "#94a3b8";
  return (
    <div className="w-24 shrink-0 text-right" title="How many of your skills this job mentions">
      <p className="text-2xl font-black leading-none tabular-nums" style={{ color }}>
        {pct}
        <span className="text-xs font-bold text-muted-foreground">%</span>
      </p>
      <p className="mb-1.5 mt-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Fit with you</p>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

function JobCard({ job, fit, saved, onToggle, onPrepare, onOpen, status }: { job: Saved; fit: { pct: number; matched: string[] }; saved: boolean; onToggle: () => void; onPrepare: () => void; onOpen: () => void; status?: Application["status"] }) {
  return (
    <motion.li layout="position" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="rounded-xl border bg-card p-5 transition-shadow hover:shadow-md">
      <div className="flex items-start gap-4">
        <CompanyLogo company={job.company} logo={job.logo} />
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-bold leading-snug"><button type="button" onClick={onOpen} className="text-left hover:text-blue-500">{job.title}</button></h3>
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">{job.company}</span>
            {job.postedAt && <span> · {ago(job.postedAt)}</span>}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            {job.location && (
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" /> {job.location}
              </span>
            )}
            {levelOf(job).label && (
              <span className="inline-flex items-center gap-1.5 font-semibold text-foreground/80">
                <Briefcase className="h-3.5 w-3.5" /> {levelOf(job).label}
                {levelOf(job).years > 0 && <span className="font-normal text-muted-foreground">· {levelOf(job).years}+ yrs</span>}
              </span>
            )}
            {job.remote && (
              <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-600">
                <Globe2 className="h-3.5 w-3.5" /> Remote
              </span>
            )}
            {job.salary && (
              <span className="inline-flex items-center gap-1.5">
                <Wallet className="h-3.5 w-3.5" /> {job.salary}
              </span>
            )}
          </div>
          {job.snippet && <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-muted-foreground">{job.snippet}</p>}
          {fit.matched.length > 0 && (
            <p className="mt-3 text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">Matches your skills:</span> {fit.matched.join(", ")}
            </p>
          )}
        </div>
        <Fit pct={fit.pct} />
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
        <p className="text-xs text-muted-foreground">via {SOURCE_NAME[job.source]}</p>
        <div className="flex items-center gap-2">
          <Button type="button" variant={saved ? "default" : "outline"} size="sm" onClick={onToggle} className="gap-1.5">
            {saved ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
            {saved ? "Saved" : "Save"}
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={onOpen}>
            Details
          </Button>
          <Button type="button" size="sm" onClick={onPrepare} className="gap-1.5 bg-blue-600 font-bold hover:bg-blue-700">
            {status ? <Check className="h-4 w-4" strokeWidth={3} /> : <Wand2 className="h-4 w-4" />}
            {status ? (status === "prepared" ? "Open application" : `Application · ${status}`) : "Prepare application"}
          </Button>
        </div>
      </div>
    </motion.li>
  );
}

export default function JobSearchPage() {
  const { activeProfile: profile, activeProfileId } = useProfile();
  const toast = useToast();

  const defaultRole = profile.jobTitle?.trim() || "";
  const defaultPlace = [profile.contactInfo?.city, profile.contactInfo?.state].filter(Boolean).join(", ");
  const country = profile.contactInfo?.countryCode || "US";

  const [q, setQ] = useState("");
  const [where, setWhere] = useState("");
  const [remoteOnly, setRemoteOnly] = useState(false);
  const [tab, setTab] = useState<"results" | "saved" | "applications">("results");
  // applications: the tailored resume and letter prepared for a job, and where each one stands
  const [apps, setApps] = useState<Application[]>([]);
  const [kitJob, setKitJob] = useState<JobListing | null>(null);
  const [detailJob, setDetailJob] = useState<JobListing | null>(null); // the page of one job
  const [preparing, setPreparing] = useState<{ done: number; total: number } | null>(null);
  const template = (() => {
    try {
      const t = typeof window !== "undefined" ? localStorage.getItem("kaizo_template") : null;
      return t === "modern" || t === "creative" ? t : "classic";
    } catch {
      return "classic";
    }
  })();
  const [jobs, setJobs] = useState<JobListing[]>([]);
  const [sources, setSources] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState("");
  const [shown, setShown] = useState(PAGE);
  const [saved, setSaved] = useState<Saved[]>([]);
  const filled = useRef(false);
  const [adding, setAdding] = useState(false); // the "Add a job" window

  // start from what the profile says: the role they want and where they live
  useEffect(() => {
    if (filled.current || (!defaultRole && !defaultPlace)) return;
    filled.current = true;
    setQ(defaultRole);
    setWhere(defaultPlace);
  }, [defaultRole, defaultPlace]);

  const search = useCallback(
    async (query = q, place = where, remote = remoteOnly) => {
      setLoading(true);
      setError("");
      setTab("results");
      try {
        const params = new URLSearchParams({ q: query.trim(), location: place.trim(), country });
        if (remote) params.set("remote", "1");
        // a wider search: similar titles and the main skills of the profile, so there are more jobs that fit
        params.set("wide", "1");
        if (profile.skills?.length) params.set("skills", profile.skills.slice(0, 3).join(","));
        const res = await authFetch(`/api/jobs/search?${params}`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "We couldn't search for jobs right now.");
        setJobs(data.jobs ?? []);
        setSources(data.sources ?? []);
        setShown(PAGE);
        setSearched(true);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    },
    [q, where, remoteOnly, country, profile.skills]
  );

  // the first search runs by itself once the profile gave a role to look for
  const firstRun = useRef(false);
  useEffect(() => {
    if (firstRun.current || !filled.current) return;
    firstRun.current = true;
    search(defaultRole, defaultPlace, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultRole, defaultPlace]);

  useEffect(() => {
    authFetch("/api/saved-jobs")
      .then((r) => (r.ok ? r.json() : []))
      .then((list: Saved[]) => setSaved(list))
      .catch(() => {});
  }, []);

  useEffect(() => {
    authFetch("/api/applications")
      .then((r) => (r.ok ? r.json() : []))
      .then((list: Application[]) => setApps(list))
      .catch(() => {});
  }, []);
  const appByKey = useMemo(() => new Map(apps.map((a) => [a.job.key, a])), [apps]);
  const onAppChanged = (a: Application) => setApps((list) => [a, ...list.filter((x) => x.job.key !== a.job.key)]);

  // prepare every saved job that has no application yet, one after another
  const prepareAllSaved = async () => {
    const todo = saved.filter((j) => !appByKey.has(j.key));
    if (todo.length === 0 || !profile) return;
    setPreparing({ done: 0, total: todo.length });
    let failed = 0;
    for (let i = 0; i < todo.length; i++) {
      try {
        const res = await authFetch("/api/applications/prepare", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ profileId: activeProfileId, template, job: todo[i] }) });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error();
        onAppChanged({ job: todo[i], fileId: data.fileId, coverLetter: data.coverLetter ?? "", template, status: "prepared" });
      } catch {
        failed++;
      }
      setPreparing({ done: i + 1, total: todo.length });
    }
    setPreparing(null);
    if (failed) toast.error(`${failed} application${failed > 1 ? "s" : ""} could not be prepared. Open them one by one to try again.`);
    else toast.success("All your saved jobs have an application ready.");
    setTab("applications");
  };

  const savedKeys = useMemo(() => new Set(saved.map((j) => j.key)), [saved]);
  const toggleSave = async (job: JobListing) => {
    const isSaved = savedKeys.has(job.key);
    setSaved((list) => (isSaved ? list.filter((j) => j.key !== job.key) : [{ ...job, savedAt: new Date().toISOString() }, ...list]));
    try {
      const res = isSaved
        ? await authFetch(`/api/saved-jobs?key=${encodeURIComponent(job.key)}`, { method: "DELETE" })
        : await authFetch("/api/saved-jobs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(job) });
      if (!res.ok) throw new Error();
      if (!isSaved) toast.success("Job saved.");
    } catch {
      // undo the change on screen
      setSaved((list) => (isSaved ? [{ ...job }, ...list] : list.filter((j) => j.key !== job.key)));
      toast.error("We couldn't update your saved jobs. Try again.");
    }
  };

  const skills = useMemo(() => profile.skills ?? [], [profile.skills]);
  // how many years of work the profile shows, so jobs far above that are left out
  const myYears = useMemo(() => seniorityOf(profile).years, [profile]);
  const [showAbove, setShowAbove] = useState(false);
  const list = tab === "saved" ? saved : tab === "applications" ? apps.map((a) => a.job) : jobs;
  const hiddenAbove = useMemo(() => (tab === "results" ? list.filter((j) => aboveLevel(j, myYears)).length : 0), [list, myYears, tab]);
  const ranked = useMemo(() => {
    const visible = tab === "results" && !showAbove ? list.filter((j) => !aboveLevel(j, myYears)) : list;
    const withFit = visible.map((j) => ({ job: j, fit: fitOf(j, skills, q || defaultRole) }));
    // best fit first, newest among equals (the saved tab keeps the order they were saved in)
    return tab !== "results" ? withFit : withFit.sort((a, b) => b.fit.pct - a.fit.pct || +new Date(b.job.postedAt || 0) - +new Date(a.job.postedAt || 0));
  }, [list, skills, q, defaultRole, tab, myYears, showAbove]);

  return (
    <div className="mx-auto max-w-6xl pb-16">
      <PageHeader title="Find your next job" subtitle="Search real openings, see how well they fit you and save the ones you like. Your resumes are made in Resumes." />

      {/* search */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          search();
        }}
        className="mb-6 rounded-2xl border bg-card p-5 shadow-sm"
      >
        <div className="grid gap-3 md:grid-cols-[1.4fr_1fr_auto]">
          <div className="relative">
            <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Job title or skill, like “data analyst”" className="h-11 pl-10" aria-label="Job title or skill" />
          </div>
          <div className="relative">
            <MapPin className="absolute left-3.5 top-3.5 h-4 w-4 text-muted-foreground" />
            <Input value={where} onChange={(e) => setWhere(e.target.value)} placeholder="City or country" className="h-11 pl-10" aria-label="Location" disabled={remoteOnly} />
          </div>
          <Button type="submit" disabled={loading} className="h-11 gap-2 px-7 text-base font-bold">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Search
          </Button>
        </div>
        <label className="mt-3 inline-flex cursor-pointer items-center gap-2.5 text-sm font-medium">
          <input type="checkbox" checked={remoteOnly} onChange={(e) => setRemoteOnly(e.target.checked)} className="h-4 w-4 rounded" />
          Remote jobs only
        </label>
      </form>

      {/* tabs */}
      <div className="mb-5 flex items-center justify-between gap-3">
        <div role="tablist" className="inline-flex rounded-full border bg-card p-1 shadow-sm">
          {[
            { id: "results" as const, label: "Results", n: jobs.length },
            { id: "saved" as const, label: "Saved", n: saved.length },
            { id: "applications" as const, label: "Applications", n: apps.length },
          ].map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={`rounded-full px-5 py-2 text-sm font-semibold transition-all ${tab === t.id ? "bg-blue-600 text-white shadow-md shadow-blue-600/30" : "text-muted-foreground hover:text-foreground"}`}
            >
              {t.label} <span className="opacity-70">({t.n})</span>
            </button>
          ))}
        </div>
        {tab === "saved" && saved.some((j) => !appByKey.has(j.key)) && (
          <Button onClick={prepareAllSaved} disabled={!!preparing} className="gap-2 bg-blue-600 font-bold hover:bg-blue-700">
            {preparing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
            {preparing ? `Preparing ${preparing.done} of ${preparing.total}…` : `Prepare all saved (${saved.filter((j) => !appByKey.has(j.key)).length})`}
          </Button>
        )}
        <div className="flex items-center gap-3">
          {tab === "results" && sources.length > 0 && <p className="hidden text-xs text-muted-foreground lg:block">Sources: {sources.join(", ")}</p>}
          <Button type="button" variant="outline" onClick={() => setAdding(true)} className="gap-2 rounded-full font-semibold">
            <Link2 className="h-4 w-4" /> Add a job
          </Button>
        </div>
      </div>

      {tab === "results" && hiddenAbove > 0 && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3 text-sm">
          <p className="text-muted-foreground">
            {showAbove ? "Showing" : "Hiding"} <span className="font-semibold text-foreground">{hiddenAbove}</span> job{hiddenAbove > 1 ? "s" : ""} that ask for more experience than your {myYears > 0 ? `${myYears} year${myYears === 1 ? "" : "s"}` : "profile shows"}.
          </p>
          <button type="button" onClick={() => setShowAbove((v) => !v)} className="font-semibold text-blue-500 hover:underline">
            {showAbove ? "Hide them" : "Show them anyway"}
          </button>
        </div>
      )}

      {error && <p className="mb-4 rounded-xl border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-500">{error}</p>}

      {loading && tab === "results" ? (
        <ul className="space-y-3" aria-busy>
          {[0, 1, 2, 3].map((i) => (
            <li key={i} className="rounded-xl border bg-card p-5">
              <div className="flex gap-4">
                <div className="shimmer h-12 w-12 rounded-xl bg-muted" />
                <div className="flex-1 space-y-2.5">
                  <div className="shimmer h-4 w-2/5 rounded bg-muted" />
                  <div className="shimmer h-3 w-1/4 rounded bg-muted" />
                  <div className="shimmer h-3 w-4/5 rounded bg-muted" />
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : ranked.length === 0 ? (
        <div className="rounded-2xl border border-dashed py-16 text-center">
          <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <Briefcase className="h-6 w-6 text-muted-foreground" />
          </span>
          {tab !== "results" ? (
            <>
              <p className="font-semibold">{tab === "applications" ? "No applications yet" : "No saved jobs yet"}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {tab === "applications" ? "Press Prepare application on a job: Kaizo tailors your resume and writes the cover letter." : "Press Save on a job to keep it here."}
              </p>
            </>
          ) : (
            <>
              <p className="font-semibold">{searched ? "No jobs found for that search" : "Search to see openings"}</p>
              <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
                {searched ? "Try a shorter title, another city, or turn on remote jobs." : "Type a role and a place, or fill in your target job in your profile."}
              </p>
              {searched && (
                <p className="mx-auto mt-4 max-w-md text-sm text-muted-foreground">
                  Know the job already? <button type="button" onClick={() => setAdding(true)} className="font-semibold text-blue-500 underline">Paste its link or text</button> and add it yourself.
                </p>
              )}
              {!defaultRole && (
                <Button asChild variant="outline" className="mt-4">
                  <Link href="/home/profile#objective">Set your target job</Link>
                </Button>
              )}
            </>
          )}
        </div>
      ) : (
        <>
          <ul className="space-y-3">
            <AnimatePresence initial={false}>
              {ranked.slice(0, tab === "results" ? shown : ranked.length).map(({ job, fit }) => (
                <JobCard key={job.key} job={job} fit={fit} saved={savedKeys.has(job.key)} onToggle={() => toggleSave(job)} onPrepare={() => setKitJob(job)} onOpen={() => setDetailJob(job)} status={appByKey.get(job.key)?.status} />
              ))}
            </AnimatePresence>
          </ul>
          {tab === "results" && ranked.length > shown && (
            <div className="mt-6 flex justify-center">
              <Button variant="outline" onClick={() => setShown((n) => n + PAGE)} className="h-11 px-8">
                Show more ({ranked.length - shown} left)
              </Button>
            </div>
          )}
        </>
      )}

      <AddJobLink
        open={adding}
        onClose={() => setAdding(false)}
        onAdded={async (job) => {
          setAdding(false);
          // it joins the saved jobs (so it stays), and its page opens right away
          setSaved((list) => [{ ...job, savedAt: new Date().toISOString() }, ...list.filter((x) => x.key !== job.key)]);
          setTab("saved");
          setDetailJob(job);
          try {
            const res = await authFetch("/api/saved-jobs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(job) });
            if (!res.ok) throw new Error();
          } catch {
            toast.error("The job was added, but we couldn't save it for later.");
          }
        }}
      />

      <JobDetail
        job={detailJob}
        saved={detailJob ? savedKeys.has(detailJob.key) : false}
        prepared={detailJob ? appByKey.has(detailJob.key) : false}
        onClose={() => setDetailJob(null)}
        onPrepare={(j) => {
          setDetailJob(null);
          setKitJob(j);
        }}
        onSavedChange={(j, isSaved) => setSaved((list) => (isSaved ? [{ ...j, savedAt: new Date().toISOString() }, ...list.filter((x) => x.key !== j.key)] : list.filter((x) => x.key !== j.key)))}
      />

      <ApplicationKit
        job={kitJob}
        profileId={activeProfileId}
        template={template}
        existing={kitJob ? appByKey.get(kitJob.key) : null}
        onClose={() => setKitJob(null)}
        onChanged={onAppChanged}
      />
    </div>
  );
}
