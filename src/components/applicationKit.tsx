"use client";

// The kit for one job: the tailored resume, the cover letter and where the application stands.
// A job without an application goes to the page where its resume is made (see app/home/apply). Kaizo cannot send the application
// itself (each company has its own form), so the last step is the person's: apply on the company's site with everything ready,
// then mark it as applied.
import React, { useEffect, useRef, useState } from "react";
import { Check, ClipboardCopy, ExternalLink, FileText } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import CompanyLogo from "@/components/companyLogo";
import ResumePreviewModal from "@/components/resumePreviewModal";
import { authFetch } from "@/lib/authFetch";
import { APPLY_JOB_KEY } from "@/lib/applyJob";
import { useRouter } from "@/i18n/navigation";
import { useToast } from "@/context/toastContext";
import type { JobListing } from "@/lib/jobSearch";
import { useT } from "@/i18n/provider";

export interface Application {
  job: JobListing;
  fileId: string | null;
  coverLetter: string;
  template: string;
  status: "prepared" | "applied" | "interview" | "offer" | "rejected";
  updatedAt?: string;
}

/** Shows the application for `job`; when it has none, takes the person to the page where its resume is made. */
export default function ApplicationKit({
  job,
  profileId,
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
  const { tr } = useT();
  const router = useRouter();
  const toast = useToast();
  const [copied, setCopied] = useState(false);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [status, setStatusState] = useState<Application["status"] | null>(null);
  const sent = useRef<string | null>(null);

  const app: Application | null = job && existing?.fileId ? { ...existing, status: status ?? existing.status } : null;

  const makeIt = (j: JobListing) => {
    try {
      sessionStorage.setItem(APPLY_JOB_KEY, JSON.stringify(j));
    } catch {
      /* storage unavailable: the page sends the person back to the jobs */
    }
    onClose();
    router.push("/home/apply");
  };

  // a job without an application: its resume is made on its own page, not in this window
  useEffect(() => {
    if (!job) {
      sent.current = null;
      setStatusState(null);
      return;
    }
    if (existing?.fileId) {
      setStatusState(null);
      return;
    }
    if (sent.current === job.key) return;
    sent.current = job.key;
    makeIt(job);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job?.key, existing?.fileId]);

  const setStatus = async (next: Application["status"]) => {
    if (!app) return;
    setStatusState(next);
    onChanged({ ...app, status: next });
    try {
      const res = await authFetch("/api/applications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: app.job.key, status: next, profileId }) });
      if (!res.ok) throw new Error();
    } catch {
      toast.error(tr("We couldn't update the status."));
    }
  };

  const copy = async () => {
    if (!app?.coverLetter) return;
    try {
      await navigator.clipboard.writeText(app.coverLetter);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error(tr("We couldn't copy it. Select the text and copy it by hand."));
    }
  };

  return (
    <>
      <Dialog open={!!job && !!app} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-h-[92vh] overflow-y-auto rounded-2xl p-0 sm:max-w-5xl">
          <DialogTitle className="sr-only">{tr("Application for")}{" "}{tr(job?.title)}</DialogTitle>
          {job && app && (
            <>
              <div className="flex items-center gap-4 border-b px-6 py-5">
                <CompanyLogo company={job.company} logo={job.logo} size={52} />
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-500">{tr("Application")}</p>
                  <h2 className="truncate text-lg font-extrabold leading-tight">{tr(job.title)}</h2>
                  <p className="truncate text-sm text-muted-foreground">{job.company}</p>
                </div>
              </div>

              <div className="grid gap-6 px-6 py-6 lg:grid-cols-[24rem_minmax(0,1fr)]">
                <div className="space-y-6">
                  {/* resume */}
                  <section className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-4">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-blue-600/10 text-blue-600">
                      <FileText className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 flex-1 basis-40">
                      <p className="font-bold">{tr("Your resume for this job")}</p>
                      <p className="text-sm text-muted-foreground">{tr("Tailored to what the posting asks for, with your real experience. It is also saved in Resumes.")}</p>
                    </div>
                    <Button onClick={() => app.fileId && setPreviewId(app.fileId)} className="w-full">{tr("Preview and download")}</Button>
                    <Button variant="outline" onClick={() => makeIt(job)} className="w-full">{tr("Improve it: answer questions and make it again")}</Button>
                  </section>

                  {/* apply */}
                  <section className="rounded-xl border-2 border-blue-600/30 bg-blue-600/5 p-4">
                    <p className="font-bold">{tr("Last step: send it")}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{tr("Every company has its own form, so you send the application there with the resume and letter above. Then mark it here to keep track.")}</p>
                    <div className="mt-4 flex flex-wrap items-center gap-3">
                      {job.url && (
                        <Button asChild className="gap-2">
                          <a href={job.url} target="_blank" rel="noopener noreferrer">{tr("Apply on")}{" "}{job.company || tr("the company's site")} <ExternalLink className="h-4 w-4" />
                          </a>
                        </Button>
                      )}
                    </div>
                    {/* where it stands: any state can be picked again, so a mistaken click is undone with one more */}
                    <div className="mt-5 border-t pt-4">
                      <p className="mb-2 text-sm font-semibold">{tr("Where it stands")}</p>
                      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={tr("Application status")}>
                        {(["prepared", "applied", "interview", "offer", "rejected"] as const).map((st) => (
                          <button
                            key={st}
                            role="radio"
                            aria-checked={app.status === st}
                            onClick={() => app.status !== st && setStatus(st)}
                            className={`rounded-full border px-3 py-1 text-xs font-semibold capitalize transition-colors ${app.status === st ? "border-blue-600 bg-blue-600 text-white" : "text-muted-foreground hover:border-blue-500 hover:text-foreground"}`}
                          >
                            {st === "prepared" ? tr("Not sent yet") : st}
                          </button>
                        ))}
                      </div>
                      {app.status !== "prepared" && (
                        <button onClick={() => setStatus("prepared")} className="mt-2 text-xs text-muted-foreground underline hover:text-foreground">{tr("Marked by mistake? Undo")}</button>
                      )}
                    </div>
                  </section>
                </div>

                {/* cover letter */}
                <div>
                  <section>
                    <div className="mb-2 flex items-center justify-between">
                      <p className="font-bold">{tr("Cover letter")} <span className="ml-1 rounded bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">{tr("Written with AI")}</span></p>
                      <Button variant="ghost" size="sm" onClick={copy} className="gap-1.5">
                        {copied ? <Check className="h-4 w-4 text-green-500" /> : <ClipboardCopy className="h-4 w-4" />}
                        {copied ? tr("Copied") : tr("Copy")}
                      </Button>
                    </div>
                    <textarea readOnly aria-label={tr("Cover letter")} value={app.coverLetter} rows={16} className="w-full resize-none rounded-xl border bg-muted/30 p-4 text-sm leading-relaxed outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50" />
                  </section>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
      <ResumePreviewModal isOpen={!!previewId} onClose={() => setPreviewId(null)} fileId={previewId} />
    </>
  );
}
