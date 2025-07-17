"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/authContext";
import { useToast } from "@/context/toastContext";
import { Button } from "@/components/ui/button";
import TemplateSelector from "@/components/templateSelector";
import ResumePreviewModal from "@/components/resumePreviewModal";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from "date-fns";
import { Trash2 } from "lucide-react";

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
    fetch("/api/job-ads/parse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: selectedAd.url,
        rawText: selectedAd.rawText,
      }),
    })
      .then((r) => r.json())
      .then((pj: ParsedJob) => setParsed(pj))
      .catch((err) => toast.error((err as Error).message))
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
    } catch (err) {
      console.error("Resume generation error:", err);
      toast.error((err as Error).message);
    } finally {
      setGenerating(false);
    }
  };

  const handleDeleteResume = async (fileId: string) => {
    if (confirm("Are you sure you want to delete this resume?")) {
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

  return (
    <div className="min-h-screen py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Form */}
            <Card>
              <CardHeader>
                <CardTitle>Add Job Ad</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <label className="block">URL</label>
                  <input
                    type="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    className="w-full p-2 bg-neutral-800 rounded border border-neutral-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="https://example.com/job-posting"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block">Or Paste Text</label>
                  <textarea
                    value={rawText}
                    onChange={(e) => setRawText(e.target.value)}
                    className="w-full p-2 bg-neutral-800 rounded border border-neutral-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows={4}
                  />
                </div>
                <Button onClick={handleSave} disabled={loading || (!url && !rawText)} className="w-full">
                  {loading ? "Saving…" : "Save Job Ad"}
                </Button>
              </CardContent>
            </Card>

            {/* AI-Extracted */}
            {selectedAd && (
              <Card>
                <CardHeader>
                  <CardTitle>Job Ad Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <h2 className="text-xl font-semibold">
                    {parsing ? "Extracting…" : parsed?.jobTitle || "Loading…"}
                  </h2>
                  {parsed && (
                    <>
                      <p className="text-sm text-neutral-400">
                        <strong>Company:</strong> {parsed.companyName}
                      </p>
                      <p className="text-sm text-neutral-400">
                        <strong>Posted at:</strong> {parsed.postedAt}
                      </p>
                      {parsed.location && (
                        <p className="text-sm text-neutral-400">
                          <strong>Location:</strong> {parsed.location}
                        </p>
                      )}
                      <div>
                        <h3 className="font-medium">Description</h3>
                        <p className="text-sm whitespace-pre-line break-words">{parsed.description}</p>
                      </div>
                      <div>
                        <h3 className="font-medium">Requirements</h3>
                        <ul className="list-disc list-inside text-sm space-y-1">
                          {(parsed.requirements ?? []).map((r, i) => (
                            <li key={i}>{r}</li>
                          ))}
                        </ul>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Resume Generation */}
            {selectedAd && profiles.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Generate Resume</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <TemplateSelector onTemplateSelect={setSelectedTemplateId} />
                  <div className="flex flex-col sm:flex-row items-center gap-4 mt-4">
                    <select
                      value={selectedProfileId}
                      onChange={(e) => setSelectedProfileId(e.target.value)}
                      className="bg-neutral-800 p-2 rounded border border-neutral-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {profiles.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                    <Button onClick={handleGenerate} disabled={generating || !selectedTemplateId} className="w-full sm:w-auto">
                      {generating ? "Processing…" : "Generate Resume"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-8">
            {/* Previous Job Ads */}
            <Card>
              <CardHeader>
                <CardTitle>Previous Job Ads</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {jobAds.map((ad) => (
                    <li key={ad.id}>
                      <button
                        onClick={() => setSelectedAd(ad)}
                        className={`w-full text-left p-3 rounded-lg transition font-medium border border-transparent ${
                          selectedAd?.id === ad.id
                            ? "bg-blue-600 text-white border-blue-400 shadow"
                            : "bg-neutral-800 hover:bg-neutral-700 text-neutral-200"
                        }`}
                      >
                        <div className="truncate">{ad.jobTitle}</div>
                        <div className="text-xs text-neutral-400 truncate">
                          {ad.companyName} • {new Date(ad.postedAt).toLocaleDateString()}
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            {/* Saved Resumes Section */}
            <Card>
              <CardHeader>
                <CardTitle>Your Saved Resumes</CardTitle>
                <CardDescription>
                  Manage and download your previously generated resumes.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingResumes ? (
                  <p>Loading resumes...</p>
                ) : resumes.length === 0 ? (
                  <p>No resumes saved yet.</p>
                ) : (
                  <div className="space-y-4">
                    {resumes.map((resume) => (
                      <div
                        key={resume.id}
                        className="flex items-center justify-between p-4 border rounded-md cursor-pointer hover:bg-neutral-700 transition"
                        onClick={() => handlePreviewResume(resume.id)}
                      >
                        <div className="min-w-0">
                          <p className="font-semibold truncate max-w-xs" title={resume.filename}>{resume.filename}</p>
                          <p className="text-sm text-muted-foreground truncate max-w-xs" title={`Template: ${resume.metadata.template} | Format: ${resume.metadata.format}${resume.metadata.isGenerated ? ' (AI Generated)' : ''}`}>
                            Template: {resume.metadata.template} | Format: {resume.metadata.format}
                            {resume.metadata.isGenerated && " (AI Generated)"}
                          </p>
                          {resume.profileName && (
                            <p className="text-sm text-muted-foreground truncate max-w-xs" title={`Profile: ${resume.profileName}`}>Profile: {resume.profileName}</p>
                          )}
                          {resume.jobAdTitle && (
                            <p className="text-sm text-muted-foreground truncate max-w-xs" title={`Job Post: ${resume.jobAdTitle}`}>Job Post: {resume.jobAdTitle}</p>
                          )}
                          <p className="text-sm text-muted-foreground truncate max-w-xs" title={`Generated on: ${format(new Date(resume.uploadDate), 'PPP p')}`}>Generated on: {format(new Date(resume.uploadDate), "PPP p")}</p>
                        </div>
                        <div className="flex space-x-2" onClick={e => e.stopPropagation()}>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDeleteResume(resume.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
        <ResumePreviewModal
          isOpen={isPreviewModalOpen}
          onClose={() => setIsPreviewModalOpen(false)}
          fileId={previewFileId}
        />
      </div>
    </div>
  );
}
