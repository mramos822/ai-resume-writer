"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/context/authContext";
import { useRouter } from "next/navigation";
import { useProfile } from "@/context/profileContext";
import { useToast } from "@/context/toastContext";
import { useDialog } from "@/context/dialogContext";
import { authFetch } from "@/lib/authFetch";
import PageHeader from "@/components/pageHeader";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { format } from "date-fns";
import { Trash2, Eye, FileText, Wand2, Briefcase, User, CalendarDays, Plus } from "lucide-react";
import ResumePreviewModal from "@/components/resumePreviewModal";

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

export default function ResumesPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { activeProfileId } = useProfile();
  const toast = useToast();
  const dialog = useDialog();
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [isLoadingResumes, setIsLoadingResumes] = useState(true);
  const [previewFileId, setPreviewFileId] = useState<string | null>(null);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/");
    }
  }, [user, loading, router]);

  useEffect(() => {
    const fetchResumes = async () => {
      if (!activeProfileId) return;

      setIsLoadingResumes(true);
      try {
        const response = await authFetch(`/api/resumes?profileId=${activeProfileId}`);
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
  }, [activeProfileId, toast]);

  const handleDelete = async (fileId: string) => {
    const ok = await dialog.confirm({
      title: "Delete this resume?",
      description: "The PDF will be permanently removed from your library.",
      confirmText: "Delete resume",
      tone: "danger",
    });
    if (ok) {
      try {
        const response = await authFetch(`/api/resumes?fileId=${fileId}`, {
          method: "DELETE",
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

  const handlePreview = (fileId: string) => {
    setPreviewFileId(fileId);
    setIsPreviewModalOpen(true);
  };

  if (loading || !user) {
    return (
      <div className="mx-auto max-w-6xl animate-pulse space-y-4">
        <div className="h-10 w-64 rounded-md bg-muted" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-56 rounded-lg bg-muted" />
          ))}
        </div>
      </div>
    );
  }

  const TEMPLATE_TONE: Record<string, string> = {
    modern: "bg-blue-100 text-blue-700",
    classic: "bg-amber-100 text-amber-700",
    creative: "bg-rose-100 text-rose-700",
  };

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Your resumes"
        subtitle="Every resume you've made, saved in one place. Open one to preview it or download the PDF."
        tip={resumes.length > 0 ? "Click a card to preview it and download the PDF." : undefined}
        actions={
          <Button asChild className="gap-2">
            <Link href="/home/job-ads">
              <Plus className="h-4 w-4" /> New resume
            </Link>
          </Button>
        }
      />

      {isLoadingResumes ? (
        <div className="grid animate-pulse gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-56 rounded-lg bg-muted" />
          ))}
        </div>
      ) : resumes.length === 0 ? (
        <div className="flex flex-col items-center rounded-lg border-2 border-dashed bg-card/60 px-6 py-16 text-center">
          <span className="mb-4 flex h-16 w-16 items-center justify-center rounded-md bg-accent text-blue-600">
            <FileText className="h-8 w-8" />
          </span>
          <h2 className="text-xl font-bold">No resumes yet</h2>
          <p className="mt-1 max-w-md text-muted-foreground">
            Your first one is only a couple of steps away: add a job posting, pick a template, and let Kaizo write it.
          </p>
          <Button asChild className="mt-6 gap-2">
            <Link href="/home/job-ads">
              <Wand2 className="h-4 w-4" /> Make my first resume
            </Link>
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {resumes.map((resume, i) => {
            const tone = TEMPLATE_TONE[resume.metadata.template] ?? "bg-muted text-muted-foreground";
            return (
              <div
                key={resume.id}
                style={{ animationDelay: `${i * 60}ms` }}
                className="animate-pop-in group flex flex-col overflow-hidden rounded-lg border bg-card transition-all hover:-translate-y-1 hover:shadow-lg"
              >
                <button
                  onClick={() => handlePreview(resume.id)}
                  className="flex flex-1 flex-col p-5 text-left"
                >
                  <div className="mb-4 flex items-center justify-between">
                    <span className="flex h-11 w-11 items-center justify-center rounded-md bg-accent text-blue-600">
                      <FileText className="h-5 w-5" />
                    </span>
                    <span className={`rounded-md px-2.5 py-1 text-xs font-semibold capitalize ${tone}`}>
                      {resume.metadata.template}
                    </span>
                  </div>
                  <p className="line-clamp-2 text-base font-bold leading-snug" title={resume.filename}>
                    {resume.jobAdTitle || resume.filename}
                  </p>
                  {resume.jobAdTitle && (
                    <p className="mt-1 truncate text-xs text-muted-foreground" title={resume.filename}>
                      {resume.filename}
                    </p>
                  )}

                  <div className="mt-4 space-y-1.5 text-sm text-muted-foreground">
                    {resume.profileName && (
                      <p className="flex items-center gap-2">
                        <User className="h-4 w-4 shrink-0" /> {resume.profileName}
                      </p>
                    )}
                    {resume.jobAdTitle && (
                      <p className="flex items-center gap-2">
                        <Briefcase className="h-4 w-4 shrink-0" />
                        <span className="truncate">Made for this job</span>
                      </p>
                    )}
                    <p className="flex items-center gap-2">
                      <CalendarDays className="h-4 w-4 shrink-0" />
                      {format(new Date(resume.uploadDate), "PPP")}
                    </p>
                  </div>
                </button>

                <div className="flex items-center gap-2 border-t bg-muted/40 p-3">
                  <Button size="sm" className="flex-1 gap-2" onClick={() => handlePreview(resume.id)}>
                    <Eye className="h-4 w-4" /> Preview and download
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDelete(resume.id)}
                    aria-label="Delete resume"
                    title="Delete resume"
                    className="text-red-600 hover:bg-red-50 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ResumePreviewModal
        isOpen={isPreviewModalOpen}
        onClose={() => setIsPreviewModalOpen(false)}
        fileId={previewFileId}
      />
    </div>
  );
}
