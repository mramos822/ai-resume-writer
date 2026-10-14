"use client";

// The page of one job, inside the app: everything Kaizo knows about it, how it fits you, and what to do next.
// Applying on the company's site is the last step, not the first thing a click does.
import React, { useEffect, useMemo, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Bookmark, BookmarkCheck, Briefcase, Clock, ExternalLink, Globe2, MapPin, Wallet, Wand2, X } from "lucide-react";
import CompanyLogo from "@/components/companyLogo";
import { Button } from "@/components/ui/button";
import { useProfile } from "@/context/profileContext";
import { useToast } from "@/context/toastContext";
import { authFetch } from "@/lib/authFetch";
import { ago, fitOf, skillsForFit } from "@/lib/jobFit";
import { jobScore } from "@/lib/jobScore";
import { yearsFor } from "@/lib/experienceLevel";
import { levelOf } from "@/lib/jobLevel";
import { covers, mentionedSkills } from "@/lib/jobSkills";
import type { JobListing } from "@/lib/jobSearch";
import { useT } from "@/i18n/provider";

const SOURCE: Record<JobListing["source"], string> = { remotive: "Remotive", arbeitnow: "Arbeitnow", adzuna: "Adzuna", link: "You" };
/** The plain description in short paragraphs (the sources give it as one block of text). */
function paragraphs(text: string): string[] {
  const sentences = text.split(/(?<=[.!?])\s+(?=[A-Z0-9•\-])/);
  const out: string[] = [];
  let cur = "";
  for (const s of sentences) {
    cur = cur ? `${cur} ${s}` : s;
    if (cur.length > 280) {
      out.push(cur);
      cur = "";
    }
  }
  if (cur) out.push(cur);
  return out;
}

type Block = { kind: "p" | "h" | "li"; text: string };
/** A description made of sections ("## " heading, "- " bullet), like the ones of added jobs; null for plain text. */
function sections(text: string): Block[] | null {
  if (!/^## |\n- /m.test(text)) return null;
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l): Block => (l.startsWith("## ") ? { kind: "h", text: l.slice(3) } : l.startsWith("- ") ? { kind: "li", text: l.slice(2) } : { kind: "p", text: l }));
}

const CUT = /(\.\.\.|…)\s*$/;

export default function JobDetail({
  job,
  saved,
  prepared,
  onClose,
  onPrepare,
  onSavedChange,
}: {
  job: JobListing | null;
  saved: boolean;
  /** the application of this job already exists */
  prepared?: boolean;
  onClose: () => void;
  onPrepare: (job: JobListing) => void;
  onSavedChange?: (job: JobListing, saved: boolean) => void;
}) {
  const { tr } = useT();
  const { activeProfile: profile } = useProfile();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  // job boards only share the first lines of a posting: we read the whole posting and show it as a summary and its sections
  const [full, setFull] = useState<{ key: string; text: string | null } | null>(null);
  const [loadingFull, setLoadingFull] = useState(false);

  useEffect(() => {
    setFull(null);
    if (!job) return;
    const have = job.description || job.snippet || "";
    if (sections(have)) return; // a job that was added already comes as a summary and sections
    let off = false;
    setLoadingFull(true);
    authFetch("/api/jobs/detail", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ job }) })
      .then((r) => (r.ok ? r.json() : { text: null }))
      .then((d) => !off && setFull({ key: job.key, text: typeof d.text === "string" ? d.text : null }))
      .catch(() => !off && setFull({ key: job.key, text: null }))
      .finally(() => !off && setLoadingFull(false));
    return () => {
      off = true;
    };
  }, [job]);

  const analysis = useMemo(() => {
    if (!job) return null;
    const role = profile.jobTitle?.trim() || "";
    const source = full?.key === job.key && full.text ? full.text : job.description || job.snippet || "";
    const text = `${job.title}. ${job.tags.join(", ")}. ${source}`;
    const myYears = yearsFor(profile);
    // the percentage is the number of the job (see lib/jobScore); the skills it matches come from the quick reading of the posting
    const fit = { ...fitOf(job, skillsForFit(profile), role, myYears), pct: jobScore(profile, job).score };
    const mine = profile.skills ?? [];
    const has = (s: string) => mine.some((m) => covers(m, s)); // "GitHub Actions" counts for a posting that asks for GitHub
    const mentioned = mentionedSkills(text);
    return {
      fit,
      level: levelOf(job),
      myYears,
      matched: mentioned.filter(has).slice(0, 12),
      missing: mentioned.filter((s) => !has(s)).slice(0, 8),
      blocks: sections(source),
      body: paragraphs(source.replace(CUT, "").trim()),
      // the text still stops in the middle: the rest is only on the posting
      cut: CUT.test(source.trim()),
    };
  }, [job, full, profile]);

  const toggleSave = async () => {
    if (!job || busy) return;
    setBusy(true);
    try {
      const res = saved
        ? await authFetch(`/api/saved-jobs?key=${encodeURIComponent(job.key)}`, { method: "DELETE" })
        : await authFetch("/api/saved-jobs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(job) });
      if (!res.ok) throw new Error();
      onSavedChange?.(job, !saved);
      if (!saved) toast.success(tr("Job saved."));
    } catch {
      toast.error(tr("We couldn't update your saved jobs. Try again."));
    } finally {
      setBusy(false);
    }
  };

  const pct = analysis?.fit.pct ?? 0;
  const color = pct >= 70 ? "#22c55e" : pct >= 40 ? "#3b82f6" : "#94a3b8";

  return (
    <Dialog.Root open={!!job} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[70] bg-black/50 data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed inset-y-0 right-0 z-[71] flex w-full max-w-2xl flex-col bg-background shadow-2xl outline-none duration-300 data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right"
        >
          {job && analysis && (
            <>
              <Dialog.Title className="sr-only">{tr(job.title)}</Dialog.Title>
              {/* top: who and where */}
              <div className="flex items-start gap-4 border-b px-6 py-5">
                <CompanyLogo company={job.company} logo={job.logo} size={60} />
                <div className="min-w-0 flex-1">
                  <h2 className="text-2xl font-extrabold leading-tight">{tr(job.title)}</h2>
                  <p className="mt-0.5 text-lg text-muted-foreground">{job.company}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
                    {job.location && (
                      <span className="inline-flex items-center gap-1.5">
                        <MapPin className="h-4 w-4" /> {job.location}
                      </span>
                    )}
                    {job.remote && (
                      <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-500">
                        <Globe2 className="h-4 w-4" />{" "}{tr("Remote")}</span>
                    )}
                    {job.salary && (
                      <span className="inline-flex items-center gap-1.5">
                        <Wallet className="h-4 w-4" /> {job.salary}
                      </span>
                    )}
                    {job.postedAt && (
                      <span className="inline-flex items-center gap-1.5">
                        <Clock className="h-4 w-4" /> {ago(job.postedAt, tr)}
                      </span>
                    )}
                    {analysis.level.label && (
                      <span className="inline-flex items-center gap-1.5">
                        <Briefcase className="h-4 w-4" /> {tr(analysis.level.label)}
                        {analysis.level.years > 0 && tr(" · {years}+ yrs", { years: analysis.level.years })}
                      </span>
                    )}
                  </div>
                </div>
                <Dialog.Close asChild>
                  <button aria-label={tr("Close")} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
                    <X className="h-4 w-4" />
                  </button>
                </Dialog.Close>
              </div>

              {/* middle: what we found */}
              <div className="no-scrollbar flex-1 space-y-8 overflow-y-auto px-6 py-6">
                <section className="flex items-center gap-5 rounded-2xl border bg-card p-5">
                  <span className="text-5xl font-black leading-none tabular-nums" style={{ color }}>
                    {pct}
                    <span className="text-xl text-muted-foreground">%</span>
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold">{tr("Fit with your profile")}</p>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${pct}%`, background: color }} />
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {analysis.matched.length > 0 ? tr("{length} of the skills this job mentions are already in your profile.", { length: analysis.matched.length }) : tr("We found no skills of yours in this posting.")}
                    </p>
                  </div>
                </section>

                {(analysis.matched.length > 0 || analysis.missing.length > 0) && (
                  <section className="grid gap-5 sm:grid-cols-2">
                    <div>
                      <h3 className="mb-2.5 text-sm font-bold uppercase tracking-wider text-muted-foreground">{tr("You have")}</h3>
                      <div className="flex flex-wrap gap-1.5">
                        {analysis.matched.length === 0 ? <span className="text-sm text-muted-foreground">{tr("None yet")}</span> : analysis.matched.map((s) => (
                          <span key={s} className="rounded-full bg-green-500/10 px-3 py-1 text-sm font-medium text-green-500">
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h3 className="mb-2.5 text-sm font-bold uppercase tracking-wider text-muted-foreground">{tr("They also ask for")}</h3>
                      <div className="flex flex-wrap gap-1.5">
                        {analysis.missing.length === 0 ? <span className="text-sm text-muted-foreground">{tr("Nothing else")}</span> : analysis.missing.map((s) => (
                          <span key={s} className="rounded-full border px-3 py-1 text-sm text-muted-foreground">
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>
                  </section>
                )}

                {analysis.level.years > analysis.myYears + 1 && (
                  <p className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm">
                    {tr("This job asks for about {years} years of experience and your profile shows {mine}. That is why the fit is much lower.", { years: analysis.level.years, mine: analysis.myYears > 0 ? tr("{n} year{v1}", { n: analysis.myYears, v1: analysis.myYears === 1 ? "" : "s" }) : tr("none") })}
                  </p>
                )}

                <section>
                  <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-muted-foreground">{tr("About the job")}</h3>
                  <div className="space-y-3.5 leading-relaxed">
                    {analysis.blocks
                      ? analysis.blocks.map((b, i) =>
                          b.kind === "h" ? (
                            <h4 key={i} className="pt-2 text-sm font-bold">{tr(b.text)}</h4>
                          ) : b.kind === "li" ? (
                            <p key={i} className="flex gap-2.5 pl-1"><span aria-hidden className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" />{b.text}</p>
                          ) : (
                            <p key={i}>{b.text}</p>
                          )
                        )
                      : analysis.body.length === 0 ? <p className="text-muted-foreground">{tr("The source did not share more about this job. The original posting has the full text.")}</p> : analysis.body.map((p, i) => <p key={i}>{p}</p>)}
                  </div>
                  {loadingFull && (
                    <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                      <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-muted-foreground/40 border-t-blue-500" />{" "}{tr("Loading the full description…")}</p>
                  )}
                  {analysis.cut && !loadingFull && (
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed bg-muted/30 px-4 py-3 text-sm">
                      <p className="text-muted-foreground">{SOURCE[job.source]}{" "}{tr("shares only the first lines of this job. The responsibilities, requirements and benefits are in the full posting.")}</p>
                      <Button asChild size="sm" variant="outline" className="gap-1.5">
                        <a href={job.url} target="_blank" rel="noopener noreferrer">{tr("Read the full posting")}{" "}<ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      </Button>
                    </div>
                  )}
                  {job.tags.length > 0 && (
                    <div className="mt-5 flex flex-wrap gap-1.5">
                      {job.tags.map((t) => (
                        <span key={t} className="rounded-md bg-muted px-2.5 py-1 text-xs font-medium capitalize">
                          {tr(t)}
                        </span>
                      ))}
                    </div>
                  )}
                  <p className="mt-5 text-xs text-muted-foreground">{job.source === "link" ? tr("Added by you from a posting you pasted.") : tr("Information from {v0}. The full posting is on their site.", { v0: SOURCE[job.source] })}</p>
                </section>
              </div>

              {/* bottom: the actions, the company's site last */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-t bg-background px-6 py-4">
                <Button variant="outline" onClick={toggleSave} disabled={busy} className="gap-2">
                  {saved ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
                  {saved ? tr("Saved") : tr("Save")}
                </Button>
                <div className="flex flex-wrap items-center gap-3">
                  {job.url && (
                    <Button asChild variant="ghost" className="gap-1.5 text-muted-foreground">
                      <a href={job.url} target="_blank" rel="noopener noreferrer">{tr("Original posting")}{" "}<ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </Button>
                  )}
                  <Button onClick={() => onPrepare(job)} className="h-11 gap-2 bg-blue-600 px-6 font-bold hover:bg-blue-700">
                    <Wand2 className="h-4 w-4" /> {prepared ? tr("Open application") : tr("Prepare application")}
                  </Button>
                </div>
              </div>
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
