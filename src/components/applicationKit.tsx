"use client";

// The kit for one job: Kaizo reads the posting, tailors a resume to it, writes a cover letter and keeps it all together.
// Kaizo cannot send the application itself (each company has its own form), so the last step is the person's: apply on
// the company's site with everything ready, then mark it as applied.
import React, { useEffect, useRef, useState } from "react";
import { Check, ClipboardCopy, ExternalLink, FileText, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import CompanyLogo from "@/components/companyLogo";
import ResumePreviewModal from "@/components/resumePreviewModal";
import { authFetch } from "@/lib/authFetch";
import { useToast } from "@/context/toastContext";
import { useProfile } from "@/context/profileContext";
import { skillGap } from "@/lib/jobSkills";
import type { JobListing } from "@/lib/jobSearch";

export interface Application {
  job: JobListing;
  fileId: string | null;
  coverLetter: string;
  template: string;
  status: "prepared" | "applied" | "interview" | "offer" | "rejected";
  updatedAt?: string;
}

const STEPS = ["Reading the job posting", "Tailoring your resume to it", "Writing your cover letter", "Saving everything"];

/** Prepares (or shows) the application for `job`. `existing` skips the work when it was already prepared. */
export default function ApplicationKit({
  job,
  profileId,
  template,
  existing,
  onClose,
  onChanged,
}: {
  job: JobListing | null;
  profileId: string | null;
  template: string;
  existing?: Application | null;
  onClose: () => void;
  onChanged: (a: Application) => void;
}) {
  const toast = useToast();
  const [app, setApp] = useState<Application | null>(null);
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const running = useRef<string | null>(null);
  const lastKey = useRef<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  // before it writes anything, the person chooses how skills are handled
  const { activeProfile } = useProfile();
  const [setup, setSetup] = useState(false);
  const [skillMode, setSkillMode] = useState<"relevant" | "all">("relevant");
  const [extra, setExtra] = useState<string[]>([]);
  const gap = job ? skillGap(`${job.title}. ${job.tags.join(", ")}. ${job.description || job.snippet}`, activeProfile?.skills ?? []) : { matched: [], missing: [] };

  // run once for each job that is opened
  useEffect(() => {
    if (!job) {
      setApp(null);
      setError("");
      running.current = null;
      lastKey.current = null;
      return;
    }
    if (lastKey.current !== job.key) {
      lastKey.current = job.key;
      if (attempt !== 0) {
        setAttempt(0);
        return;
      }
    }
    if (running.current === job.key) return;
    running.current = job.key;
    setError("");
    if (existing?.fileId) {
      setApp(existing);
      setSetup(false);
      return;
    }
    setApp(null);
    setStep(0);
    // first the setup screen (skills); "Prepare application" there raises `attempt` and the work starts
    if (attempt === 0) {
      setSetup(true);
      setExtra([]);
      setSkillMode("relevant");
      running.current = null;
      return;
    }
    setSetup(false);
    const tick = setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), 3500);
    (async () => {
      try {
        const res = await authFetch("/api/applications/prepare", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ profileId, template, job, skillMode, extraSkills: extra }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "We couldn't prepare that application.");
        const next: Application = { job, fileId: data.fileId, coverLetter: data.coverLetter ?? "", template, status: existing?.status ?? "prepared" };
        setApp(next);
        onChanged(next);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        clearInterval(tick);
      }
    })();
    return () => clearInterval(tick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job?.key, attempt]);

  const setStatus = async (status: Application["status"]) => {
    if (!app) return;
    const next = { ...app, status };
    setApp(next);
    onChanged(next);
    try {
      const res = await authFetch("/api/applications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: app.job.key, status }) });
      if (!res.ok) throw new Error();
    } catch {
      toast.error("We couldn't update the status.");
    }
  };

  const copy = async () => {
    if (!app?.coverLetter) return;
    try {
      await navigator.clipboard.writeText(app.coverLetter);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("We couldn't copy it. Select the text and copy it by hand.");
    }
  };

  return (
    <>
      <Dialog open={!!job} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-h-[92vh] overflow-y-auto rounded-2xl p-0 sm:max-w-5xl">
          <DialogTitle className="sr-only">Application for {job?.title}</DialogTitle>
          {job && (
            <>
              <div className="flex items-center gap-4 border-b px-6 py-5">
                <CompanyLogo company={job.company} logo={job.logo} size={52} />
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-500">Application</p>
                  <h2 className="truncate text-lg font-extrabold leading-tight">{job.title}</h2>
                  <p className="truncate text-sm text-muted-foreground">{job.company}</p>
                </div>
              </div>

              {error ? (
                <div className="px-6 py-8">
                  <p className="rounded-xl border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-500">{error}</p>
                  <Button
                    className="mt-4"
                    onClick={() => {
                      running.current = null;
                      setError("");
                      setAttempt((n) => n + 1);
                    }}
                  >
                    Try again
                  </Button>
                </div>
              ) : setup && !app ? (
                <div className="space-y-6 px-6 py-6">
                  <div>
                    <h3 className="text-lg font-extrabold">Before we write it</h3>
                    <p className="text-sm text-muted-foreground">Choose how this resume handles your skills. Your saved profile is never changed.</p>
                  </div>

                  <fieldset>
                    <legend className="mb-2 text-sm font-bold">Skills on this resume</legend>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {([
                        { id: "relevant", title: "Only the ones that fit this job", text: "Smart filter: keeps the skills the posting names or needs, plus closely related ones, most useful first." },
                        { id: "all", title: "All my skills", text: "Keeps every skill in your profile, with the ones this job asks for first." },
                      ] as const).map((o) => (
                        <label key={o.id} className={`cursor-pointer rounded-xl border p-4 transition-colors ${skillMode === o.id ? "border-blue-600 bg-blue-600/5" : "hover:border-blue-500/50"}`}>
                          <input type="radio" name="skill-mode" value={o.id} checked={skillMode === o.id} onChange={() => setSkillMode(o.id)} className="sr-only" />
                          <span className="flex items-center gap-2 font-semibold">
                            <span className={`flex h-4 w-4 items-center justify-center rounded-full border ${skillMode === o.id ? "border-blue-600 bg-blue-600" : ""}`}>{skillMode === o.id && <Check className="h-3 w-3 text-white" strokeWidth={4} />}</span>
                            {o.title}
                          </span>
                          <span className="mt-1 block text-sm text-muted-foreground">{o.text}</span>
                        </label>
                      ))}
                    </div>
                  </fieldset>

                  {gap.matched.length > 0 && (
                    <div>
                      <p className="mb-2 text-sm font-bold">You already have {gap.matched.length} of the skills it mentions</p>
                      <div className="flex flex-wrap gap-1.5">
                        {gap.matched.map((x) => (
                          <span key={x} className="rounded-full bg-green-500/10 px-3 py-1 text-sm font-medium text-green-500">{x}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {gap.missing.length > 0 && (
                    <fieldset>
                      <legend className="text-sm font-bold">The job also asks for</legend>
                      <p className="mb-2 text-sm text-muted-foreground">Tick only the ones you really know. They will be added to this resume and nothing else will.</p>
                      <div className="flex flex-wrap gap-1.5">
                        {gap.missing.map((x) => {
                          const on = extra.includes(x);
                          return (
                            <button
                              type="button"
                              key={x}
                              role="checkbox"
                              aria-checked={on}
                              onClick={() => setExtra((list) => (on ? list.filter((y) => y !== x) : [...list, x]))}
                              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition-colors ${on ? "border-blue-600 bg-blue-600 text-white" : "text-muted-foreground hover:border-blue-500 hover:text-foreground"}`}
                            >
                              {on && <Check className="h-3.5 w-3.5" strokeWidth={3} />} {x}
                            </button>
                          );
                        })}
                      </div>
                    </fieldset>
                  )}

                  <div className="flex justify-end gap-3 border-t pt-5">
                    <Button variant="ghost" onClick={onClose}>Cancel</Button>
                    <Button onClick={() => setAttempt((n) => n + 1)} className="gap-2">Prepare application</Button>
                  </div>
                </div>
              ) : !app ? (
                <div className="px-6 py-10">
                  <ul className="mx-auto max-w-sm space-y-4">
                    {STEPS.map((s, i) => (
                      <li key={s} className={`flex items-center gap-3 text-sm transition-opacity ${i > step ? "opacity-40" : ""}`}>
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center">
                          {i < step ? <Check className="h-5 w-5 text-green-500" strokeWidth={3} /> : i === step ? <Loader2 className="h-5 w-5 animate-spin text-blue-500" /> : <span className="h-2 w-2 rounded-full bg-muted-foreground/40" />}
                        </span>
                        <span className={i === step ? "font-semibold" : ""}>{s}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-6 text-center text-xs text-muted-foreground">This takes about half a minute.</p>
                </div>
              ) : (
                <div className="grid gap-6 px-6 py-6 lg:grid-cols-[24rem_minmax(0,1fr)]">
                  <div className="space-y-6">
                  {/* resume */}
                  <section className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-4">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-blue-600/10 text-blue-600">
                      <FileText className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 flex-1 basis-40">
                      <p className="font-bold">Your resume for this job</p>
                      <p className="text-sm text-muted-foreground">Tailored to what the posting asks for, with your real experience. It is also saved in Resumes.</p>
                    </div>
                    <Button onClick={() => app.fileId && setPreviewId(app.fileId)} className="w-full">
                      Preview and download
                    </Button>
                  </section>

                  {/* apply */}
                  <section className="rounded-xl border-2 border-blue-600/30 bg-blue-600/5 p-4">
                    <p className="font-bold">Last step: send it</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Every company has its own form, so you send the application there with the resume and letter above. Then mark it here to keep track.
                    </p>
                    <div className="mt-4 flex flex-wrap items-center gap-3">
                      {job.url && (
                      <Button asChild className="gap-2">
                        <a href={job.url} target="_blank" rel="noopener noreferrer">
                          Apply on {job.company || "the company's site"} <ExternalLink className="h-4 w-4" />
                        </a>
                      </Button>
                      )}
                    </div>
                    {/* where it stands: any state can be picked again, so a mistaken click is undone with one more */}
                    <div className="mt-5 border-t pt-4">
                      <p className="mb-2 text-sm font-semibold">Where it stands</p>
                      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Application status">
                        {(["prepared", "applied", "interview", "offer", "rejected"] as const).map((st) => (
                          <button
                            key={st}
                            role="radio"
                            aria-checked={app.status === st}
                            onClick={() => app.status !== st && setStatus(st)}
                            className={`rounded-full border px-3 py-1 text-xs font-semibold capitalize transition-colors ${app.status === st ? "border-blue-600 bg-blue-600 text-white" : "text-muted-foreground hover:border-blue-500 hover:text-foreground"}`}
                          >
                            {st === "prepared" ? "Not sent yet" : st}
                          </button>
                        ))}
                      </div>
                      {app.status !== "prepared" && (
                        <button onClick={() => setStatus("prepared")} className="mt-2 text-xs text-muted-foreground underline hover:text-foreground">
                          Marked by mistake? Undo
                        </button>
                      )}
                    </div>
                  </section>
                  </div>
                  <div>
                  {/* cover letter */}
                  <section>
                    <div className="mb-2 flex items-center justify-between">
                      <p className="font-bold">Cover letter</p>
                      <Button variant="ghost" size="sm" onClick={copy} className="gap-1.5">
                        {copied ? <Check className="h-4 w-4 text-green-500" /> : <ClipboardCopy className="h-4 w-4" />}
                        {copied ? "Copied" : "Copy"}
                      </Button>
                    </div>
                    <textarea
                      readOnly
                      value={app.coverLetter}
                      rows={16}
                      className="w-full resize-none rounded-xl border bg-muted/30 p-4 text-sm leading-relaxed outline-none"
                    />
                  </section>

                  </div>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
      <ResumePreviewModal isOpen={!!previewId} onClose={() => setPreviewId(null)} fileId={previewId} />
    </>
  );
}
