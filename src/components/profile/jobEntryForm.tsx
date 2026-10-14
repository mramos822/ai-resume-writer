"use client";

// Add or edit one job in the profile. It is made of the same pieces as the step-by-step builder (the month picker, the job title
// suggestions and the bullet editor) and it is kept small: two rows of fields and the bullets.
import React, { useEffect, useRef, useState } from "react";
import { Save, X } from "lucide-react";
import { useProfile, JobEntry } from "@/context/profileContext";
import { Input } from "@/components/ui/input";
import MonthPicker from "@/components/monthPicker";
import JobTitleInput from "@/components/jobTitleInput";
import JobDescriptionEditor from "@/components/jobDescriptionEditor";
import { normalizeBullets, toBullets } from "@/lib/bullets";
import { detectSelfEmployed, isSelfEmployedName } from "@/lib/selfEmployed";
import { useT } from "@/i18n/provider";

interface JobEntryFormProps {
  job?: JobEntry | null;
  onClose: () => void;
  /** drawn inside a fold of the timeline: no frame and no title of its own */
  embedded?: boolean;
}

function Field({ label, error, children, className = "" }: { label: string; error?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <span className="mb-1 block text-sm font-semibold">{label}</span>
      {children}
      {error && <span className="mt-1 block text-xs text-red-500">{error}</span>}
    </div>
  );
}

const JobEntryForm: React.FC<JobEntryFormProps> = ({ job, onClose, embedded = false }) => {
  const { tr } = useT();
  // opened in place: it comes into view once, without moving the page to the top
  const root = useRef<HTMLFormElement>(null);
  useEffect(() => {
    // (inside a fold the card itself opens in place: no scrolling)
    if (!embedded) root.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const { addJobEntry, updateJobEntry } = useProfile();
  const [title, setTitle] = useState(job?.title ?? "");
  // working for oneself: older jobs only say it in the company ("Self-employed", "Freelance"), which counts too
  const [selfEmployed, setSelfEmployed] = useState(job ? detectSelfEmployed(job) : false);
  const [company, setCompany] = useState(isSelfEmployedName(job?.company) ? "" : job?.company ?? "");
  const [location, setLocation] = useState(job?.location ?? "");
  const [startDate, setStartDate] = useState(job?.startDate ?? "");
  const [endDate, setEndDate] = useState(job?.endDate ?? "");
  const [current, setCurrent] = useState(job ? (job.current ?? !job.endDate) : false);
  // the intro and the accomplishments are one list of bullets, as in the builder
  const [bullets, setBullets] = useState(normalizeBullets([job?.description?.trim(), ...(job?.accomplishments ?? [])].filter(Boolean).join("\n")));
  const [tried, setTried] = useState(false);

  const errors = {
    title: !title.trim() ? tr("Job title is required") : "",
    company: !selfEmployed && !company.trim() ? tr("Company name is required") : "",
    startDate: !startDate ? tr("Start date is required") : "",
    endDate: !current && !endDate ? tr("End date is required") : "",
  };
  const show = (k: keyof typeof errors) => (tried ? errors[k] : "");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setTried(true);
    if (Object.values(errors).some(Boolean)) return;
    const data = {
      title: title.trim(),
      // self-employed with no business name: that is what the resume shows where the company goes
      company: company.trim() || (selfEmployed ? tr("Self-employed") : ""),
      selfEmployed,
      location: location.trim(),
      description: "",
      startDate,
      endDate: current ? "" : endDate,
      current,
      accomplishments: toBullets(bullets),
    };
    if (job) updateJobEntry(job.id, data);
    else addJobEntry(data);
    onClose();
  };

  return (
    <form ref={root} onSubmit={submit} className={embedded ? "" : "rounded-xl border bg-card p-4 shadow-sm"}>
      {!embedded && (
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-base font-bold">{job ? tr("Edit job") : tr("Add a job")}</h3>
        <button type="button" onClick={onClose} aria-label={tr("Close")} className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>
      )}

      <div className="grid gap-3 sm:grid-cols-4">
        <Field label={tr("Job title")} error={show("title")} className="sm:col-span-2">
          <JobTitleInput value={title} onChange={setTitle} placeholder={tr("Barista")} autoFocus />
        </Field>
        <Field label={tr("Company")} error={show("company")} className="sm:col-span-2">
          <Input value={company} onChange={(e) => setCompany(e.target.value)} placeholder={selfEmployed ? tr("Your business name (optional)") : tr("Corner Cafe")} />
          <span className="mt-1.5 flex items-center gap-2 text-sm">
            <input id="job-self" type="checkbox" checked={selfEmployed} onChange={(e) => setSelfEmployed(e.target.checked)} />
            <label htmlFor="job-self" className="cursor-pointer">{tr("I work for myself (self-employed)")}</label>
          </span>
        </Field>
        <Field label={tr("Location")} className="sm:col-span-2">
          <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder={tr("Austin, TX or Remote")} />
        </Field>
        <Field label={tr("Started")} error={show("startDate")}>
          <MonthPicker label={tr("Start date")} value={startDate} onChange={setStartDate} />
        </Field>
        <Field label={tr("Ended")} error={show("endDate")}>
          <MonthPicker label={tr("End date")} value={endDate} min={startDate} disabled={current} onChange={setEndDate} />
          <span className="mt-1.5 flex items-center gap-2 text-sm">
            <input
              id="job-current"
              type="checkbox"
              checked={current}
              onChange={(e) => {
                setCurrent(e.target.checked);
                if (e.target.checked) setEndDate("");
              }}
            />
            <label htmlFor="job-current" className="cursor-pointer">{tr("I still work here")}</label>
          </span>
        </Field>
        <div className="sm:col-span-4">
          <JobDescriptionEditor value={bullets} onChange={setBullets} jobTitle={title} compact />
        </div>
      </div>

      <div className="mt-4 flex items-center justify-end gap-2">
        <button type="button" onClick={onClose} className="rounded-lg border px-4 py-2 text-sm font-semibold transition-colors hover:bg-accent">
          {tr("Cancel")}
        </button>
        <button type="submit" className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700">
          <Save className="h-4 w-4" />
          {job ? tr("Update job") : tr("Add job")}
        </button>
      </div>
    </form>
  );
};

export default JobEntryForm;
