"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/authContext";
import { useToast } from "@/context/toastContext";
import { useDialog } from "@/context/dialogContext";
import { authFetch } from "@/lib/authFetch";
import { Button } from "@/components/ui/button";
import TemplateSelector from "@/components/templateSelector";
import ResumePreviewModal from "@/components/resumePreviewModal";
import PageHeader from "@/components/pageHeader";
import Link from "next/link";
import { format } from "date-fns";
import { Trash2, Plus, Building2, MapPin, Wand2, FileText, ClipboardPaste, X, ChevronDown, ArrowRight } from "lucide-react";

interface JobAd {
  id: string;
  url?: string;
  rawText?: string;
  companyName: string;
  jobTitle: string;
  postedAt: string;
  previewHtml: string;
}

interface Resume {
  id: string;
  filename: string;
  uploadDate: string;
  metadata: {
    profileId: string;
    template: string;
    format: string;
    createdAt: string;
    jobAdId?: string; // Optional, as not all resumes might be linked to a job ad
    isGenerated?: boolean; // Added to mark generated resumes
  };
  profileName?: string; // Added profileName
  jobAdTitle?: string; // Added jobAdTitle
}

interface ParsedJob {
  jobTitle: string;
  companyName: string;
  postedAt: string;
  location?: string;
  description: string;
  requirements: string[];
}

export default function JobAdsPage() {
  const { user } = useAuth();
  const toast = useToast();
  const dialog = useDialog();

  const [url, setUrl] = useState("");
  const [rawText, setRawText] = useState("");
  const [jobAds, setJobAds] = useState<JobAd[]>([]);
  const [selectedAd, setSelectedAd] = useState<JobAd | null>(null);
  const [parsed, setParsed] = useState<ParsedJob | null>(null);
  const [loading, setLoading] = useState(false);
  const [parsing, setParsing] = useState(false);

  // NEW: profiles for resume gen
  const [profiles, setProfiles] = useState<{ id: string; name: string }[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string>("");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [generating, setGenerating] = useState(false);
  const [previewFileId, setPreviewFileId] = useState<string | null>(null);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);

  // NEW: State for saved resumes
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [isLoadingResumes, setIsLoadingResumes] = useState(true);

  // Load job ads + profiles + resumes on mount
  useEffect(() => {
    if (!user) return;
    const tokenPromise = user.getIdToken();

    tokenPromise.then((token) => {
      fetch("/api/job-ads", {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((r) => r.json())
        .then((ads: JobAd[]) => {
          setJobAds(ads);
          if (ads.length > 0) setSelectedAd(ads[0]);
        })
        .catch(console.error);

      fetch("/api/profiles", {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((r) => r.json())
        .then((plist: { id: string; name: string }[]) => {
          setProfiles(plist);
          if (plist.length > 0) setSelectedProfileId(plist[0].id);
        })
        .catch(console.error);
    });

    // Fetch saved resumes
    const fetchResumes = async () => {
      if (!user || !selectedProfileId) return; // Ensure user and profileId are loaded
      setIsLoadingResumes(true);
      try {
        const token = await user.getIdToken(); // Get token here
        const response = await fetch(`/api/resumes?profileId=${selectedProfileId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) {
          throw new Error("Failed to fetch resumes");
        }
        const data: Resume[] = await response.json();
        setResumes(data);
      } catch (error) {
        console.error("Error fetching resumes:", error);
        toast.error("Failed to load resumes.");
      } finally {
        setIsLoadingResumes(false);
      }
    };

    fetchResumes();
  }, [user, selectedProfileId, toast]); // Depend on user, selectedProfileId, and toast

  // Re-parse when selectedAd changes
  useEffect(() => {
    if (!selectedAd) {
      setParsed(null);
      return;
    }
    setParsing(true);
    authFetch("/api/job-ads/parse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: selectedAd.url,
        rawText: selectedAd.rawText,
      }),
    })
      .then(async (r) => {
        const pj = await r.json();
        if (!r.ok) throw new Error(pj.error || "Could not parse this job ad");
        return pj as ParsedJob;
      })
      .then((pj) => setParsed(pj))
      .catch((err) => {
        setParsed(null);
        toast.error((err as Error).message);
      })
      .finally(() => setParsing(false));
  }, [selectedAd, toast]); // Added toast to dependency array

  // Save a new ad
  const handleSave = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/job-ads", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url: url || undefined, rawText: rawText || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");

      const newAd: JobAd = {
        id: data.id,
        url: data.url,
        rawText: data.rawText,
        companyName: data.companyName,
        jobTitle: data.jobTitle,
        postedAt: data.postedAt,
        previewHtml: data.previewHtml,
      };

      setJobAds((prev) => [newAd, ...prev]);
      setSelectedAd(newAd);
      setUrl("");
      setRawText("");
      toast.success("Job ad saved!");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  // NEW: Generate resume
  const handleGenerate = async () => {
    if (!user || !selectedAd || !selectedProfileId || !selectedTemplateId) return;
    setGenerating(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/generate-resume", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          profileId: selectedProfileId,
          template: selectedTemplateId,
          format: 'pdf',
          jobAdId: selectedAd.id, // Pass the jobAdId
        }),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        console.error("Resume generation failed:", errorData);
        toast.error(errorData.error || "Generation failed");
        return;
      }
      const data = await res.json();
      console.log("Resume generation response:", data);
      const { fileId } = data;
      if (!fileId) {
        toast.error("Resume generation did not return a fileId.");
        return;
      }
      setPreviewFileId(fileId);
      setIsPreviewModalOpen(true);
      toast.success("Resume generated and saved!");

      // Tell people when we had to adjust their resume to fit
      if (typeof data.scale === "number" && data.scale < 0.8) {
        toast.info("Your resume is long, so we shrank the text to keep it on one page. Removing older or less relevant items will make it easier to read.");
      }
      if (Array.isArray(data.droppedChars) && data.droppedChars.length > 0) {
        toast.info(`Some characters (${data.droppedChars.slice(0, 6).join(" ")}) can't be shown in the PDF and were left out.`);
      }

      // Show the new resume in "latest resumes" right away
      authFetch(`/api/resumes?profileId=${selectedProfileId}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((list: Resume[] | null) => {
          if (list) setResumes(list);
        })
        .catch(() => {});
    } catch (err) {
      console.error("Resume generation error:", err);
      toast.error((err as Error).message);
    } finally {
      setGenerating(false);
    }
  };

  const handleDeleteJobAd = async (adId: string) => {
    if (!user) return;
    const ok = await dialog.confirm({
      title: "Delete this job ad?",
      description: "The saved posting and its advice will be removed. Resumes you already generated stay in your library.",
      confirmText: "Delete job ad",
      tone: "danger",
    });
    if (!ok) return;
    try {
      const token = await user.getIdToken();
      const res = await fetch(`/api/job-ads?id=${adId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to delete job ad");
      setJobAds((prev) => prev.filter((ad) => ad.id !== adId));
      if (selectedAd?.id === adId) setSelectedAd(null);
      toast.success("Job ad deleted");
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const handleDeleteResume = async (fileId: string) => {
    const ok = await dialog.confirm({
      title: "Delete this resume?",
      description: "The PDF will be permanently removed from your library.",
      confirmText: "Delete resume",
      tone: "danger",
    });
    if (ok) {
      try {
        const token = await user?.getIdToken();
        const response = await fetch(`/api/resumes?fileId=${fileId}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) {
          throw new Error("Failed to delete resume");
        }
        setResumes(resumes.filter((resume) => resume.id !== fileId));
        toast.success("Resume deleted successfully!");
      } catch (error) {
        console.error("Error deleting resume:", error);
        toast.error("Failed to delete resume.");
      }
    }
  };

  const handlePreviewResume = (fileId: string) => {
    setPreviewFileId(fileId);
    setIsPreviewModalOpen(true);
  };

  // One box for everything: a link or the pasted text
  const [adInput, setAdInput] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [showAllReqs, setShowAllReqs] = useState(false);

  useEffect(() => {
    if (!url && !rawText) setAdInput("");
  }, [url, rawText]);

  const onAdInput = (value: string) => {
    setAdInput(value);
    const v = value.trim();
    if (/^https?:\/\/\S+$/i.test(v)) {
      setUrl(v);
      setRawText("");
    } else {
      setUrl("");
      setRawText(value);
    }
  };

  const hasAds = jobAds.length > 0;
  const formOpen = showAdd || !hasAds;
  const reqs = parsed?.requirements ?? [];
  const shownReqs = showAllReqs ? reqs : reqs.slice(0, 5);
  const singleProfile = profiles.length <= 1;
  const latest = resumes.slice(0, 3);

  const onSaveAd = async () => {
    await handleSave();
    setShowAdd(false);
  };

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Make a resume for a job"
        subtitle="Paste the job you want. We'll write a resume that fits it."
      />

      {/* ---------- your saved jobs ---------- */}
      {hasAds && (
        <div className="mb-6">
          <p className="mb-2 text-sm font-semibold text-muted-foreground">Your jobs</p>
          <ul className="flex flex-wrap gap-2">
            {jobAds.map((ad) => {
              const active = selectedAd?.id === ad.id;
              return (
                <li
                  key={ad.id}
                  className={`group flex max-w-full items-center rounded-md border text-sm transition-colors ${
                    active
                      ? "border-blue-600 bg-blue-600 text-white"
                      : "bg-card hover:border-blue-300 hover:bg-accent"
                  }`}
                >
                  <button
                    onClick={() => {
                      setSelectedAd(ad);
                      setShowAllReqs(false);
                      setShowAdd(false);
                    }}
                    className="min-w-0 py-2 pl-3 pr-2 text-left"
                    title={`${ad.jobTitle} · ${ad.companyName}`}
                  >
                    <span className="block max-w-[14rem] truncate font-semibold">{ad.jobTitle}</span>
                    <span className={`block max-w-[14rem] truncate text-xs ${active ? "text-blue-100" : "text-muted-foreground"}`}>
                      {ad.companyName}
                    </span>
                  </button>
                  <button
                    onClick={() => handleDeleteJobAd(ad.id)}
                    aria-label={`Delete ${ad.jobTitle}`}
                    title="Delete this job"
                    className={`mr-1 rounded p-1.5 transition-colors ${
                      active ? "text-blue-100 hover:bg-white/20" : "text-muted-foreground hover:bg-red-50 hover:text-red-600"
                    }`}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </li>
              );
            })}
            <li>
              <button
                onClick={() => setShowAdd((v) => !v)}
                className="flex h-full items-center gap-1.5 rounded-md border border-dashed px-3 py-2 text-sm font-semibold text-blue-600 hover:border-blue-400 hover:bg-accent"
              >
                <Plus className="h-4 w-4" /> Add another job
              </button>
            </li>
          </ul>
        </div>
      )}

      {/* ---------- add a job ---------- */}
      {formOpen && (
        <section className="animate-pop-in mb-6 rounded-lg border bg-card p-6">
          <div className="mb-4 flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-accent text-blue-600">
              <ClipboardPaste className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-lg font-bold leading-tight">Which job do you want?</h2>
              <p className="text-sm text-muted-foreground">
                Paste the link to the posting, or copy and paste the whole description.
              </p>
            </div>
          </div>
          <textarea
            value={adInput}
            onChange={(e) => onAdInput(e.target.value)}
            rows={5}
            aria-label="Job posting link or text"
            placeholder="Paste a link like https://company.com/jobs/123, or the job description text here…"
            className="w-full resize-y rounded-md border border-input bg-background px-3 py-3 text-sm placeholder:text-muted-foreground focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
          />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              {url ? "Looks like a link. We'll read the page for you." : rawText ? "We'll use the text you pasted." : "Nothing pasted yet."}
            </p>
            <div className="flex gap-2">
              {hasAds && (
                <Button variant="ghost" onClick={() => setShowAdd(false)}>
                  Cancel
                </Button>
              )}
              <Button onClick={onSaveAd} disabled={loading || (!url && !rawText)} className="h-11 gap-2 px-6">
                {loading ? "Reading the job…" : "Continue"} {!loading && <ArrowRight className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </section>
      )}

      {/* ---------- the selected job ---------- */}
      {selectedAd && (
        <section className="animate-pop-in mb-6 rounded-lg border bg-card p-6">
          {parsing || !parsed ? (
            <div className="space-y-3">
              <p className="text-sm font-medium text-blue-600">Reading the job…</p>
              <div className="shimmer h-6 w-2/3 rounded bg-muted" />
              <div className="shimmer h-3 w-1/3 rounded bg-muted" />
              <div className="shimmer h-3 w-full rounded bg-muted" />
              <div className="shimmer h-3 w-5/6 rounded bg-muted" />
            </div>
          ) : (
            <>
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">Going for</p>
              <h2 className="mt-1 text-2xl font-extrabold leading-tight">{parsed.jobTitle}</h2>
              <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <Building2 className="h-4 w-4" /> {parsed.companyName}
                </span>
                {parsed.location && (
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="h-4 w-4" /> {parsed.location}
                  </span>
                )}
              </div>

              {reqs.length > 0 && (
                <div className="mt-5">
                  <p className="mb-2 text-sm font-semibold">What they&apos;re looking for</p>
                  <ul className="flex flex-wrap gap-2">
                    {shownReqs.map((r, i) => (
                      <li key={i} className="rounded-md bg-accent px-3 py-1.5 text-sm text-foreground">
                        {r}
                      </li>
                    ))}
                  </ul>
                  {reqs.length > 5 && (
                    <button
                      onClick={() => setShowAllReqs((v) => !v)}
                      className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-blue-600 hover:underline"
                    >
                      {showAllReqs ? "Show less" : `Show all ${reqs.length}`}
                      <ChevronDown className={`h-4 w-4 transition-transform ${showAllReqs ? "rotate-180" : ""}`} />
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </section>
      )}

      {/* ---------- make the resume ---------- */}
      {selectedAd && profiles.length > 0 && (
        <section className="animate-pop-in mb-10 rounded-lg border-2 border-blue-200 bg-card p-6">
          <div className="mb-5 flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-blue-600 text-white">
              <Wand2 className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-lg font-bold leading-tight">Pick a look and make it</h2>
              <p className="text-sm text-muted-foreground">You can try the other looks afterwards. Nothing gets lost.</p>
            </div>
          </div>

          <TemplateSelector onTemplateSelect={setSelectedTemplateId} />

          {!singleProfile && (
            <div className="mt-5">
              <label htmlFor="profile-pick" className="mb-1.5 block text-sm font-semibold">
                Use details from
              </label>
              <select
                id="profile-pick"
                value={selectedProfileId}
                onChange={(e) => setSelectedProfileId(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20 sm:w-72"
              >
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <Button
            onClick={handleGenerate}
            disabled={generating || !selectedTemplateId || parsing}
            className="mt-6 h-12 w-full gap-2 text-base"
          >
            <Wand2 className="h-5 w-5" />
            {generating ? "Writing your resume…" : "Make my resume"}
          </Button>

          {generating && (
            <div className="mt-4">
              <div className="h-2 overflow-hidden rounded-full bg-border">
                <div className="shimmer h-full w-2/3 rounded-full bg-blue-500" />
              </div>
              <p className="mt-2 text-center text-xs text-muted-foreground">
                This takes a few seconds. Your resume will open when it&apos;s ready.
              </p>
            </div>
          )}
        </section>
      )}

      {/* ---------- latest resumes ---------- */}
      {!isLoadingResumes && latest.length > 0 && (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-base font-bold">
              <FileText className="h-4 w-4 text-blue-600" /> Your latest resumes
            </h2>
            <Link href="/home/resumes" className="text-sm font-semibold text-blue-600 hover:underline">
              See all
            </Link>
          </div>
          <ul className="grid gap-3 sm:grid-cols-3">
            {latest.map((resume) => (
              <li key={resume.id} className="group relative">
                <button
                  onClick={() => handlePreviewResume(resume.id)}
                  className="w-full rounded-lg border bg-card p-4 text-left transition-all hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md"
                  title={resume.filename}
                >
                  <p className="truncate pr-6 text-sm font-semibold">{resume.jobAdTitle || resume.filename}</p>
                  <p className="mt-0.5 truncate text-xs capitalize text-muted-foreground">
                    {resume.metadata.template} · {format(new Date(resume.uploadDate), "PP")}
                  </p>
                </button>
                <button
                  onClick={() => handleDeleteResume(resume.id)}
                  aria-label="Delete resume"
                  title="Delete resume"
                  className="absolute right-2 top-2 rounded p-1.5 text-muted-foreground opacity-0 transition hover:bg-red-50 hover:text-red-600 focus:opacity-100 group-hover:opacity-100"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <ResumePreviewModal
        isOpen={isPreviewModalOpen}
        onClose={() => setIsPreviewModalOpen(false)}
        fileId={previewFileId}
      />
    </div>
  );
}
