"use client";

// "Add a job": paste a link (or the text) of a posting from any site and it joins the job search like any other job.
import React, { useRef, useState } from "react";
import { FileText, Link2, Loader2, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { authFetch } from "@/lib/authFetch";
import type { JobListing } from "@/lib/jobSearch";
import { useT } from "@/i18n/provider";

export default function AddJobLink({ open, onClose, onAdded }: { open: boolean; onClose: () => void; onAdded: (job: JobListing) => void }) {
  const { tr, trd } = useT();
  const [mode, setMode] = useState<"link" | "text">("link");
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const urlBox = useRef<HTMLInputElement>(null);

  const ready = mode === "link" ? /^https?:\/\/\S+\.\S+/i.test(url.trim()) : text.trim().length >= 80;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ready || busy) return;
    setBusy(true);
    setError("");
    // it never waits for ever: after 45 seconds it says so and offers the text
    const stop = new AbortController();
    const timer = setTimeout(() => stop.abort(), 45_000);
    try {
      const res = await authFetch("/api/jobs/import", { method: "POST", headers: { "Content-Type": "application/json" }, signal: stop.signal, body: JSON.stringify(mode === "link" ? { url: url.trim() } : { text: text.trim() }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        // a page that needs a login cannot be read: offer the text instead (a list of jobs is not that: the person only has to open one job)
        if (res.status === 422 && mode === "link" && !/^That link is a list of jobs/.test(String(data.error ?? ""))) setMode("text");
        throw new Error(trd(data.error) || tr("We couldn't read that posting."));
      }
      onAdded(data.job as JobListing);
      setUrl("");
      setText("");
    } catch (err) {
      if (stop.signal.aborted) {
        if (mode === "link") setMode("text");
        setError(tr("This is taking too long. Paste the text of the posting instead."));
      } else setError((err as Error).message);
    } finally {
      clearTimeout(timer);
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="rounded-2xl sm:max-w-xl">
        <DialogTitle className="text-xl font-extrabold">{tr("Add a job")}</DialogTitle>
        <DialogDescription>{tr("Did not find it in the search? Paste the link of the posting, from any site, or its text. It becomes a job here: you can compare it with your profile and prepare a resume and cover letter for it.")}</DialogDescription>

        <form onSubmit={submit} className="space-y-4">
          <div role="tablist" className="inline-flex rounded-full border p-1 text-sm font-semibold">
            {[
              { id: "link" as const, label: "Paste a link", icon: Link2 },
              { id: "text" as const, label: "Paste the text", icon: FileText },
            ].map((t) => (
              <button key={t.id} type="button" role="tab" aria-selected={mode === t.id} onClick={() => setMode(t.id)} className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 transition-colors ${mode === t.id ? "bg-blue-600 text-white" : "text-muted-foreground hover:text-foreground"}`}>
                <t.icon className="h-4 w-4" /> {tr(t.label)}
              </button>
            ))}
          </div>

          {mode === "link" ? (
            <div>
              <label htmlFor="job-url" className="mb-1.5 block text-sm font-semibold">{tr("Link to the job")}</label>
              {/* the X empties the link in one click: a long link cannot be selected and deleted by hand without effort */}
              <div className="relative">
                <input ref={urlBox} id="job-url" type="url" inputMode="url" autoFocus value={url} onChange={(e) => setUrl(e.target.value)} placeholder={tr("https://company.com/careers/job-123")} className="h-11 w-full rounded-lg border bg-background pl-3.5 pr-10 outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50" />
                {url && (
                  <button type="button" aria-label={tr("Clear the link")} title={tr("Clear the link")} disabled={busy} onClick={() => { setUrl(""); setError(""); urlBox.current?.focus(); }} className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-blue-500/50 disabled:opacity-50">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">{tr("Works with company pages and most job boards. Sites that ask you to log in cannot be read: paste the text instead.")}</p>
            </div>
          ) : (
            <div>
              <label htmlFor="job-text" className="mb-1.5 block text-sm font-semibold">{tr("Text of the posting")}</label>
              <textarea id="job-text" autoFocus value={text} onChange={(e) => setText(e.target.value)} rows={9} placeholder={tr("Copy the job title, company and description from the page and paste it here.")} className="w-full resize-y rounded-lg border bg-background p-3.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50" />
              <div className="mt-1 flex items-center justify-between gap-3">
                <p className="text-xs text-muted-foreground">{text.trim().length < 80 ? tr("Paste a little more of the posting.") : tr("{v0} characters", { v0: text.trim().length.toLocaleString() })}</p>
                {text && (
                  <button type="button" disabled={busy} onClick={() => { setText(""); setError(""); }} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50">
                    <X className="h-3.5 w-3.5" /> {tr("Clear the text")}
                  </button>
                )}
              </div>
            </div>
          )}

          {error && (
            <p role="alert" className="rounded-lg border border-red-500/30 bg-red-500/5 px-3.5 py-2.5 text-sm text-red-500">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>{tr("Cancel")}</Button>
            <Button type="submit" disabled={!ready || busy} className="gap-2">
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {busy ? tr("Reading the posting…") : tr("Add this job")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
