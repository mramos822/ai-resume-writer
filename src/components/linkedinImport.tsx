"use client";

// Bring in what LinkedIn has about the person: they download their own data from LinkedIn and give the file to Kaizo.
// Kaizo never connects to LinkedIn, never asks for a LinkedIn password and reads nothing from LinkedIn on its own.
import React, { useRef, useState } from "react";
import { Check, ExternalLink, Linkedin, Loader2, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useProfile } from "@/context/profileContext";
import { useToast } from "@/context/toastContext";
import { authFetch } from "@/lib/authFetch";
import { useT } from "@/i18n/provider";

const LABEL: Record<string, string> = { jobs: "jobs", education: "schools", skills: "skills", languages: "languages", certifications: "certifications", projects: "projects", summary: "summary" };

export default function LinkedInImport() {
  const { tr, trd } = useT();
  const { activeProfileId, reloadProfile } = useProfile();
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Record<string, number> | null>(null);
  const [error, setError] = useState("");

  const send = async (files: FileList | null) => {
    if (!files || files.length === 0 || !activeProfileId) return;
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const body = new FormData();
      Array.from(files).forEach((f) => body.append("file", f));
      const res = await authFetch(`/api/profiles/${activeProfileId}/linkedin`, { method: "POST", body });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(trd(data.error) || tr("We couldn't import that file."));
      await reloadProfile();
      setResult(data.added ?? {});
      toast.success(tr("Your LinkedIn data was added to your profile."));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };

  const total = result ? Object.values(result).reduce((a, b) => a + b, 0) : 0;

  return (
    <div className="space-y-6">
      <ol className="space-y-4">
        {[
          <>{tr("Open LinkedIn and go to")}{" "}<strong>{tr("Settings & Privacy → Data privacy → Get a copy of your data")}</strong>.{" "}
            <a href="https://www.linkedin.com/mypreferences/d/download-my-data" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-blue-500 underline">{tr("Open it")}{" "}<ExternalLink className="h-3.5 w-3.5" />
            </a>
          </>,
          <>{tr("Choose")}{" "}<strong>{tr("“Want something in particular?”")}</strong>{" "}{tr("and tick Profile, Positions, Education, Skills and the rest you want, then request the archive.")}</>,
          <>{tr("LinkedIn emails you a link, usually within minutes. Download the")}{" "}<strong>{tr("ZIP")}</strong>{" "}{tr("and upload it here (no need to open it).")}</>,
        ].map((t, i) => (
          <li key={i} className="flex gap-3 text-sm leading-relaxed">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-600/10 text-xs font-bold text-blue-500">{i + 1}</span>
            <span className="text-muted-foreground">{t}</span>
          </li>
        ))}
      </ol>

      <div className="rounded-2xl border-2 border-dashed p-8 text-center">
        <Linkedin className="mx-auto h-9 w-9 text-[#0a66c2]" />
        <p className="mt-3 font-semibold">{tr("Upload your LinkedIn data")}</p>
        <p className="mt-1 text-sm text-muted-foreground">{tr("The ZIP from LinkedIn, or its CSV files (Positions, Education, Skills…). Up to 10 MB.")}</p>
        <input ref={input} type="file" multiple accept=".zip,.csv,application/zip,text/csv" className="sr-only" id="linkedin-file" onChange={(e) => send(e.target.files)} />
        <Button type="button" onClick={() => input.current?.click()} disabled={busy || !activeProfileId} className="mt-5 gap-2">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
          {busy ? tr("Reading your data…") : tr("Choose the file")}
        </Button>
      </div>

      {error && (
        <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-500">
          {error}
        </p>
      )}
      {result && (
        <div role="status" className="rounded-xl border border-green-500/30 bg-green-500/5 p-4 text-sm">
          <p className="flex items-center gap-2 font-semibold text-green-500">
            <Check className="h-4 w-4" strokeWidth={3} /> {total > 0 ? tr("Added to your profile") : tr("Your profile already had everything in that file")}
          </p>
          {total > 0 && (
            <p className="mt-1 text-muted-foreground">
              {Object.entries(result)
                .filter(([, n]) => n > 0)
                .map(([k, n]) => `${n} ${LABEL[k] ?? k}`)
                .join(", ")}{tr(". Nothing you had written was changed.")}</p>
          )}
        </div>
      )}

      <p className="text-xs leading-relaxed text-muted-foreground">{tr("Kaizo does not connect to your LinkedIn account and never asks for your LinkedIn password. You give us a file you downloaded yourself, we read it once to fill your profile and we do not keep the file. In a hurry? On your LinkedIn profile,")}{" "}<strong>{tr("More → Save to PDF")}</strong>{" "}{tr("also works: upload that PDF in the other tab.")}</p>
    </div>
  );
}
