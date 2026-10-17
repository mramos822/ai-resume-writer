"use client";

// Resumes as a studio: your versions on a rail, the selected resume large on a desk with a dock of actions under it,
// and what applicant tracking systems make of it on the right. A second tab holds the cover letters of your applications.
import { asTemplateId } from "@/lib/templates";
import React, { useEffect, useMemo, useState } from "react";
import Link from "@/i18n/navigation";
import { useRouter } from "@/i18n/navigation";
import { format } from "date-fns";
import { AlertTriangle, Check, ClipboardCopy, Download, ExternalLink, FileDown, FileText, Pencil, Plus, Trash2 } from "lucide-react";
import { motion } from "framer-motion";
import { useAuth } from "@/context/authContext";
import { useProfile } from "@/context/profileContext";
import { useToast } from "@/context/toastContext";
import { useDialog } from "@/context/dialogContext";
import { authFetch } from "@/lib/authFetch";
import { evaluateAuto, scoreOf } from "@/lib/reviewRubric";
import { maxPagesFor } from "@/lib/pageGoal";
import { ago } from "@/lib/jobFit";
import PdfPage, { forgetPdfPage } from "@/components/pdfPage";
import ResumePreviewModal from "@/components/resumePreviewModal";
import CompanyLogo from "@/components/companyLogo";
import { Button } from "@/components/ui/button";
import type { JobListing } from "@/lib/jobSearch";
import { useT } from "@/i18n/provider";

interface Resume {
  id: string;
  filename: string;
  uploadDate: string;
  metadata: { profileId: string; template: string; format: string; createdAt: string; jobAdId?: string; isGenerated?: boolean; scale?: number; pages?: number };
  profileName?: string;
  jobAdTitle?: string;
}
interface Letter {
  job: JobListing;
  coverLetter: string;
}

const prettyName = (f: string) => f.replace(/\.pdf$/i, "").replace(/_/g, " ");
const lookOf = (r: Resume) => asTemplateId(r.metadata?.template);

/** A score as a ring. */
function Ring({ value, size = 96 }: { value: number; size?: number }) {
  const r = 42;
  const c = 2 * Math.PI * r;
  const color = value >= 80 ? "#22c55e" : value >= 60 ? "#3b82f6" : "#f59e0b";
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
        <circle cx="50" cy="50" r={r} fill="none" strokeWidth="9" className="stroke-border" />
        <circle cx="50" cy="50" r={r} fill="none" strokeWidth="9" strokeLinecap="round" stroke={color} strokeDasharray={c} strokeDashoffset={c - (c * value) / 100} style={{ transition: "stroke-dashoffset 0.9s cubic-bezier(0.22,1,0.36,1)" }} />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-2xl font-black tabular-nums">{value}</span>
    </div>
  );
}

export default function ResumesPage() {
  const { tr } = useT();
  const { user, loading, unverified } = useAuth();
  const router = useRouter();
  const { activeProfileId, activeProfile: profile, setActiveProfileId } = useProfile();
  const toast = useToast();
  const dialog = useDialog();
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [isLoadingResumes, setIsLoadingResumes] = useState(true);
  const [letters, setLetters] = useState<Letter[]>([]);
  const [tab, setTab] = useState<"resumes" | "letters">("resumes");
  const [selId, setSelId] = useState<string | null>(null);
  const [previewFileId, setPreviewFileId] = useState<string | null>(null);
  const [copied, setCopied] = useState("");

  useEffect(() => {
    if (!loading && !user) router.push(unverified ? "/login?view=login" : "/");
  }, [user, loading, unverified, router]);

  // arriving from the guest builder after making an account: the resume is selected and its preview (with downloads) is open
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const id = q.get("open");
    if (!id || !/^[a-f0-9]{24}$/i.test(id)) return;
    const pid = q.get("profile");
    if (pid && /^[a-f0-9]{24}$/i.test(pid)) setActiveProfileId(pid); // the profile the resume belongs to (an account can have several)
    setSelId(id);
    setPreviewFileId(id);
    window.history.replaceState(null, "", "/home/resumes");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!activeProfileId) return;
    setIsLoadingResumes(true);
    authFetch(`/api/resumes?profileId=${activeProfileId}`)
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((d: Resume[]) => setResumes(d))
      .catch(() => toast.error(tr("Failed to load resumes.")))
      .finally(() => setIsLoadingResumes(false));
    authFetch(`/api/applications?profileId=${activeProfileId}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((d: Letter[]) => setLetters(d.filter((a) => a.coverLetter)))
      .catch(() => {});
  }, [activeProfileId, toast, tr]);

  const sorted = useMemo(() => [...resumes].sort((a, b) => +new Date(b.uploadDate) - +new Date(a.uploadDate)), [resumes]);
  const sel = sorted.find((r) => r.id === selId) ?? sorted[0] ?? null;

  // what applicant tracking systems make of the selected resume: measured by code, so it is instant and always the same
  // how the saved file fit its pages when it was made (text size and number of pages): the page filter needs it, and old files do not have it
  const fit = useMemo(
    () => (sel && typeof sel.metadata?.scale === "number" ? { pages: sel.metadata.pages ?? 1, scale: sel.metadata.scale, maxPages: maxPagesFor(profile, lookOf(sel)) } : null),
    [profile, sel],
  );
  const checks = useMemo(() => (sel ? evaluateAuto(profile, fit, lookOf(sel)) : []), [profile, sel, fit]);
  const score = scoreOf(checks);
  const worst = useMemo(() => [...checks].filter((c) => c.verdict !== "pass").sort((a, b) => b.weight - b.earned - (a.weight - a.earned)), [checks]);
  const passed = checks.filter((c) => c.verdict === "pass").length;

  const handleDelete = async (id: string) => {
    const ok = await dialog.confirm({ title: tr("Delete this resume?"), description: tr("The PDF will be permanently removed from your library."), confirmText: tr("Delete resume"), tone: "danger" });
    if (!ok) return;
    try {
      const res = await authFetch(`/api/resumes?fileId=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      forgetPdfPage(id);
      setResumes((list) => list.filter((r) => r.id !== id));
      toast.success(tr("Resume deleted."));
    } catch {
      toast.error(tr("Failed to delete resume."));
    }
  };

  const rename = async (r: Resume) => {
    const name = await dialog.prompt({ title: tr("Rename resume"), description: tr("Pick a name you will recognise, like “Marketing, Acme”."), label: tr("Name"), defaultValue: prettyName(r.filename), confirmText: tr("Save name") });
    if (!name || name === prettyName(r.filename)) return;
    try {
      const res = await authFetch(`/api/resumes/${r.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ filename: name }) });
      if (!res.ok) throw new Error();
      setResumes((list) => list.map((x) => (x.id === r.id ? { ...x, filename: name } : x)));
    } catch {
      toast.error(tr("We couldn't rename it. Try again."));
    }
  };

  const download = async (r: Resume, kind: "pdf" | "docx") => {
    try {
      const res = await authFetch(`/api/resumes/${r.id}?format=${kind}`);
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${prettyName(r.filename)}.${kind}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success(tr("Downloaded as {v0}.", { v0: kind.toUpperCase() }));
    } catch {
      toast.error(tr("We couldn't download it. Please try again."));
    }
  };

  const deleteLetter = async (l: Letter) => {
    const ok = await dialog.confirm({ title: tr("Delete this cover letter?"), description: tr("Only the letter is removed. The job and its resume stay."), confirmText: tr("Delete letter"), tone: "danger" });
    if (!ok) return;
    try {
      const res = await authFetch("/api/applications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: l.job.key, profileId: activeProfileId, clearCoverLetter: true }) });
      if (!res.ok) throw new Error();
      setLetters((list) => list.filter((x) => x.job.key !== l.job.key));
    } catch {
      toast.error(tr("We couldn't delete that cover letter."));
    }
  };

  const copyLetter = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(""), 1800);
    } catch {
      toast.error(tr("We couldn't copy it. Select the text and copy it by hand."));
    }
  };

  if (loading || !user) {
    return (
      <div className="mx-auto max-w-[1400px] animate-pulse space-y-4">
        <div className="h-10 w-64 rounded-md bg-muted" />
        <div className="h-96 rounded-2xl bg-muted" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1400px]">
      {/* title, the two shelves and the main button */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <h1 className="text-3xl font-black tracking-tight">{tr("Studio")}</h1>
          <div role="tablist" className="inline-flex rounded-full border bg-card p-1 shadow-sm">
            {[
              { id: "resumes" as const, label: "Resumes", n: resumes.length },
              { id: "letters" as const, label: "Cover letters", n: letters.length },
            ].map((t) => (
              <button
                key={t.id}
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
                className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-all ${tab === t.id ? "bg-blue-600 text-white shadow-md shadow-blue-600/30" : "text-muted-foreground hover:text-foreground"}`}
              >
                {tr(t.label)} {t.n > 0 && <span className="opacity-70">{t.n}</span>}
              </button>
            ))}
          </div>
        </div>
      </div>

      {tab === "resumes" && (
        <div className="mt-4 grid grid-cols-1 items-start gap-6 lg:grid-cols-[15rem_minmax(0,1fr)] xl:grid-cols-[15rem_minmax(0,1fr)_19rem]">
          {/* the rail: every version */}
          <aside aria-label={tr("Versions")} className="space-y-2 lg:sticky lg:top-24">
            <p className="px-1 text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground">{tr("Versions")}</p>
            {isLoadingResumes ? (
              <div className="shimmer h-20 rounded-xl bg-muted" />
            ) : (
              sorted.map((r) => {
                const active = sel?.id === r.id;
                return (
                  <button
                    key={r.id}
                    onClick={() => setSelId(r.id)}
                    className={`relative flex w-full items-center gap-3 rounded-xl border p-2.5 text-left transition-all ${active ? "border-blue-500/60 bg-blue-600/5 shadow-sm" : "bg-card hover:border-blue-500/30"}`}
                  >
                    {active && <motion.span layoutId="rail-bar" className="absolute inset-y-2 -left-px w-1 rounded-full bg-blue-600" />}
                    <span className="h-14 w-11 shrink-0 overflow-hidden rounded-[3px] bg-white shadow-sm ring-1 ring-black/10">
                      <span className="block origin-top-left" style={{ width: "11rem", transform: "scale(0.25)" }} aria-hidden>
                        <PdfPage fileId={r.id} width={176} alt={tr("{v0} preview", { v0: prettyName(r.filename) })} />
                      </span>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{prettyName(r.filename)}</span>
                      <span className="block text-xs capitalize text-muted-foreground">
                        {lookOf(r)} · {ago(r.uploadDate, tr).toLowerCase()}
                      </span>
                    </span>
                  </button>
                );
              })
            )}
            <Link href="/home/resumes/new" className="flex items-center justify-center gap-2 rounded-xl border border-dashed p-3 text-sm font-semibold text-muted-foreground transition-colors hover:border-blue-500 hover:text-blue-500">
              <Plus className="h-4 w-4" />{" "}{tr("New resume")}</Link>
          </aside>

          {/* the stage: the selected resume, big, and what you can do with it */}
          <section className="min-w-0">
            {sel ? (
              <>
                {/* the sheet is sized by the height of the screen, so the sheet and the dock are always seen together */}
                <div className="rounded-2xl bg-muted/40 px-4 pb-9 pt-5">
                  <motion.div
                    key={sel.id}
                    initial={{ opacity: 0, y: 14, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                    style={{ width: "min(100%, max(13rem, calc((100dvh - 17.5rem) * 0.7727)))" }}
                    className="mx-auto overflow-hidden rounded-sm shadow-2xl ring-1 ring-black/10"
                  >
                    <PdfPage fileId={sel.id} width={620} alt={tr("{v0}, first page", { v0: prettyName(sel.filename) })} />
                  </motion.div>
                </div>
                {/* the dock */}
                <div className="mx-auto -mt-6 flex w-fit max-w-full flex-wrap items-center justify-center gap-1 rounded-full border bg-card p-1.5 shadow-xl">
                  <Button onClick={() => download(sel, "pdf")} className="gap-2 rounded-full font-bold">
                    <Download className="h-4 w-4" />{" "}{tr("PDF")}</Button>
                  <Button onClick={() => download(sel, "docx")} variant="ghost" className="gap-2 rounded-full">
                    <FileDown className="h-4 w-4" />{" "}{tr("DOCX")}</Button>
                  <Button onClick={() => setPreviewFileId(sel.id)} variant="ghost" className="gap-2 rounded-full">
                    <FileText className="h-4 w-4" />{" "}{tr("Open")}</Button>
                  <Button onClick={() => rename(sel)} variant="ghost" className="gap-2 rounded-full">
                    <Pencil className="h-4 w-4" />{" "}{tr("Rename")}</Button>
                  <Button onClick={() => handleDelete(sel.id)} variant="ghost" className="gap-2 rounded-full text-red-500 hover:text-red-500">
                    <Trash2 className="h-4 w-4" />{" "}{tr("Delete")}</Button>
                </div>
                <p className="mt-3 hidden text-center text-sm text-muted-foreground 2xl:block">
                  <span className="font-semibold text-foreground">{prettyName(sel.filename)}</span>{" "}{tr("· made")}{" "}{format(new Date(sel.metadata?.createdAt || sel.uploadDate), "d MMMM, HH:mm")} · <span className="capitalize">{lookOf(sel)}</span>{" "}{tr("look")}</p>
              </>
            ) : isLoadingResumes ? (
              <div className="shimmer h-[30rem] rounded-2xl bg-muted" />
            ) : (
              <div className="rounded-2xl border-2 border-dashed px-6 py-24 text-center">
                <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-muted">
                  <FileText className="h-7 w-7 text-muted-foreground" />
                </span>
                <h2 className="text-xl font-extrabold">{tr("Your studio is empty")}</h2>
                <p className="mx-auto mt-1 max-w-sm text-muted-foreground">{tr("Make your first resume from your profile. Every version you make will live here.")}</p>
                <Button asChild className="mt-6 h-11 rounded-full px-6 font-bold">
                  <Link href="/home/resumes/new">{tr("Make my first resume")}</Link>
                </Button>
              </div>
            )}
          </section>

          {/* what applicant tracking systems see */}
          {sel && (
            <aside aria-label={tr("What ATS software sees")} className="min-w-0 xl:sticky xl:top-24">
              <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground">{tr("What ATS software sees")}</p>
              <div className="flex items-center gap-4">
                <Ring value={score} />
                <div>
                  <p className="text-lg font-extrabold leading-tight">{score >= 80 ? tr("Easy to read") : score >= 60 ? tr("Mostly fine") : tr("Needs work")}</p>
                  <p className="text-sm text-muted-foreground">
                    {passed}{" "}{tr("of")}{" "}{checks.length}{" "}{tr("checks pass")}</p>
                </div>
              </div>
              <ul className="mt-5 space-y-3">
                {worst.length === 0 ? (
                  <li className="flex items-start gap-2.5 text-sm">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-500" strokeWidth={3} />{" "}{tr("Every check passes. Nothing to fix.")}</li>
                ) : (
                  worst.slice(0, 5).map((c) => (
                    <li key={c.id} className="flex items-start gap-2.5 text-sm">
                      <AlertTriangle className={`mt-0.5 h-4 w-4 shrink-0 ${c.verdict === "fail" ? "text-red-500" : "text-amber-500"}`} />
                      <span>
                        <span className="block font-semibold">{tr(c.label)}</span>
                        <span className="block text-xs leading-relaxed text-muted-foreground">{c.reason}</span>
                      </span>
                    </li>
                  ))
                )}
              </ul>
              <Button asChild variant="outline" className="mt-5 w-full gap-2 rounded-full font-semibold">
                <Link href="/home/profile">
                  <Pencil className="h-4 w-4" />{" "}{tr("Fix it in my profile")}</Link>
              </Button>
            </aside>
          )}
        </div>
      )}

      {tab === "letters" && (
        <div className="mt-8">
          {letters.length === 0 ? (
            <div className="rounded-2xl border border-dashed px-6 py-14 text-center">
              <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                <FileText className="h-6 w-6 text-muted-foreground" />
              </span>
              <p className="font-semibold">{tr("No cover letters yet")}</p>
              <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{tr("When you prepare an application for a job, Kaizo writes the cover letter and you find it here.")}</p>
              <Button asChild variant="outline" className="mt-5">
                <Link href="/home/job-ads">{tr("Find a job")}</Link>
              </Button>
            </div>
          ) : (
            <ul className="grid gap-5 lg:grid-cols-2">
              {letters.map((l) => (
                <li key={l.job.key} className="flex flex-col rounded-xl border bg-card p-5">
                  <div className="flex items-center gap-3">
                    <CompanyLogo company={l.job.company} logo={l.job.logo} size={40} />
                    <div className="min-w-0">
                      <p className="truncate font-bold">{tr(l.job.title)}</p>
                      <p className="truncate text-sm text-muted-foreground">{l.job.company}</p>
                    </div>
                  </div>
                  <p className="mt-4 line-clamp-6 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{l.coverLetter}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1">
                    <Button variant="ghost" size="sm" onClick={() => copyLetter(l.job.key, l.coverLetter)} className="w-fit gap-1.5 px-0 font-semibold text-blue-500 hover:bg-transparent hover:text-blue-600">
                      {copied === l.job.key ? <Check className="h-4 w-4" /> : <ClipboardCopy className="h-4 w-4" />}
                      {copied === l.job.key ? tr("Copied") : tr("Copy cover letter")}
                    </Button>
                    {l.job.url && (
                      <Button asChild variant="ghost" size="sm" className="w-fit gap-1.5 px-0 font-semibold hover:bg-transparent">
                        <a href={l.job.url} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" />{" "}{tr("Open the posting")}</a>
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => deleteLetter(l)} className="ml-auto w-fit gap-1.5 px-0 font-semibold text-red-500 hover:bg-transparent hover:text-red-600">
                      <Trash2 className="h-4 w-4" />{" "}{tr("Delete")}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <ResumePreviewModal isOpen={!!previewFileId} onClose={() => setPreviewFileId(null)} fileId={previewFileId} />
    </div>
  );
}
