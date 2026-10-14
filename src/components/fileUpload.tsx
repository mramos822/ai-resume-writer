// src/components/FileUpload.tsx
"use client";

import React, { useState } from "react";
import { useDropzone } from "react-dropzone";
import { AnimatePresence, motion } from "framer-motion";

import { Upload } from "@/components/icons/uploadField";
import { FileText } from "@/components/icons/fileText";
import { File as FileIcon } from "@/components/icons/file";
import { X } from "@/components/icons/X";
import { CheckCircle } from "@/components/icons/checkCircle";
import { AlertCircle } from "@/components/icons/alertCircle";

import { useAuth } from "@/context/authContext";
import { useToast } from "@/context/toastContext";

import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { useT } from "@/i18n/provider";

interface FileUploadItem {
  file: File;
  status: "uploading" | "completed" | "error";
  error?: string;
}

const FileUpload: React.FC = () => {
  const { tr } = useT();
  const [uploadedFiles, setUploadedFiles] = useState<FileUploadItem[]>([]);
  // the box to choose or drop a file closes as soon as a file is dropped; a link brings it back for another one
  const [boxOpen, setBoxOpen] = useState(true);
  const { user } = useAuth();
  const toast = useToast();

  const onDrop = async (acceptedFiles: File[]) => {
    if (!user) {
      toast.error(tr("You must be logged in to upload files"));
      return;
    }

    if (acceptedFiles.length > 0) setBoxOpen(false);
    const newFiles = acceptedFiles.map((file) => ({
      file,
      status: "uploading" as const,
    }));
    setUploadedFiles((prev) => [...prev, ...newFiles]);

    for (let i = 0; i < newFiles.length; i++) {
      const idx = uploadedFiles.length + i;
      const file = newFiles[i].file;

      try {
        // upload to GridFS
        const idToken = await user.getIdToken();
        const form = new FormData();
        form.append("file", file);

        const uploadRes = await fetch("/api/uploads", {
          method: "POST",
          headers: { Authorization: `Bearer ${idToken}` },
          body: form,
        });
        if (!uploadRes.ok) {
          const text = await uploadRes.text();
          throw new Error(tr("Upload failed: {status} {text}", { status: uploadRes.status, text }));
        }
        const { fileId, filename, type } = (await uploadRes.json()) as {
          fileId: string;
          filename: string;
          type: string;
        };

        // tell the uploads list, so the file is read into the profile right away (no Parse button needed)
        window.dispatchEvent(new CustomEvent("kaizo:file-uploaded", { detail: { fileId } }));

        // record upload in Firestore
        await addDoc(
          collection(db, "users", user.uid, "uploadedFiles"),
          {
            fileId,
            filename,
            type,
            createdAt: serverTimestamp(),
          }
        );

        // mark completed
        setUploadedFiles((prev) =>
          prev.map((f, j) =>
            j === idx ? { ...f, status: "completed" } : f
          )
        );
        toast.success(tr("{name} uploaded!", { name: file.name }));
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Upload failed";
        setUploadedFiles((prev) =>
          prev.map((f, j) =>
            j === idx ? { ...f, status: "error", error: message } : f
          )
        );
        toast.error(tr("Failed to upload {name}: {message}", { name: file.name, message }));
      }
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
      "text/plain": [".txt"],
      "text/markdown": [".md"],
    },
    maxSize: 10 * 1024 * 1024,
  });

  const removeFile = (i: number) =>
    setUploadedFiles((prev) => prev.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-6">
      <AnimatePresence initial={false} mode="wait">
        {boxOpen ? (
          <motion.div key="box" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }} className="overflow-hidden">
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-xl cursor-pointer transition-all ${
              isDragActive
                ? "border-blue-400 bg-card"
                : "border-border hover:border-blue-500 hover:bg-muted"
            }`}
          >
            <input {...getInputProps()} />
            <motion.div className="p-8 text-center">
              <Upload className={`h-12 w-12 mb-4 mx-auto ${isDragActive ? "text-blue-600" : "text-muted-foreground"}`} />
              <h3 className="text-lg font-semibold text-foreground mb-2">
                {isDragActive ? tr("Drop files here") : tr("Upload your documents")}
              </h3>
              <p className="text-muted-foreground mb-4">{tr("Drag & drop PDF, DOCX, TXT, or MD (max 10 MB)")}</p>
            </motion.div>
          </div>
          </motion.div>
        ) : (
          <motion.button key="again" type="button" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} onClick={() => setBoxOpen(true)} className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition-colors hover:bg-accent">
            <Upload className="h-4 w-4" />{" "}{tr("Upload another file")}
          </motion.button>
        )}
      </AnimatePresence>

      {uploadedFiles.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-lg font-semibold text-foreground">{tr("Uploaded Files")}</h4>
          {uploadedFiles.map((uf, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center justify-between p-4 bg-card rounded-lg"
            >
              <div className="flex items-center space-x-3">
                {uf.file.name.endsWith(".pdf") || uf.file.name.endsWith(".docx") ? (
                  <FileText className="h-6 w-6 text-blue-600" />
                ) : (
                  <FileIcon className="h-6 w-6 text-muted-foreground" />
                )}
                <div>
                  <p className="font-medium text-foreground">{uf.file.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {(uf.file.size / 1024 / 1024).toFixed(2)}{" "}{tr("MB")}</p>
                  {uf.status === "error" && uf.error && (
                    <p className="text-sm text-red-500">{uf.error}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center space-x-2">
                {uf.status === "completed" ? (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                ) : uf.status === "error" ? (
                  <AlertCircle className="h-5 w-5 text-red-500" />
                ) : (
                  <div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                )}
                <button onClick={() => removeFile(idx)} className="p-1 hover:bg-muted rounded-full">
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};

export default FileUpload;
