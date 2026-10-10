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

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted-foreground">{hint}</span>}
    </label>
  );
}

/** When it is the only part shown, the page already says what it is, so the title is left out. */
const BareContext = React.createContext(false);

function Section({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  const bare = React.useContext(BareContext);
  return (
    <div className="border-t pt-8 first:border-t-0 first:pt-0">
      {!bare && <h4 className="text-lg font-bold">{title}</h4>}
      <p className={`mb-5 text-sm text-muted-foreground ${bare ? "" : "mt-0.5"}`}>{hint}</p>
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
  return (
    <li className={`overflow-hidden rounded-xl border bg-card transition-shadow ${open ? "shadow-md ring-1 ring-blue-500/30" : "hover:shadow-sm"}`}>
      <div className="flex items-center pr-2">
        <button type="button" aria-expanded={open} onClick={onToggle} className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3.5 text-left">
          <span className="min-w-0 flex-1">
            <span className="block truncate font-semibold">{title}</span>
            {summary && <span className="block truncate text-xs text-muted-foreground">{summary}</span>}
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
type ExtrasPart = "links" | "projects" | "internships" | "certifications" | "languages";

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
  } = useProfile();

  const links: LinkEntry[] = p.links ?? [];
  const certs: CertificationEntry[] = p.certifications ?? [];
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
      <Section title="Links" hint="LinkedIn, GitHub, your portfolio… Recruiters love to click through.">
        <ul className="space-y-2">
          {links.map((l, i) => (
            <li key={i} className="flex flex-wrap items-center gap-2">
              <div className="w-40 shrink-0">
                <SuggestInput
                  value={l.label}
                  onChange={(v) => updateLinks(links.map((x, j) => (j === i ? { ...x, label: v } : x)))}
                  options={LINK_LABELS}
                  placeholder="LinkedIn"
                  max={6}
                />
              </div>
              <div className="min-w-[12rem] flex-1">
                <Input
                  value={l.url}
                  onChange={(e) => updateLinks(links.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))}
                  placeholder="linkedin.com/in/your-name"
                  inputMode="url"
                />
              </div>
              <RemoveButton label={`Remove ${l.label || "link"}`} onClick={() => updateLinks(links.filter((_, j) => j !== i))} />
            </li>
          ))}
        </ul>
        <AddButton onClick={() => updateLinks([...links, { label: "", url: "" }])}>Add a link</AddButton>
      </Section>
      )}

      {/* ---------- projects ---------- */}
      {show("projects") && (
      <Section title="Projects" hint="Class, personal or open-source projects. Great when you have little work experience.">
        <ul className="space-y-3">
          {projects.map((pr) => (
            <Entry
              key={pr.id}
              title={pr.name || "New project"}
              summary={period(pr.startDate, pr.endDate, pr.current)}
              open={openId === pr.id}
              onToggle={() => setOpenId(openId === pr.id ? null : pr.id)}
              onRemove={() => deleteProjectEntry(pr.id)}
              removeLabel={`Remove ${pr.name || "project"}`}
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Project name">
                  <Input value={pr.name} onChange={(e) => updateProjectEntry(pr.id, { name: e.target.value })} placeholder="Campus Events App" />
                </Field>
                <Field label="Link" hint="Optional">
                  <Input value={pr.link ?? ""} onChange={(e) => updateProjectEntry(pr.id, { link: e.target.value })} placeholder="github.com/you/project" />
                </Field>
                <Field label="Started" hint="Optional">
                  <MonthPicker label="Project start" value={pr.startDate} onChange={(v) => updateProjectEntry(pr.id, { startDate: v })} />
                </Field>
                <Field label="Ended" hint="Optional">
                  <MonthPicker label="Project end" value={pr.endDate} disabled={Boolean(pr.current)} onChange={(v) => updateProjectEntry(pr.id, { endDate: v })} />
                  <span className="mt-2 flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={Boolean(pr.current)}
                      onChange={(e) => updateProjectEntry(pr.id, { current: e.target.checked, endDate: e.target.checked ? "" : pr.endDate })}
                    />
                    I still work on it
                  </span>
                </Field>
                <div className="sm:col-span-2">
                  <Field label="What is it about?" hint="The context in a sentence or two: what the project is, who it is for, your role.">
                    <textarea
                      value={pr.description ?? ""}
                      onChange={(e) => updateProjectEntry(pr.id, { description: e.target.value })}
                      rows={2}
                      placeholder="A mobile app that helps students find campus events. I led a team of 4 and built the backend."
                      className="w-full resize-none rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30"
                    />
                  </Field>
                </div>
                <div className="sm:col-span-2">
                  <Field label="Tools and technologies" hint="Separate with commas. Not printed on the resume: they only help the review and applicant tracking systems.">
                    <Input
                      defaultValue={(pr.technologies ?? []).join(", ")}
                      onChange={(e) => updateProjectEntry(pr.id, { technologies: e.target.value.split(",").map((t) => t.trim()).filter(Boolean) })}
                      placeholder="React, Node.js, PostgreSQL"
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
        >
          Add a project
        </AddButton>
      </Section>
      )}

      {/* ---------- internships ---------- */}
      {show("internships") && (
      <Section title="Internships" hint="Formal internships, co-ops or traineeships.">
        <ul className="space-y-3">
          {internships.map((it) => (
            <Entry
              key={it.id}
              title={[it.title, it.company].filter(Boolean).join(" · ") || "New internship"}
              summary={period(it.startDate, it.endDate, it.current)}
              open={openId === it.id}
              onToggle={() => setOpenId(openId === it.id ? null : it.id)}
              onRemove={() => deleteInternshipEntry(it.id)}
              removeLabel={`Remove ${it.title || "internship"}`}
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Title">
                  <Input value={it.title} onChange={(e) => updateInternshipEntry(it.id, { title: e.target.value })} placeholder="Marketing Intern" />
                </Field>
                <Field label="Company">
                  <Input value={it.company} onChange={(e) => updateInternshipEntry(it.id, { company: e.target.value })} placeholder="Acme Inc." />
                </Field>
                <div className="sm:col-span-2">
                  <Field label="Location">
                    <Input value={it.location ?? ""} onChange={(e) => updateInternshipEntry(it.id, { location: e.target.value })} placeholder="Austin, TX" />
                  </Field>
                </div>
                <Field label="Started">
                  <MonthPicker label={`Internship start`} value={it.startDate} onChange={(v) => updateInternshipEntry(it.id, { startDate: v })} />
                </Field>
                <Field label="Ended">
                  <MonthPicker label={`Internship end`} value={it.endDate} disabled={Boolean(it.current)} onChange={(v) => updateInternshipEntry(it.id, { endDate: v })} />
                  <span className="mt-2 flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={Boolean(it.current)}
                      onChange={(e) => updateInternshipEntry(it.id, { current: e.target.checked, endDate: e.target.checked ? "" : it.endDate })}
                    />
                    I still do this
                  </span>
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
        >
          Add an internship
        </AddButton>
      </Section>
      )}

      {/* ---------- certifications ---------- */}
      {show("certifications") && (
      <Section title="Certifications and awards" hint="Courses, licenses or awards worth mentioning.">
        <ul className="space-y-2">
          {certs.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center gap-2">
              <div className="min-w-[12rem] flex-[2]">
                <Input
                  value={c.name}
                  onChange={(e) => updateCertifications(certs.map((x) => (x.id === c.id ? { ...x, name: e.target.value } : x)))}
                  placeholder="AWS Cloud Practitioner"
                />
              </div>
              <div className="min-w-[8rem] flex-1">
                <Input
                  value={c.issuer}
                  onChange={(e) => updateCertifications(certs.map((x) => (x.id === c.id ? { ...x, issuer: e.target.value } : x)))}
                  placeholder="Issuer"
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
              <RemoveButton label={`Remove ${c.name || "certification"}`} onClick={() => updateCertifications(certs.filter((x) => x.id !== c.id))} />
            </li>
          ))}
        </ul>
        <AddButton onClick={() => updateCertifications([...certs, { id: `cert-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, name: "", issuer: "", year: "" }])}>
          Add a certification or award
        </AddButton>
      </Section>
      )}

      {/* ---------- languages, always last ---------- */}
      {show("languages") && (
      <Section title="Languages" hint="Languages you speak, with your level in each.">
        <LanguagePicker languages={languages} onChange={onLanguagesChange} hideTitle />
      </Section>
      )}
    </div>
    </BareContext.Provider>
  );
}

