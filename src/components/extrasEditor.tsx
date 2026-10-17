"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Plus, Trash2 } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useProfile, type JobEntry, type ProjectEntry } from "@/context/profileContext";
import { LINK_LABELS, type CertificationEntry, type LinkEntry } from "@/lib/links";
import { normalizeBullets, toBullets } from "@/lib/bullets";
import type { LanguageEntry } from "@/lib/languages";
import LanguagePicker from "@/components/languagePicker";
import JobDescriptionEditor from "@/components/jobDescriptionEditor";
import MonthPicker from "@/components/monthPicker";
import SuggestInput from "@/components/suggestInput";
import { Input } from "@/components/ui/input";
import { useT } from "@/i18n/provider";

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  const { tr } = useT();
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold">{tr(label)}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted-foreground">{tr(hint)}</span>}
    </label>
  );
}

/** When it is the only part shown, the page already says what it is, so the title is left out. */
const BareContext = React.createContext(false);

function Section({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  const { tr } = useT();
  const bare = React.useContext(BareContext);
  return (
    <div className="border-t pt-8 first:border-t-0 first:pt-0">
      {!bare && <h2 className="text-lg font-bold">{tr(title)}</h2>}
      <p className={`mb-5 text-sm text-muted-foreground ${bare ? "" : "mt-0.5"}`}>{tr(hint)}</p>
      {children}
    </div>
  );
}

/** One project or internship: a tidy row that opens to show its fields, so a long list stays easy to scan. */
function Entry({
  title,
  summary,
  open,
  onToggle,
  onRemove,
  removeLabel,
  children,
}: {
  title: string;
  summary: string;
  open: boolean;
  onToggle: () => void;
  onRemove: () => void;
  removeLabel: string;
  children: React.ReactNode;
}) {
  const { tr } = useT();
  return (
    <li className={`overflow-hidden rounded-xl border bg-card transition-shadow ${open ? "shadow-md ring-1 ring-blue-500/30" : "hover:shadow-sm"}`}>
      <div className="flex items-center pr-2">
        <button type="button" aria-expanded={open} onClick={onToggle} className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3.5 text-left">
          <span className="min-w-0 flex-1">
            <span className="block truncate font-semibold">{tr(title)}</span>
            {summary && <span className="block truncate text-xs text-muted-foreground">{tr(summary)}</span>}
          </span>
          <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-300 ${open ? "rotate-180" : ""}`} />
        </button>
        <RemoveButton label={removeLabel} onClick={onRemove} />
      </div>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            style={{ overflow: "hidden" }}
          >
            <div className="border-t bg-muted/20 px-4 py-5">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </li>
  );
}

const period = (start: string, end: string, current?: boolean) => [start, current ? "Present" : end].filter(Boolean).join(" – ");

function AddButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed py-2.5 text-sm font-semibold text-blue-600 transition-colors hover:border-blue-500 hover:bg-accent"
    >
      <Plus className="h-4 w-4" /> {children}
    </button>
  );
}

function RemoveButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40"
    >
      <Trash2 className="h-4 w-4" />
    </button>
  );
}

/** Bullet editor that keeps its own text (so empty bullets survive while typing) and reports the clean list upward. */
function Bullets({ value, onChange, title }: { value: string[]; onChange: (b: string[]) => void; title: string }) {
  const [text, setText] = useState(() => normalizeBullets(value.join("\n")));
  return (
    <JobDescriptionEditor
      value={text}
      onChange={(v) => {
        setText(v);
        onChange(toBullets(v));
      }}
      jobTitle={title}
    />
  );
}

/**
 * Everything optional that can make a resume richer: links, projects, internships, certifications and, last, languages.
 * Projects, internships, links and certifications are edited straight in the profile; languages come from the wizard.
 */
type ExtrasPart = "links" | "projects" | "internships" | "certifications" | "interests" | "languages";

export default function ExtrasEditor({
  languages = [],
  onLanguagesChange = () => {},
  only,
}: {
  languages?: LanguageEntry[];
  onLanguagesChange?: (list: LanguageEntry[]) => void;
  /** Show only some of the parts (the profile page edits them one section at a time). Everything by default. */
  only?: ExtrasPart[];
}) {
  const { tr } = useT();
  const show = (part: ExtrasPart) => !only || only.includes(part);
  const [openId, setOpenId] = useState<string | null>(null);
  const {
    activeProfile: p,
    addProjectEntry,
    updateProjectEntry,
    deleteProjectEntry,
    addInternshipEntry,
    updateInternshipEntry,
    deleteInternshipEntry,
    updateLinks,
    updateCertifications,
    updateInterests,
  } = useProfile();

  const links: LinkEntry[] = p.links ?? [];
  const certs: CertificationEntry[] = p.certifications ?? [];
  const interests: string[] = p.interests ?? [];
  const noExperience = !(p.jobHistory ?? []).some((j) => j.title?.trim() || j.company?.trim());
  const [interestDraft, setInterestDraft] = useState("");
  const addInterests = (raw: string) => {
    const parts = raw.split(/[,;\n]/).map((x) => x.trim()).filter(Boolean);
    if (parts.length === 0) return;
    updateInterests([...interests, ...parts.filter((x) => !interests.some((y) => y.toLowerCase() === x.toLowerCase()))].slice(0, 12));
    setInterestDraft("");
  };
  const projects: ProjectEntry[] = useMemo(() => p.projects ?? [], [p.projects]);
  const internships: JobEntry[] = useMemo(() => p.internships ?? [], [p.internships]);

  // a newly added project or internship opens so it can be filled in right away
  const counts = useRef({ projects: projects.length, internships: internships.length });
  useEffect(() => {
    if (projects.length > counts.current.projects) setOpenId(projects[projects.length - 1].id);
    if (internships.length > counts.current.internships) setOpenId(internships[internships.length - 1].id);
    counts.current = { projects: projects.length, internships: internships.length };
  }, [projects, internships]);

  return (
    <BareContext.Provider value={only?.length === 1}>
    <div className="space-y-6">
      {/* ---------- links ---------- */}
      {show("links") && (
      <Section title={tr("Links")} hint="LinkedIn, GitHub, your portfolio… Recruiters love to click through.">
        <ul className="space-y-2">
          {links.map((l, i) => (
            <li key={i} className="flex flex-wrap items-center gap-2">
              <div className="w-40 shrink-0">
                <SuggestInput
                  value={l.label}
                  onChange={(v) => updateLinks(links.map((x, j) => (j === i ? { ...x, label: v } : x)))}
                  options={LINK_LABELS}
                  placeholder={tr("LinkedIn")}
                  max={6}
                />
              </div>
              <div className="min-w-[12rem] flex-1">
                <Input
                  value={l.url}
                  onChange={(e) => updateLinks(links.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))}
                  placeholder={tr("linkedin.com/in/your-name")}
                  inputMode="url"
                />
              </div>
              <RemoveButton label={tr("Remove {v0}", { v0: l.label || "link" })} onClick={() => updateLinks(links.filter((_, j) => j !== i))} />
            </li>
          ))}
        </ul>
        <AddButton onClick={() => updateLinks([...links, { label: "", url: "" }])}>{tr("Add a link")}</AddButton>
      </Section>
      )}

      {/* ---------- projects ---------- */}
      {show("projects") && (
      <Section title={tr("Projects")} hint="Class, personal or open-source projects. Great when you have little work experience.">
        <ul className="space-y-3">
          {projects.map((pr) => (
            <Entry
              key={pr.id}
              title={pr.name || tr("New project")}
              summary={period(pr.startDate, pr.endDate, pr.current)}
              open={openId === pr.id}
              onToggle={() => setOpenId(openId === pr.id ? null : pr.id)}
              onRemove={() => deleteProjectEntry(pr.id)}
              removeLabel={`Remove ${pr.name || "project"}`}
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={tr("Project name")}>
                  <Input value={pr.name} onChange={(e) => updateProjectEntry(pr.id, { name: e.target.value })} placeholder={tr("Campus Events App")} />
                </Field>
                <Field label={tr("Link")} hint="Optional">
                  <Input value={pr.link ?? ""} onChange={(e) => updateProjectEntry(pr.id, { link: e.target.value })} placeholder={tr("github.com/you/project")} />
                </Field>
                <Field label={tr("Started")} hint="Optional">
                  <MonthPicker label={tr("Project start")} value={pr.startDate} onChange={(v) => updateProjectEntry(pr.id, { startDate: v })} />
                </Field>
                <Field label={tr("Ended")} hint="Optional">
                  <MonthPicker label={tr("Project end")} value={pr.endDate} min={pr.startDate} disabled={Boolean(pr.current)} onChange={(v) => updateProjectEntry(pr.id, { endDate: v })} />
                  <span className="mt-2 flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={Boolean(pr.current)}
                      onChange={(e) => updateProjectEntry(pr.id, { current: e.target.checked, endDate: e.target.checked ? "" : pr.endDate })}
                    />{tr("I still work on it")}</span>
                </Field>
                <div className="sm:col-span-2">
                  <Field label={tr("What is it about?")} hint="The context in a sentence or two: what the project is, who it is for, your role.">
                    <textarea
                      value={pr.description ?? ""}
                      onChange={(e) => updateProjectEntry(pr.id, { description: e.target.value })}
                      rows={2}
                      placeholder={tr("A mobile app that helps students find campus events. I led a team of 4 and built the backend.")}
                      className="w-full resize-none rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30"
                    />
                  </Field>
                </div>
                <div className="sm:col-span-2">
                  <Field label={tr("Tools and technologies")} hint="Separate with commas. Not printed on the resume: they only help the review and applicant tracking systems.">
                    <Input
                      defaultValue={(pr.technologies ?? []).join(", ")}
                      onChange={(e) => updateProjectEntry(pr.id, { technologies: e.target.value.split(",").map((t) => t.trim()).filter(Boolean) })}
                      placeholder={tr("React, Node.js, PostgreSQL")}
                    />
                  </Field>
                </div>
                <div className="sm:col-span-2">
                  <Bullets value={pr.accomplishments ?? []} onChange={(b) => updateProjectEntry(pr.id, { accomplishments: b })} title={pr.name} />
                </div>
              </div>
            </Entry>
          ))}
        </ul>
        <AddButton
          onClick={() =>
            addProjectEntry({ name: "", description: "", link: "", technologies: [], startDate: "", endDate: "", current: false, accomplishments: [] })
          }
        >{tr("Add a project")}</AddButton>
      </Section>
      )}

      {/* ---------- internships ---------- */}
      {show("internships") && (
      <Section title={tr("Internships")} hint="Formal internships, co-ops or traineeships.">
        <ul className="space-y-3">
          {internships.map((it) => (
            <Entry
              key={it.id}
              title={[it.title, it.company].filter(Boolean).join(" · ") || tr("New internship")}
              summary={period(it.startDate, it.endDate, it.current)}
              open={openId === it.id}
              onToggle={() => setOpenId(openId === it.id ? null : it.id)}
              onRemove={() => deleteInternshipEntry(it.id)}
              removeLabel={`Remove ${it.title || "internship"}`}
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={tr("Title")}>
                  <Input value={it.title} onChange={(e) => updateInternshipEntry(it.id, { title: e.target.value })} placeholder={tr("Marketing Intern")} />
                </Field>
                <Field label={tr("Company")}>
                  <Input value={it.company} onChange={(e) => updateInternshipEntry(it.id, { company: e.target.value })} placeholder={tr("Acme Inc.")} />
                </Field>
                <div className="sm:col-span-2">
                  <Field label={tr("Location")}>
                    <Input value={it.location ?? ""} onChange={(e) => updateInternshipEntry(it.id, { location: e.target.value })} placeholder={tr("Austin, TX")} />
                  </Field>
                </div>
                <Field label={tr("Started")}>
                  <MonthPicker label={tr("Internship start")} value={it.startDate} onChange={(v) => updateInternshipEntry(it.id, { startDate: v })} />
                </Field>
                <Field label={tr("Ended")}>
                  <MonthPicker label={tr("Internship end")} value={it.endDate} min={it.startDate} disabled={Boolean(it.current)} onChange={(v) => updateInternshipEntry(it.id, { endDate: v })} />
                  <span className="mt-2 flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={Boolean(it.current)}
                      onChange={(e) => updateInternshipEntry(it.id, { current: e.target.checked, endDate: e.target.checked ? "" : it.endDate })}
                    />{tr("I still do this")}</span>
                </Field>
                <div className="sm:col-span-2">
                  <Bullets value={it.accomplishments ?? []} onChange={(b) => updateInternshipEntry(it.id, { accomplishments: b, description: "" })} title={it.title} />
                </div>
              </div>
            </Entry>
          ))}
        </ul>
        <AddButton
          onClick={() =>
            addInternshipEntry({ title: "", company: "", location: "", description: "", startDate: "", endDate: "", current: false, accomplishments: [] })
          }
        >{tr("Add an internship")}</AddButton>
      </Section>
      )}

      {/* ---------- certifications ---------- */}
      {show("certifications") && (
      <Section title={tr("Certifications and awards")} hint="Courses, licenses or awards worth mentioning.">
        <ul className="space-y-2">
          {certs.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center gap-2">
              <div className="min-w-[12rem] flex-[2]">
                <Input
                  value={c.name}
                  onChange={(e) => updateCertifications(certs.map((x) => (x.id === c.id ? { ...x, name: e.target.value } : x)))}
                  placeholder={tr("AWS Cloud Practitioner")}
                />
              </div>
              <div className="min-w-[8rem] flex-1">
                <Input
                  value={c.issuer}
                  onChange={(e) => updateCertifications(certs.map((x) => (x.id === c.id ? { ...x, issuer: e.target.value } : x)))}
                  placeholder={tr("Issuer")}
                />
              </div>
              <div className="w-24">
                <Input
                  value={c.year}
                  inputMode="numeric"
                  maxLength={4}
                  onChange={(e) => updateCertifications(certs.map((x) => (x.id === c.id ? { ...x, year: e.target.value.replace(/\D/g, "") } : x)))}
                  placeholder="2025"
                />
              </div>
              <RemoveButton label={tr("Remove {v0}", { v0: c.name || "certification" })} onClick={() => updateCertifications(certs.filter((x) => x.id !== c.id))} />
            </li>
          ))}
        </ul>
        <AddButton onClick={() => updateCertifications([...certs, { id: `cert-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, name: "", issuer: "", year: "" }])}>{tr("Add a certification or award")}</AddButton>
      </Section>
      )}

      {/* ---------- volunteering, clubs and interests: the way to fill a resume with no jobs yet ---------- */}
      {show("interests") && (
      <Section
        title={tr("Volunteering and interests")}
        hint={noExperience ? "No work experience yet? Volunteering, clubs, odd jobs (babysitting, tutoring, a family business) and interests show who you are and that you take initiative." : "Volunteering, clubs and interests, in short lines. Optional."}
      >
        {interests.length > 0 && (
          <ul className="mb-3 flex flex-wrap gap-2">
            {interests.map((x, i) => (
              <li key={x} className="inline-flex items-center gap-1 rounded-full border bg-card py-1 pl-3 pr-1 text-sm">
                {x}
                <button type="button" aria-label={tr("Remove {v0}", { v0: x })} onClick={() => updateInterests(interests.filter((_, j) => j !== i))} className="rounded-full p-1 text-muted-foreground hover:bg-accent hover:text-foreground">
                  <Trash2 className="h-3 w-3" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex gap-2">
          <Input
            value={interestDraft}
            onChange={(e) => setInterestDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addInterests(interestDraft);
              }
            }}
            placeholder={tr("e.g. Food bank volunteer, Chess club captain")}
            maxLength={80}
          />
          <button type="button" onClick={() => addInterests(interestDraft)} disabled={!interestDraft.trim()} className="shrink-0 rounded-md border px-4 text-sm font-semibold hover:bg-accent disabled:opacity-40">
            {tr("Add")}
          </button>
        </div>
        <ul className="mt-3 flex flex-wrap gap-2">
          {["Community volunteer", "Student club member", "Peer tutor", "Sports team", "Family business helper", "Photography", "Reading", "Traveling"]
            .map((x) => tr(x))
            .filter((x) => !interests.some((y) => y.toLowerCase() === x.toLowerCase()))
            .slice(0, 6)
            .map((x) => (
              <li key={x}>
                <button type="button" onClick={() => addInterests(x)} className="inline-flex items-center gap-1 rounded-full border border-dashed px-3 py-1 text-sm text-muted-foreground transition-colors hover:border-blue-500 hover:bg-accent hover:text-foreground">
                  <Plus className="h-3 w-3" /> {x}
                </button>
              </li>
            ))}
        </ul>
      </Section>
      )}

      {/* ---------- languages, always last ---------- */}
      {show("languages") && (
      <Section title={tr("Languages")} hint="Languages you speak, with your level in each.">
        <LanguagePicker languages={languages} onChange={onLanguagesChange} hideTitle />
      </Section>
      )}
    </div>
    </BareContext.Provider>
  );
}

