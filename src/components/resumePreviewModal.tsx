"use client";

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogClose // Import DialogClose
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react"; // Removed X
import { useEffect, useState } from "react";
import { useToast } from "@/context/toastContext";
import { authFetch } from "@/lib/authFetch";

interface ResumePreviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    fileId: string | null;
}

export default function ResumePreviewModal({ isOpen, onClose, fileId }: ResumePreviewModalProps) {
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
                    if (!res.ok) throw new Error("Could not open this resume.");
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
                    if (!cancelled) toast.error("We couldn't open that resume. Please try again.");
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
                throw new Error("Failed to download file.");
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
            toast.success(`Resume downloaded as ${format.toUpperCase()}!`);
        } catch (error) {
            toast.error(`Failed to download resume: ${(error as Error).message}`);
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
            if (!res.ok) throw new Error('Failed to rename file');
            setFilename(newFilename);
            setEditing(false);
            toast.success('Filename updated!');
        } catch {
            toast.error('Failed to rename file');
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-4xl h-[90vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>Resume Preview</DialogTitle>
                    <div className="flex items-center space-x-2 mt-2">
                        {editing ? (
                            <>
                                <input
                                    className="border rounded px-2 py-1 text-sm"
                                    value={newFilename}
                                    onChange={e => setNewFilename(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter') handleRename(); }}
                                    autoFocus
                                />
                                <Button size="sm" variant="outline" onClick={handleRename}>Save</Button>
                                <Button size="sm" variant="ghost" onClick={() => { setEditing(false); setNewFilename(filename); }}>Cancel</Button>
                            </>
                        ) : (
                            <>
                                <span className="font-semibold text-base">{filename}</span>
                                <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>Rename</Button>
                            </>
                        )}
                    </div>
                    <DialogClose asChild>
                        <Button
                            variant="ghost"
                            className="absolute top-4 right-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground"
                            onClick={onClose}
                        >
                            <span className="sr-only">Close</span>
                        </Button>
                    </DialogClose>
                </DialogHeader>
                <div className="flex-grow flex flex-col overflow-hidden">
                    {pdfUrl ? (
                        <iframe src={pdfUrl} className="w-full h-full border-none" title="Resume Preview" />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center">
                            <p>Loading preview...</p>
                        </div>
                    )}
                </div>
                <div className="flex justify-end space-x-2 p-4 border-t">
                    <Button onClick={() => handleDownload('pdf')}>
                        <Download className="mr-2 h-4 w-4" /> Download as PDF
                    </Button>
                    <Button onClick={() => handleDownload('docx')}>
                        <Download className="mr-2 h-4 w-4" /> Download as DOCX
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
