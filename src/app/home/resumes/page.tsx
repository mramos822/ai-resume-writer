"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/context/authContext";
import { useRouter } from "next/navigation";
import { useProfile } from "@/context/profileContext";
import { useToast } from "@/context/toastContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { format } from "date-fns";
import { Trash2, Download } from "lucide-react";
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
        const response = await fetch(`/api/resumes?profileId=${activeProfileId}`);
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
    if (confirm("Are you sure you want to delete this resume?")) {
      try {
        const response = await fetch(`/api/resumes?fileId=${fileId}`, {
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
      <div className="flex items-center justify-center h-screen">
        <p className="text-lg">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
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
              <p>No resumes saved yet. Generate one from the{" "}
                <Link href="/home/job-ads" className="text-blue-400 hover:underline">
                  Generate Resume
                </Link>{" "}page.
              </p>
            ) : (
              <div className="space-y-4">
                {resumes.map((resume) => (
                  <div key={resume.id} className="flex items-center justify-between p-4 border rounded-md">
                    <div>
                      <p className="font-semibold">{resume.filename}</p>
                      <p className="text-sm text-muted-foreground">
                        Template: {resume.metadata.template} | Format: {resume.metadata.format}
                        {resume.metadata.isGenerated && " (AI Generated)"}
                      </p>
                      {resume.profileName && (
                        <p className="text-sm text-muted-foreground">
                          Profile: {resume.profileName}
                        </p>
                      )}
                      {resume.jobAdTitle && (
                        <p className="text-sm text-muted-foreground">
                          Job Post: {resume.jobAdTitle}
                        </p>
                      )}
                      <p className="text-sm text-muted-foreground">
                        Generated on: {format(new Date(resume.uploadDate), "PPP p")}
                      </p>
                    </div>
                    <div className="flex space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePreview(resume.id)}
                      >
                        <Download className="h-4 w-4 mr-2" /> View/Download
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDelete(resume.id)}
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
      <ResumePreviewModal
        isOpen={isPreviewModalOpen}
        onClose={() => setIsPreviewModalOpen(false)}
        fileId={previewFileId}
      />
    </div>
  );
}
