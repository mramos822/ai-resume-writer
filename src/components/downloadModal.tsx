"use client";

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { useEffect, useState } from "react";
import Image from "next/image";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useToast } from "@/context/toastContext";

interface Template {
    id: string;
    name: string;
    description: string;
    imageUrl: string;
}

interface DownloadModalProps {
    isOpen: boolean;
    onClose: () => void;
    profileId: string;
}

export default function DownloadModal({ isOpen, onClose, profileId }: DownloadModalProps) {
    const [templates, setTemplates] = useState<Template[]>([]);
    const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
    const [outputFormat, setOutputFormat] = useState("pdf");
    const [isProcessing, setIsProcessing] = useState(false);
    const toast = useToast();

    useEffect(() => {
        if (isOpen) {
            fetch("/api/templates")
                .then((res) => res.json())
                .then((data) => {
                    setTemplates(data);
                    if (data.length > 0) {
                        setSelectedTemplate(data[0].id); // Default to first template
                    }
                });
        }
    }, [isOpen]);

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                    <DialogTitle>Download Resume</DialogTitle>
                    <Button
                        variant="ghost"
                        className="absolute top-4 right-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground"
                        onClick={onClose}
                    >
                        <X className="h-4 w-4" />
                        <span className="sr-only">Close</span>
                    </Button>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-3 gap-4">
                        {templates.map((template) => (
                            <div
                                key={template.id}
                                className={`cursor-pointer border-2 rounded-lg p-2 ${
                                    selectedTemplate === template.id
                                        ? "border-blue-500"
                                        : "border-transparent"
                                }`}
                                onClick={() => setSelectedTemplate(template.id)}
                            >
                                <Image
                                    src={template.imageUrl}
                                    alt={template.name}
                                    width={150}
                                    height={200}
                                    className="rounded-md"
                                />
                                <h3 className="text-lg font-semibold mt-2">{template.name}</h3>
                                <p className="text-sm text-gray-500">{template.description}</p>
                            </div>
                        ))}
                    </div>
                    <div className="mt-4">
                        <h4 className="text-md font-semibold mb-2">Output Format</h4>
                        <RadioGroup defaultValue="pdf" onValueChange={setOutputFormat}>
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="pdf" id="pdf" />
                                <Label htmlFor="pdf">PDF</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="docx" id="docx" />
                                <Label htmlFor="docx">DOCX</Label>
                            </div>
                        </RadioGroup>
                    </div>
                    <div className="mt-6 flex justify-end">
                        <Button
                            onClick={async () => {
                                if (!selectedTemplate) return;
                                setIsProcessing(true);
                                try {
                                    const response = await fetch('/api/generate-resume', {
                                        method: 'POST',
                                        headers: {
                                            'Content-Type': 'application/json',
                                        },
                                        body: JSON.stringify({
                                            template: selectedTemplate,
                                            format: outputFormat,
                                            profileId: profileId,
                                        }),
                                    });
                                    if (!response.ok) {
                                        const errText = await response.text();
                                        throw new Error(errText || 'Failed to generate resume');
                                    }
                                    const blob = await response.blob();
                                    const url = window.URL.createObjectURL(blob);
                                    const a = document.createElement('a');
                                    a.href = url;
                                    a.download = `resume.${outputFormat}`;
                                    document.body.appendChild(a);
                                    a.click();
                                    a.remove();
                                    toast.success('Resume generated and downloaded!');
                                } catch (err) {
                                    let message = 'Failed to generate resume. Please try again.';
                                    if (err instanceof Error && err.message) {
                                        message = err.message;
                                    }
                                    toast.error(message);
                                } finally {
                                    setIsProcessing(false);
                                }
                            }}
                            disabled={!selectedTemplate || isProcessing}
                        >
                            {isProcessing ? (
                                <>
                                    <span className="w-4 h-4 mr-2 border-2 border-blue-500 border-t-transparent rounded-full animate-spin inline-block align-middle" />
                                    Processing...
                                </>
                            ) : (
                                'Download'
                            )}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
