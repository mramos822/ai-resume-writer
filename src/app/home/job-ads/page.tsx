"use client";

// Job search: find real openings, see how well they fit your profile and save the ones you like.
// Resumes are made in the Resumes section, not here.
import { asTemplateId } from "@/lib/templates";
import AddJobLink from "@/components/addJobLink";
import JobPlacePicker from "@/components/jobPlacePicker";
import { isRemotePlace } from "@/lib/remotePlace";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "@/i18n/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Bookmark, BookmarkCheck, Briefcase, Check, Globe2, Link2, Loader2, MapPin, Search, Trash2, Wallet, Wand2 } from "lucide-react";
import { useProfile } from "@/context/profileContext";
import { useToast } from "@/context/toastContext";
import { useDialog } from "@/context/dialogContext";
import { authFetch } from "@/lib/authFetch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import CompanyLogo from "@/components/companyLogo";
import ApplicationKit, { type Application } from "@/components/applicationKit";
import JobDetail from "@/components/jobDetail";
import type { JobListing } from "@/lib/jobSearch";
import { REACH_ORDER } from "@/lib/jobReach";
import { aboveLevel, levelOf } from "@/lib/jobLevel";
import { matchesFilters, NO_FILTERS, type JobFilters } from "@/lib/jobFilters";
import { byFreshnessThenFit } from "@/lib/jobRank";
import { JobFilterControls, JobFilterPanel } from "@/components/jobFilterBar";
import { jobSearchParams, withPhase } from "@/lib/jobSearchClient";
import { ago, fitOf, skillsForFit } from "@/lib/jobFit";
import { isPartialPosting, jobScore, profileBasics } from "@/lib/jobScore";
import type { JobFacts } from "@/lib/jobFacts";
import { yearsFor } from "@/lib/experienceLevel";
import { useT } from "@/i18n/provider";

type Saved = JobListing & { savedAt?: string };
const PAGE = 15;
/** where the search box, the place and the filters are kept (in the tab) so they survive a change of language */
const SEARCH_STATE_KEY = "kaizo_job_search_state";

const SOURCE_NAME: Record<JobListing["source"], string> = { remotive: "Remotive", arbeitnow: "Arbeitnow", adzuna: "Adzuna", careerjet: "Careerjet", jooble: "Jooble", greenhouse: "the company's careers page", lever: "the company's careers page", ashby: "the company's careers page", smartrecruiters: "the company's careers page", workable: "the company's careers page", recruitee: "the company's careers page", teamtailor: "the company's careers page", computrabajo: "Computrabajo", getonboard: "Get on Board", remoteok: "Remote OK", jobicy: "Jobicy", usajobs: "USAJOBS", link: "a link a person added" };

function Fit({ pct, estimate, partial }: { pct: number; estimate?: boolean; partial?: boolean }) {
  const { tr } = useT();
  const color = pct >= 70 ? "#22c55e" : pct >= 40 ? "#3b82f6" : "#94a3b8";
  return (
    <div className="w-24 shrink-0 text-right" title={estimate ? (partial ? tr("An estimate: the job board only shares the start of this posting. Open the job to see the exact number.") : tr("An estimate: the AI has not read this posting yet. Open the job to see the exact number.")) : tr("How many of your skills this job mentions")}>
      <p className="text-2xl font-black leading-none tabular-nums" style={{ color }}>
        {estimate ? "~" : ""}{pct}
        <span className="text-xs font-bold text-muted-foreground">%</span>
      </p>
      <p className="mb-1.5 mt-0.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">{tr("Fit with you")}</p>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

/** The jobs found later added to the ones on screen: a job that is already there (same link or same title and company) is not repeated. */
function addJobs(prev: JobListing[], more: JobListing[]): JobListing[] {
  const seen = new Set(prev.flatMap((j) => [j.key, `${j.title}|${j.company}`.toLowerCase()]));
  const fresh = more.filter((j) => !seen.has(j.key) && !seen.has(`${j.title}|${j.company}`.toLowerCase()));
  return fresh.length ? [...prev, ...fresh] : prev;
}

function JobCard({ job, fit, saved, onToggle, onPrepare, onOpen, onDelete, status }: { job: Saved; fit: { pct: number; matched: string[]; estimate?: boolean }; saved: boolean; onToggle: () => void; onPrepare: () => void; onOpen: () => void; onDelete?: () => void; status?: Application["status"] }) {
  const { tr } = useT();
  return (
    <motion.li layout="position" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="rounded-xl border bg-card p-5 transition-shadow hover:shadow-md">
      <div className="flex items-start gap-4">
        <CompanyLogo company={job.company} logo={job.logo} />
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-bold leading-snug"><button type="button" onClick={onOpen} className="text-left hover:text-blue-500">{tr(job.title)}</button></h2>
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">{job.company}</span>
            {job.postedAt && <span> · {ago(job.postedAt, tr)}</span>}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            {job.location && (
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" /> {job.location}
              </span>
            )}
            {levelOf(job).label && (
              <span className="inline-flex items-center gap-1.5 font-semibold text-foreground/80">
                <Briefcase className="h-3.5 w-3.5" /> {tr(levelOf(job).label)}
                {levelOf(job).years > 0 && <span className="font-normal text-muted-foreground">· {levelOf(job).years}{tr("+ yrs")}</span>}
              </span>
            )}
            {job.remote && (
              <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-600">
                <Globe2 className="h-3.5 w-3.5" />{" "}{tr("Remote")}</span>
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
              <span className="font-semibold text-foreground">{tr("Matches your skills:")}</span> {fit.matched.join(", ")}
            </p>
          )}
        </div>
        <Fit pct={fit.pct} estimate={fit.estimate} partial={isPartialPosting(job)} />
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
        <p className="text-xs text-muted-foreground">{tr("via")}{" "}{SOURCE_NAME[job.source]}</p>
        <div className="flex items-center gap-2">
          {onDelete && (
            <Button type="button" variant="ghost" size="sm" onClick={onDelete} className="gap-1.5 text-red-500 hover:bg-red-500/10 hover:text-red-600">
              <Trash2 className="h-4 w-4" />
              {tr("Delete")}
            </Button>
          )}
          <Button type="button" variant={saved ? "default" : "outline"} size="sm" onClick={onToggle} className="gap-1.5">
            {saved ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
            {saved ? tr("Saved") : tr("Save")}
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={onOpen}>{tr("Details")}</Button>
          <Button type="button" size="sm" onClick={onPrepare} className="gap-1.5 bg-blue-600 font-bold hover:bg-blue-700">
            {status ? <Check className="h-4 w-4" strokeWidth={3} /> : <Wand2 className="h-4 w-4" />}
            {status ? (status === "prepared" ? tr("Open application") : tr("Application · {status}", { status })) : tr("Prepare application")}
          </Button>
        </div>
      </div>
    </motion.li>
  );
}

export default function JobSearchPage() {
  const { tr, trd, locale } = useT();
  const { activeProfile: profile, activeProfileId } = useProfile();
  const toast = useToast();
  const dialog = useDialog();

  const defaultRole = profile.jobTitle?.trim() || "";
  // the first name, unless the profile still has the name it gets by default ("Profile 1")
  const firstName = /^Profile \d+$/.test(profile.name ?? "") ? "" : (profile.name ?? "").trim().split(/\s+/)[0];
  const defaultPlace = [profile.contactInfo?.city, profile.contactInfo?.state].filter(Boolean).join(", ");
  const homeCountry = profile.contactInfo?.countryCode || "US";
  const [pickedCountry, setPickedCountry] = useState<string | null>(null); // the country chosen in the filter; until then, the profile's
  const country = pickedCountry ?? homeCountry;

  const [q, setQ] = useState("");
  const [where, setWhere] = useState("");
  // "Remote" is a place of the search (chosen in the place box), not a separate check box
  const [tab, setTab] = useState<"results" | "saved" | "applications">("results");
  // the heart on the dashboard sends people straight to their favorites (?tab=saved); the first search must not undo that
  const openSaved = useRef(typeof window !== "undefined" && new URLSearchParams(window.location.search).get("tab") === "saved");
  useEffect(() => {
    if (openSaved.current) setTab("saved");
  }, []);
  // applications: the tailored resume and letter prepared for a job, and where each one stands
  const [apps, setApps] = useState<Application[]>([]);
  const [kitJob, setKitJob] = useState<JobListing | null>(null);
  const [detailJob, setDetailJob] = useState<JobListing | null>(null); // the page of one job
  // the number of a job once its whole posting was read in its page (the list showed an estimate until then); the order of the list does not move
  const [readScores, setReadScores] = useState<Record<string, number>>({});
  const onReadScore = useCallback((key: string, pct: number, facts?: JobFacts) => {
    setReadScores((r) => (r[key] === pct ? r : { ...r, [key]: pct }));
    if (facts) setReadFacts((f) => (f[key] ? f : { ...f, [key]: facts }));
  }, []);
  // what was read from a posting goes with the job into the application, so its screens show the same number as the page of the job
  const [readFacts, setReadFacts] = useState<Record<string, JobFacts>>({});
  const withRead = (j: JobListing): JobListing => (readFacts[j.key] && !j.facts ? { ...j, facts: readFacts[j.key] } : j);
  const [preparing, setPreparing] = useState<{ done: number; total: number } | null>(null);
  const template = (() => {
    try {
      const t = typeof window !== "undefined" ? localStorage.getItem("kaizo_template") : null;
      return asTemplateId(t);
    } catch {
      return "classic";
    }
  })();
  const [jobs, setJobs] = useState<JobListing[]>([]);
  const [sources, setSources] = useState<string[]>([]);
  const [bigCity, setBigCity] = useState(""); // the nearest big city, when the results also have its jobs
  const [loadingMore, setLoadingMore] = useState(false); // our own jobs are on screen and the other boards are still answering
  const searchId = useRef(0); // only the answers of the last search are used
  const [filters, setFilters] = useState<JobFilters>(NO_FILTERS); // what the person chose to see
  const [filtersOpen, setFiltersOpen] = useState(false); // the panel with the other choices
  const langMode = useRef<JobFilters["lang"]>("auto"); // read by the search: "all" asks for every language
  const [searchedPlace, setSearchedPlace] = useState(""); // the place the results are about, as the search understood it
  const [searchedRemote, setSearchedRemote] = useState(false); // the search was for remote work
  // the role the results were searched with: the list is ranked by it, not by what is being typed (typing must not rank every job again at each key)
  const [searchedQ, setSearchedQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState("");
  const [shown, setShown] = useState(PAGE);
  const [saved, setSaved] = useState<Saved[]>([]);
  const filled = useRef(false);
  const [adding, setAdding] = useState(false); // the "Add a job" window

  // What the person typed and chose survives changing the language of the app (the page opens again then) and coming back to the page in the
  // same tab: it is kept in the tab's storage and put back, and the search is run again so the results are there too.
  const [rerun, setRerun] = useState(false);
  const saveReady = useRef(false);
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(SEARCH_STATE_KEY);
      const s = raw ? (JSON.parse(raw) as Partial<{ q: string; where: string; filters: JobFilters; country: string | null; filtersOpen: boolean; searched: boolean }>) : null;
      if (s && (s.q || s.where || s.searched)) {
        filled.current = true; // what was kept wins over the defaults of the profile
        setQ(String(s.q ?? "").slice(0, 120));
        setWhere(String(s.where ?? "").slice(0, 120));
        if (s.filters && typeof s.filters === "object") {
          const f = { ...NO_FILTERS, ...s.filters };
          langMode.current = f.lang;
          setFilters(f);
        }
        if (typeof s.country === "string") setPickedCountry(s.country.slice(0, 2));
        setFiltersOpen(Boolean(s.filtersOpen));
        if (s.searched && !openSaved.current) setRerun(true);
      }
    } catch {
      /* storage unavailable: it starts from the profile */
    }
  }, []);
  useEffect(() => {
    if (rerun) {
      setRerun(false);
      void search();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rerun]);
  useEffect(() => {
    if (!saveReady.current) {
      saveReady.current = true; // the first pass still holds the initial values: it must not overwrite what was kept
      return;
    }
    try {
      sessionStorage.setItem(SEARCH_STATE_KEY, JSON.stringify({ q, where, filters, country: pickedCountry, filtersOpen, searched }));
    } catch {
      /* storage unavailable */
    }
  }, [q, where, filters, pickedCountry, filtersOpen, searched]);

  // start from what the profile says: the role they want and where they live
  useEffect(() => {
    if (filled.current || (!defaultRole && !defaultPlace)) return;
    filled.current = true;
    setQ(defaultRole);
    setWhere(defaultPlace);
  }, [defaultRole, defaultPlace]);

  const search = useCallback(
    async (query = q, place = where) => {
      const remote = isRemotePlace(place);
      const id = ++searchId.current;
      setLoading(true);
      setLoadingMore(false);
      setSearchedQ(query);
      setError("");
      if (openSaved.current) openSaved.current = false;
      else setTab("results");
      try {
        // (the dashboard asks the same thing when the person arrives, so the answer is often already there)
        const params = jobSearchParams({ q: query, place, country, remote, skills: profile.skills, lang: locale, allLanguages: langMode.current === "all" });
        // two parts: our own jobs (instant) are shown at once, and what the other boards find is added when it arrives
        const ask = async (phase: "own" | "live" | "adzuna") => {
          const res = await authFetch(`/api/jobs/search?${withPhase(params, phase)}`);
          const data = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(trd(data.error) || tr("We couldn't search for jobs right now."));
          return data as { jobs?: JobListing[]; sources?: string[]; bigCity?: string; place?: string | null; more?: boolean };
        };
        const own = await ask("own");
        if (id !== searchId.current) return;
        setJobs(own.jobs ?? []);
        setSources(own.sources ?? []);
        setBigCity(typeof own.bigCity === "string" ? own.bigCity : "");
        setSearchedRemote(remote);
        setSearchedPlace(remote ? tr("Remote") : typeof own.place === "string" && own.place ? own.place : place.trim());
        setShown(PAGE);
        setSearched(true);
        if (own.more) {
          // an empty list is not shown as "nothing found" while the other boards are still looking
          if ((own.jobs ?? []).length > 0) setLoading(false);
          setLoadingMore(true);
          // Remotive and Arbeitnow are in our own index; Adzuna (its postings have to be read: slower) is added when it arrives
          await Promise.all(
            (["adzuna"] as const).map(async (phase) => {
              try {
                const more = await ask(phase);
                if (id !== searchId.current) return;
                setJobs((prev) => addJobs(prev, more.jobs ?? []));
                setSources((prev) => Array.from(new Set([...prev, ...(more.sources ?? [])])));
                if (typeof more.bigCity === "string" && more.bigCity) setBigCity(more.bigCity);
              } catch {
                /* what is already on screen stays */
              }
            })
          );
          if (id === searchId.current) setLoadingMore(false);
        }
      } catch (err) {
        if (id === searchId.current) setError((err as Error).message);
      } finally {
        if (id === searchId.current) setLoading(false);
      }
    },
    [q, where, country, profile.skills, locale]
  );

  // the first search runs by itself once the profile gave a role to look for
  const firstRun = useRef(false);
  useEffect(() => {
    if (firstRun.current || !filled.current) return;
    firstRun.current = true;
    search(defaultRole, defaultPlace);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultRole, defaultPlace]);

  useEffect(() => {
    authFetch("/api/saved-jobs")
      .then((r) => (r.ok ? r.json() : []))
      .then((list: Saved[]) => setSaved(list))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!activeProfileId) return;
    authFetch(`/api/applications?profileId=${activeProfileId}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((list: Application[]) => setApps(list))
      .catch(() => {});
  }, [activeProfileId]);
  const appByKey = useMemo(() => new Map(apps.map((a) => [a.job.key, a])), [apps]);
  // coming back from the page where a resume was made: its application opens, with the resume and the letter
  useEffect(() => {
    const key = new URLSearchParams(window.location.search).get("apply");
    if (!key || apps.length === 0) return;
    const made = apps.find((a) => a.job.key === key);
    if (!made) return;
    setKitJob(made.job);
    setTab("applications");
    window.history.replaceState(null, "", window.location.pathname);
  }, [apps]);
  const onAppChanged = (a: Application) => setApps((list) => [a, ...list.filter((x) => x.job.key !== a.job.key)]);

  // delete an application (in progress or not): the job, its tailored resume and its cover letter go; the job stays findable in the search
  const deleteApplication = async (job: JobListing) => {
    const ok = await dialog.confirm({
      title: tr("Delete this application?"),
      description: tr("The tailored resume and the cover letter for “{title}” will be removed. You can prepare it again whenever you want.", { title: job.title }),
      confirmText: tr("Delete application"),
      tone: "danger",
    });
    if (!ok) return;
    try {
      const res = await authFetch(`/api/applications?key=${encodeURIComponent(job.key)}&profileId=${activeProfileId}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setApps((list) => list.filter((a) => a.job.key !== job.key));
      toast.success(tr("Application deleted."));
    } catch {
      toast.error(tr("We couldn't delete that application."));
    }
  };

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
    if (failed) toast.error(tr("{failed} application{v1} could not be prepared. Open them one by one to try again.", { failed, v1: failed > 1 ? "s" : "" }));
    else toast.success(tr("All your saved jobs have an application ready."));
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
      if (!isSaved) toast.success(tr("Job saved."));
    } catch {
      // undo the change on screen
      setSaved((list) => (isSaved ? [{ ...job }, ...list] : list.filter((j) => j.key !== job.key)));
      toast.error(tr("We couldn't update your saved jobs. Try again."));
    }
  };

  const skills = useMemo(() => skillsForFit(profile), [profile]);
  const basics = useMemo(() => profileBasics(profile), [profile]); // (how well the resume is written does not depend on the job)
  // how many years of work the profile shows, so jobs far above that are left out
  const myYears = useMemo(() => yearsFor(profile), [profile]);
  const [showAbove, setShowAbove] = useState(false);
  const [showSent, setShowSent] = useState(false);
  // a job that already has an application (prepared, sent, interview, offer or rejected) is not a new opportunity: it leaves the results
  // and stays in the Applications tab
  const isSent = (j: JobListing) => appByKey.has(j.key);
  const list = tab === "saved" ? saved : tab === "applications" ? apps.map((a) => a.job) : jobs;
  const hiddenAbove = useMemo(() => (tab === "results" ? list.filter((j) => !isSent(j) && aboveLevel(j, myYears)).length : 0), [list, myYears, tab, apps]); // eslint-disable-line react-hooks/exhaustive-deps
  const hiddenSent = useMemo(() => (tab === "results" ? list.filter(isSent).length : 0), [list, tab, apps]); // eslint-disable-line react-hooks/exhaustive-deps
  // the jobs the page shows before the filters: the ones already applied to and the ones far above the person's level are out unless asked for
  const pool = useMemo(() => (tab === "results" ? list.filter((j) => (showSent || !isSent(j)) && (showAbove || !aboveLevel(j, myYears))) : list), [list, tab, myYears, showAbove, showSent, apps]); // eslint-disable-line react-hooks/exhaustive-deps
  const ranked = useMemo(() => {
    const visible = tab === "results" ? pool.filter((j) => matchesFilters(j, filters)) : pool;
    // the percentage is the number of the job (see lib/jobScore); the skills it matches come from the quick reading of the posting
    const withFit = visible.map((j) => ({ job: j, fit: { ...fitOf(j, skills, defaultRole || searchedQ, myYears), pct: jobScore(profile, j, [], template, [], basics).score, estimate: isPartialPosting(j) || !j.facts } }));
    // best fit first, newest among equals (the saved tab keeps the order they were saved in)
    // (a search by place keeps its groups: in the place, near it, remote, the rest)
    const group = (j: JobListing) => (j.reach ? REACH_ORDER.indexOf(j.reach) : 0);
    // the person's order: the most recent first and, among the ones of the same age, the best fit; or the best fit first
    const now = Date.now();
    const order = (a: (typeof withFit)[number], b: (typeof withFit)[number]) =>
      filters.sort === "fit"
        ? b.fit.pct - a.fit.pct || +new Date(b.job.postedAt || 0) - +new Date(a.job.postedAt || 0)
        : byFreshnessThenFit({ postedAt: a.job.postedAt, fit: a.fit.pct }, { postedAt: b.job.postedAt, fit: b.fit.pct }, now);
    // a remote job for another country goes after the others; one that names the person's country and one open to anywhere are equals,
    // so the most recent of them goes first
    const restricted = (j: JobListing) => ((j.countryFit ?? 0) >= 2 ? 1 : 0);
    return tab !== "results" ? withFit : withFit.sort((a, b) => group(a.job) - group(b.job) || restricted(a.job) - restricted(b.job) || order(a, b));
  }, [pool, filters, skills, searchedQ, defaultRole, tab, myYears, profile, basics, template]); // eslint-disable-line react-hooks/exhaustive-deps

  // The jobs on screen (the first ten) are read in the background by the server, slowly, so their number becomes the exact one without
  // opening them. What comes back is shown in place: the order of the list does not move while somebody looks at it.
  // a change of the filters; the language is asked of the server, so the search runs again with it
  const changeFilters = (next: JobFilters) => {
    const languageChanged = next.lang !== filters.lang;
    setFilters(next);
    if (languageChanged) {
      langMode.current = next.lang;
      void search();
    }
  };
  const rankedRef = useRef(ranked);
  rankedRef.current = ranked;
  const profileRef = useRef({ profile, template, basics });
  profileRef.current = { profile, template, basics };
  const topKey = ranked.slice(0, 10).map((r) => r.job.key).join("|");
  useEffect(() => {
    if (tab !== "results" || loading || !topKey) return;
    const top = rankedRef.current.slice(0, 10).map((r) => r.job).filter((j) => !j.facts);
    if (top.length === 0) return;
    let off = false;
    const ask = async () => {
      try {
        const res = await authFetch("/api/jobs/warm", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jobs: top }) });
        if (!res.ok || off) return;
        const data = (await res.json()) as { ready?: Record<string, JobFacts> };
        const now = profileRef.current;
        for (const j of top) {
          const facts = data.ready?.[j.key];
          if (!facts || off) continue;
          const pct = jobScore(now.profile, { ...j, facts }, [], now.template, [], now.basics).score;
          setReadScores((r) => (r[j.key] === pct ? r : { ...r, [j.key]: pct }));
          setReadFacts((f) => (f[j.key] ? f : { ...f, [j.key]: facts }));
        }
      } catch {
        /* the numbers stay as estimates */
      }
    };
    void ask();
    // the readings take a few seconds each: the answers are collected again a little later
    const again = [setTimeout(ask, 15_000), setTimeout(ask, 40_000)];
    return () => {
      off = true;
      again.forEach(clearTimeout);
    };
  }, [topKey, tab, loading]);

  // The pay of the jobs on screen. Boards often leave it out of their data while the text of the posting says it ("$29 / hr - $53.50 / hr"), so
  // the server reads it from the posting (no AI) and it is shown in the card. Only what is on screen is asked, once per job (once more if the
  // posting could not be read the first time).
  const payTries = useRef(new Map<string, number>());
  const [payTick, setPayTick] = useState(0);
  const payKey = ranked
    .slice(0, tab === "results" ? shown : ranked.length)
    .filter((r) => !r.job.salary && (r.job.source === "adzuna" || r.job.source === "link") && (payTries.current.get(r.job.key) ?? 0) < 2)
    .slice(0, 30)
    .map((r) => r.job.key)
    .join("|");
  useEffect(() => {
    if (tab !== "results" || loading || !payKey) return;
    const keys = new Set(payKey.split("|"));
    const ask = rankedRef.current.map((r) => r.job).filter((j) => keys.has(j.key));
    if (ask.length === 0) return;
    ask.forEach((j) => payTries.current.set(j.key, (payTries.current.get(j.key) ?? 0) + 2)); // in flight: not asked again meanwhile
    void (async () => {
      let got: Record<string, string | null> = {};
      try {
        const res = await authFetch("/api/jobs/pay", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jobs: ask }) });
        if (res.ok) got = ((await res.json()) as { pays?: Record<string, string | null> }).pays ?? {};
      } catch {
        /* the cards stay as they are */
      }
      const unread = ask.filter((j) => !(j.key in got));
      unread.forEach((j) => payTries.current.set(j.key, 1)); // one more try later
      if (Object.values(got).some(Boolean)) setJobs((js) => js.map((j) => (!j.salary && got[j.key] ? { ...j, salary: got[j.key] as string } : j)));
      if (unread.length > 0) setTimeout(() => setPayTick((n) => n + 1), 20_000);
    })();
  }, [payKey, tab, loading, payTick]);

  // A link inside the app opens a job: /home/job-ads?job=<key>. The jobs the person already has (saved, applications) open from their own lists; the
  // others (our index, a job added from a link) are asked of the server; a job of Adzuna is not kept anywhere, so it only opens from the person's lists.
  // While a job is open the address says so (so the address bar and "Copy link" give a link that opens it).
  const linkedJob = useRef(typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("job") : null);
  useEffect(() => {
    const key = linkedJob.current;
    if (!key) return;
    const mine = [...saved, ...apps.map((a) => a.job)].find((j) => j.key === key);
    if (mine) {
      linkedJob.current = null;
      setDetailJob(mine);
    }
  }, [saved, apps]);
  useEffect(() => {
    const key = linkedJob.current;
    if (!key) return;
    if (!key.startsWith("adzuna:")) {
      void authFetch(`/api/jobs/one?key=${encodeURIComponent(key)}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d: { job?: JobListing } | null) => {
          if (d?.job && linkedJob.current === key) {
            linkedJob.current = null;
            setDetailJob(d.job);
          }
        })
        .catch(() => {});
    }
    const giveUp = setTimeout(() => {
      if (linkedJob.current === key) {
        linkedJob.current = null;
        toast.error(tr("That job is no longer available here. Search for it again."));
      }
    }, 6000);
    return () => clearTimeout(giveUp);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    try {
      const u = new URL(window.location.href);
      if (detailJob) u.searchParams.set("job", detailJob.key);
      else if (!linkedJob.current) u.searchParams.delete("job");
      window.history.replaceState(window.history.state, "", u);
    } catch {
      /* the address is only a convenience */
    }
  }, [detailJob]);

  // the headings of a search by place
  const reachTitle = (r: NonNullable<JobListing["reach"]>) =>
    r === "here" ? tr("In {place}", { place: searchedPlace }) : r === "near" ? tr("Near {place}", { place: searchedPlace }) : r === "city" ? tr("The nearest big city: {place}", { place: bigCity }) : r === "remote" ? tr("Remote jobs") : tr("More jobs in the country");
  const noneHere = tab === "results" && !searchedRemote && !!searchedPlace && jobs.length > 0 && !jobs.some((j) => j.reach === "here");

  const greeting = !searched && !loading && !q.trim() && !where.trim();
  return (
    <div className="mx-auto max-w-6xl pb-16">
      {/* once the greeting is gone the page still has its heading, for people who do not see the screen */}
      {!greeting && <h1 className="sr-only">{tr("Job Search")}</h1>}
      {/* nothing written or searched yet: a greeting for this person; it goes away as soon as they search or filter */}
      {greeting && (
        <header className="mb-6">
          <h1 className="text-3xl font-extrabold leading-tight tracking-tight">
            {firstName ? tr("{name}, what job are you looking for?", { name: firstName }) : tr("What job are you looking for?")}
          </h1>
          <p className="mt-1 text-muted-foreground">
            {profile.jobTitle?.trim() ? tr("Search for “{role}” or any other role, and pick the place.", { role: profile.jobTitle.trim() }) : tr("Type a role or a skill and pick the place.")}
          </p>
        </header>
      )}

      {/* search */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          search();
        }}
        className="mb-6 rounded-2xl border bg-card p-5 shadow-sm"
      >
        <div className="grid gap-3 lg:grid-cols-[1fr_1.5fr_auto]">
          <div className="relative">
            <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={tr("Job title or skill, like “data analyst”")} className="h-11 pl-10" aria-label={tr("Job title or skill")} />
          </div>
          <JobPlacePicker country={country} onCountry={setPickedCountry} homeCountry={homeCountry} value={where} onChange={setWhere} />
          <Button type="submit" disabled={loading} className="h-11 gap-2 px-7 text-base font-bold">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}{tr("Search")}</Button>
        </div>
      </form>

      {/* tabs */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
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
              {tr(t.label)} <span className={tab === t.id ? "opacity-90" : ""}>({t.n})</span>
            </button>
          ))}
        </div>
        {tab === "results" && jobs.length > 0 && (
          <div className="min-w-0 flex-1">
            <JobFilterControls value={filters} onChange={changeFilters} open={filtersOpen} onToggle={() => setFiltersOpen((o) => !o)} shown={ranked.length} total={pool.length} />
          </div>
        )}
        {tab === "saved" && saved.some((j) => !appByKey.has(j.key)) && (
          <Button onClick={prepareAllSaved} disabled={!!preparing} className="gap-2 bg-blue-600 font-bold hover:bg-blue-700">
            {preparing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
            {preparing ? tr("Preparing {done} of {total}…", { done: preparing.done, total: preparing.total }) : tr("Prepare all saved ({length})", { length: saved.filter((j) => !appByKey.has(j.key)).length })}
          </Button>
        )}
        <div className="flex items-center gap-3">
          <Button type="button" variant="outline" onClick={() => setAdding(true)} className="gap-2 rounded-full font-semibold">
            <Link2 className="h-4 w-4" />{" "}{tr("Add a job")}</Button>
        </div>
      </div>

      {tab === "results" && jobs.length > 0 && filtersOpen && <JobFilterPanel value={filters} onChange={changeFilters} sources={sources} />}

      {noneHere && (
        <p className="mb-4 rounded-xl border border-dashed bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
          {tr("There are no jobs in {place} right now. Here are the closest ones first, then the nearest big city, remote jobs and the rest of the country.", { place: searchedPlace })}</p>
      )}

      {tab === "results" && hiddenSent > 0 && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3 text-sm">
          <p className="text-muted-foreground">
            {showSent ? tr("Showing") : tr("Hiding")} <span className="font-semibold text-foreground">{hiddenSent}</span>{" "}{hiddenSent > 1 ? tr("jobs you already applied to.") : tr("job you already applied to.")}
          </p>
          <button type="button" onClick={() => setShowSent((v) => !v)} className="inline-flex min-h-6 items-center font-semibold text-blue-500 hover:underline">
            {showSent ? tr("Hide them") : tr("Show them anyway")}
          </button>
        </div>
      )}

      {tab === "results" && hiddenAbove > 0 && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3 text-sm">
          <p className="text-muted-foreground">
            {showAbove ? tr("Showing") : tr("Hiding")} <span className="font-semibold text-foreground">{hiddenAbove}</span>{" "}{tr("job")}{hiddenAbove > 1 ? tr("s") : ""}{" "}{tr("that ask for more experience than your")}{" "}{myYears > 0 ? tr("{myYears} year{v1}", { myYears, v1: myYears === 1 ? "" : "s" }) : tr("profile shows")}.
          </p>
          <button type="button" onClick={() => setShowAbove((v) => !v)} className="inline-flex min-h-6 items-center font-semibold text-blue-500 hover:underline">
            {showAbove ? tr("Hide them") : tr("Show them anyway")}
          </button>
        </div>
      )}

      {error && <p className="mb-4 rounded-xl border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-500">{error}</p>}

      {loadingMore && !loading && tab === "results" && (
        <p className="mb-3 flex items-center gap-2 text-sm text-muted-foreground" role="status">
          <Loader2 className="h-4 w-4 animate-spin" />
          {tr("Looking for more jobs…")}
        </p>
      )}

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
              <p className="font-semibold">{tab === "applications" ? tr("No applications yet") : tr("No saved jobs yet")}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {tab === "applications" ? tr("Press Prepare application on a job: Kaizo tailors your resume and writes the cover letter.") : tr("Press Save on a job to keep it here.")}
              </p>
            </>
          ) : (
            <>
              <p className="font-semibold">{searched ? tr("No jobs found for that search") : tr("Search to see openings")}</p>
              <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
                {searched ? tr("Try a shorter title, another city, or choose Remote as the place.") : tr("Type a role and a place, or fill in your target job in your profile.")}
              </p>
              {searched && (
                <p className="mx-auto mt-4 max-w-md text-sm text-muted-foreground">{tr("Know the job already?")}{" "}<button type="button" onClick={() => setAdding(true)} className="font-semibold text-blue-500 underline">{tr("Paste its link or text")}</button>{" "}{tr("and add it yourself.")}</p>
              )}
              {!defaultRole && (
                <Button asChild variant="outline" className="mt-4">
                  <Link href="/home/profile#objective">{tr("Set your target job")}</Link>
                </Button>
              )}
            </>
          )}
        </div>
      ) : (
        <>
          <ul className="space-y-3">
            <AnimatePresence initial={false}>
              {ranked.slice(0, tab === "results" ? shown : ranked.length).map(({ job, fit }, i, all) => (
                <React.Fragment key={job.key}>
                  {tab === "results" && job.reach && job.reach !== all[i - 1]?.job.reach && (
                    <li className="px-1 pb-1 pt-4 text-sm font-bold text-muted-foreground first:pt-0">{reachTitle(job.reach)}</li>
                  )}
                  <JobCard job={job} fit={readScores[job.key] !== undefined ? { ...fit, pct: readScores[job.key], estimate: false } : fit} saved={savedKeys.has(job.key)} onToggle={() => toggleSave(job)} onPrepare={() => setKitJob(withRead(job))} onOpen={() => setDetailJob(job)} onDelete={tab === "applications" ? () => deleteApplication(job) : undefined} status={appByKey.get(job.key)?.status} />
                </React.Fragment>
              ))}
            </AnimatePresence>
          </ul>
          {tab === "results" && ranked.length > shown && (
            <div className="mt-6 flex justify-center">
              <Button variant="outline" onClick={() => setShown((n) => n + PAGE)} className="h-11 px-8">{tr("Show more (")}{ranked.length - shown}{" "}{tr("left)")}</Button>
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
            toast.error(tr("The job was added, but we couldn't save it for later."));
          }
        }}
      />

      <JobDetail
        job={detailJob}
        saved={detailJob ? savedKeys.has(detailJob.key) : false}
        prepared={detailJob ? appByKey.has(detailJob.key) : false}
        onClose={() => setDetailJob(null)}
        onScore={onReadScore}
        onPrepare={(j) => {
          setDetailJob(null);
          setKitJob(withRead(j));
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
