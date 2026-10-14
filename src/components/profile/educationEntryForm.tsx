"use client";

// Add or edit one school in the profile. Same pieces as the step-by-step builder (the school and degree suggestions, the month picker)
// in a small form: the optional details (GPA, honors, coursework) are folded until they are needed.
import React, { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Save, X } from "lucide-react";
import { useProfile, EducationEntry } from "@/context/profileContext";
import { Input } from "@/components/ui/input";
import MonthPicker from "@/components/monthPicker";
import SuggestInput from "@/components/suggestInput";
import { DEGREES } from "@/lib/schools";
import { allSchools, countryOfSchool, placeOfSchool, schoolsOf } from "@/lib/worldSchools";
import { schoolTerms } from "@/lib/schoolTerms";
import { useT } from "@/i18n/provider";

interface EducationEntryFormProps {
  education?: EducationEntry | null;
  onClose: () => void;
  /** drawn inside a fold of the timeline: no frame and no title of its own */
  embedded?: boolean;
}

// a school of these countries gives its degree in English, even when the site is in Spanish
const ENGLISH_COUNTRIES = ["US", "GB", "IE", "CA", "AU", "NZ", "SG", "IN", "ZA", "NG", "KE", "GH", "PH"];

function Field({ label, error, children, className = "" }: { label: string; error?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <span className="mb-1 block text-sm font-semibold">{label}</span>
      {children}
      {error && <span className="mt-1 block text-xs text-red-500">{error}</span>}
    </div>
  );
}

const EducationEntryForm: React.FC<EducationEntryFormProps> = ({ education, onClose, embedded = false }) => {
  const { tr } = useT();
  // opened in place: it comes into view once, without moving the page to the top
  const root = useRef<HTMLFormElement>(null);
  useEffect(() => {
    // (inside a fold the card itself opens in place: no scrolling)
    if (!embedded) root.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const { activeProfile, addEducationEntry, updateEducationEntry } = useProfile();
  const home = activeProfile.contactInfo?.countryCode || "US";
  const [school, setSchool] = useState(education?.school ?? "");
  const [degree, setDegree] = useState(education?.degree ?? "");
  const [location, setLocation] = useState(education?.location ?? "");
  const [startDate, setStartDate] = useState(education?.startDate ?? "");
  const [endDate, setEndDate] = useState(education?.endDate ?? "");
  const [current, setCurrent] = useState(education?.current ?? false);
  const [gpa, setGpa] = useState(education?.gpa ?? "");
  const [honors, setHonors] = useState(education?.honors ?? "");
  const [coursework, setCoursework] = useState(education?.coursework ?? "");
  const [extras, setExtras] = useState(Boolean(education?.gpa || education?.honors || education?.coursework));
  const [tried, setTried] = useState(false);

  // the schools of the person's country first, then the rest of the world
  const schools = useMemo(() => Array.from(new Set([...schoolsOf(home), ...allSchools()])), [home]);
  const englishSchool = ENGLISH_COUNTRIES.includes(countryOfSchool(school) || home);

  // a school of the catalog brings its place
  const pickSchool = (v: string) => {
    setSchool(v);
    const place = placeOfSchool(v);
    if (place) setLocation(place);
  };

  const errors = {
    school: !school.trim() ? tr("School name is required") : "",
    degree: !degree.trim() ? tr("Degree is required") : "",
    startDate: !startDate ? tr("Start date is required") : "",
    endDate: !current && !endDate ? tr("End date is required") : "",
  };
  const show = (k: keyof typeof errors) => (tried ? errors[k] : "");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setTried(true);
    if (Object.values(errors).some(Boolean)) return;
    const data = {
      school: school.trim(),
      degree: degree.trim(),
      location: location.trim(),
      startDate,
      endDate: current ? "" : endDate,
      current,
      gpa: gpa.trim(),
      honors: honors.trim(),
      coursework: coursework.trim(),
    };
    if (education) updateEducationEntry(education.id, data);
    else addEducationEntry(data);
    onClose();
  };

  return (
    <form ref={root} onSubmit={submit} className={embedded ? "" : "rounded-xl border bg-card p-4 shadow-sm"}>
      {!embedded && (
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-base font-bold">{education ? tr("Edit school") : tr("Add a school")}</h3>
        <button type="button" onClick={onClose} aria-label={tr("Close")} className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>
      )}

      <div className="grid gap-3 sm:grid-cols-4">
        <Field label={tr("School")} error={show("school")} className="sm:col-span-2">
          <SuggestInput value={school} onChange={pickSchool} options={schools} browse terms={schoolTerms} placeholder={tr("Start typing, e.g. State University")} autoFocus />
        </Field>
        <Field label={tr("Degree")} error={show("degree")} className="sm:col-span-2">
          <SuggestInput value={degree} onChange={setDegree} options={DEGREES} browse translate={!englishSchool} terms={englishSchool ? (o) => [tr(o)] : undefined} placeholder={tr("Start typing, e.g. B.S. Biology")} />
        </Field>
        <Field label={tr("Location")} className="sm:col-span-2">
          <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder={tr("Austin, TX")} />
        </Field>
        <Field label={tr("Started")} error={show("startDate")}>
          <MonthPicker label={tr("Start date")} value={startDate} onChange={setStartDate} />
        </Field>
        <Field label={tr("Ended")} error={show("endDate")}>
          <MonthPicker label={tr("End date")} value={endDate} min={startDate} allowFuture disabled={current} onChange={setEndDate} />
          <span className="mt-1.5 flex items-center gap-2 text-sm">
            <input
              id="edu-current"
              type="checkbox"
              checked={current}
              onChange={(e) => {
                setCurrent(e.target.checked);
                if (e.target.checked) setEndDate("");
              }}
            />
            <label htmlFor="edu-current" className="cursor-pointer">{tr("I'm still studying here")}</label>
          </span>
        </Field>

        <div className="sm:col-span-4">
          <button type="button" aria-expanded={extras} onClick={() => setExtras((v) => !v)} className="flex items-center gap-2 text-sm font-semibold text-blue-600 hover:underline">
            <ChevronDown className={`h-4 w-4 transition-transform duration-300 ${extras ? "rotate-180" : ""}`} />
            {tr("Additional details")} <span className="font-normal text-muted-foreground">{tr("(optional)")}</span>
          </button>
          {extras && (
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <Field label={tr("GPA")}>
                <Input value={gpa} onChange={(e) => setGpa(e.target.value)} placeholder="3.8 / 4.0" />
              </Field>
              <Field label={tr("Honors and awards")} className="sm:col-span-2">
                <Input value={honors} onChange={(e) => setHonors(e.target.value)} placeholder={tr("Dean's List, Merit Scholarship")} />
              </Field>
              <Field label={tr("Relevant coursework")} className="sm:col-span-3">
                <Input value={coursework} onChange={(e) => setCoursework(e.target.value)} placeholder={tr("Data Structures, Algorithms, Databases")} />
              </Field>
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 flex items-center justify-end gap-2">
        <button type="button" onClick={onClose} className="rounded-lg border px-4 py-2 text-sm font-semibold transition-colors hover:bg-accent">
          {tr("Cancel")}
        </button>
        <button type="submit" className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700">
          <Save className="h-4 w-4" />
          {education ? tr("Update school") : tr("Add school")}
        </button>
      </div>
    </form>
  );
};

export default EducationEntryForm;
