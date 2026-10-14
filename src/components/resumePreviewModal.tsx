"use client";

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogClose // Import DialogClose
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, FileText, Loader2, Pencil, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useToast } from "@/context/toastContext";
import { authFetch } from "@/lib/authFetch";
import { useT } from "@/i18n/provider";

interface ResumePreviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    fileId: string | null;
}

export default function ResumePreviewModal({ isOpen, onClose, fileId }: ResumePreviewModalProps) {
  const { tr } = useT();
    const [pdfUrl, setPdfUrl] = useState<string | null>(null);
    const [filename, setFilename] = useState<string>("");
    const [editing, setEditing] = useState(false);
    const [newFilename, setNewFilename] = useState("");
    const toast = useToast();

    useEffect(() => {
        let objectUrl: string | null = null;
        let cancelled = false;

        if (isOpen && fileId) {
            setPdfUrl(null);
            // The PDF is fetched with the user's token and shown from a local blob URL
            authFetch(`/api/resumes/${fileId}?view=true`)
                .then(async (res) => {
                    if (!res.ok) throw new Error(tr("Could not open this resume."));
                    const name = decodeURIComponent(res.headers.get("X-Filename") || "");
                    const blob = await res.blob();
                    if (cancelled) return;
                    objectUrl = URL.createObjectURL(blob);
                    setPdfUrl(objectUrl);
                    if (name) {
                        setFilename(name);
                        setNewFilename(name);
                    }
                })
                .catch(() => {
                    if (!cancelled) toast.error(tr("We couldn't open that resume. Please try again."));
                });
        } else {
            setPdfUrl(null);
            setFilename("");
            setNewFilename("");
        }

        return () => {
            cancelled = true;
            if (objectUrl) URL.revokeObjectURL(objectUrl);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, fileId]);

    const handleDownload = async (format: 'pdf' | 'docx') => {
        if (!fileId) return;
        try {
            const response = await authFetch(`/api/resumes/${fileId}?format=${format}`);
            if (!response.ok) {
                throw new Error(tr("Failed to download file."));
            }
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${filename || 'resume'}.${format}`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
            toast.success(tr("Resume downloaded as {v0}!", { v0: format.toUpperCase() }));
        } catch (error) {
            toast.error(tr("Failed to download resume: {message}", { message: (error as Error).message }));
        }
    };

    const handleRename = async () => {
        if (!fileId || !newFilename || newFilename === filename) return;
        try {
            const res = await authFetch(`/api/resumes/${fileId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filename: newFilename })
            });
            if (!res.ok) throw new Error(tr("Failed to rename file"));
            setFilename(newFilename);
            setEditing(false);
            toast.success(tr("Filename updated!"));
        } catch {
            toast.error(tr("Failed to rename file"));
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(o) => { if (!o) onClose(); }}>
            <DialogContent
                showCloseButton={false}
                className="flex h-[92vh] max-h-[92vh] flex-col gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-5xl"
            >
                {/* header: what this is and its name on the left, the close button aligned on the right */}
                <DialogHeader className="flex flex-row items-center justify-between gap-4 space-y-0 border-b px-5 py-3.5 text-left">
                    <div className="flex min-w-0 items-center gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-600/10 text-blue-600">
                            <FileText className="h-5 w-5" />
                        </span>
                        <div className="min-w-0">
                            <DialogTitle className="text-base font-bold leading-tight">{tr("Resume preview")}</DialogTitle>
                            {editing ? (
                                <div className="mt-1 flex items-center gap-2">
                                    <input
                                        className="h-8 w-56 rounded-md border bg-transparent px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50"
                                        value={newFilename}
                                        onChange={e => setNewFilename(e.target.value)}
                                        onKeyDown={e => { if (e.key === 'Enter') handleRename(); if (e.key === 'Escape') { setEditing(false); setNewFilename(filename); } }}
                                        autoFocus
                                    />
                                    <Button size="sm" onClick={handleRename}>{tr("Save")}</Button>
                                    <Button size="sm" variant="ghost" onClick={() => { setEditing(false); setNewFilename(filename); }}>{tr("Cancel")}</Button>
                                </div>
                            ) : (
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <span className="truncate">{filename || tr("Loading…")}</span>
                                    {filename && (
                                        <button onClick={() => setEditing(true)} className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium hover:bg-accent hover:text-foreground">
                                            <Pencil className="h-3 w-3" />{" "}{tr("Rename")}</button>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                    <DialogClose asChild>
                        <button
                            type="button"
                            aria-label={tr("Close")}
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </DialogClose>
                </DialogHeader>

                {/* the resume on a grey desk */}
                <div className="relative min-h-0 flex-1 bg-neutral-200/70 dark:bg-neutral-900">
                    {pdfUrl ? (
                        // the viewer's own toolbar (download / print) is hidden: the buttons below are the way to download
                        <iframe
                            src={`${pdfUrl}#toolbar=0&navpanes=0&scrollbar=0&statusbar=0&view=FitH`}
                            className="h-full w-full border-none"
                            title={tr("Resume Preview")}
                        />
                    ) : (
                        <div className="flex h-full w-full flex-col items-center justify-center gap-3 text-muted-foreground">
                            <Loader2 className="h-6 w-6 animate-spin" />
                            <p className="text-sm">{tr("Opening your resume…")}</p>
                        </div>
                    )}
                </div>

                <div className="flex items-center justify-end gap-3 border-t bg-background px-5 py-3.5">
                    <Button variant="outline" onClick={() => handleDownload('docx')} disabled={!pdfUrl} className="h-10 gap-2 px-5">
                        <Download className="h-4 w-4" />{" "}{tr("Download as DOCX")}</Button>
                    <Button onClick={() => handleDownload('pdf')} disabled={!pdfUrl} className="h-10 gap-2 px-5">
                        <Download className="h-4 w-4" />{" "}{tr("Download as PDF")}</Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
