"use client";

import React, { useState } from "react";
import { currentMonth } from "@/lib/dateFormat";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Pencil, Trash2, ExternalLink, FolderKanban } from "lucide-react";
import { useProfile, ProjectEntry } from "@/context/profileContext";
import { useDialog } from "@/context/dialogContext";
import { formatPeriod } from "@/lib/dateFormat";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useT } from "@/i18n/provider";

type Draft = Omit<ProjectEntry, "id">;

const EMPTY: Draft = {
  name: "",
  description: "",
  link: "",
  technologies: [],
  startDate: "",
  endDate: "",
  current: false,
  accomplishments: [],
};

function ProjectForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: ProjectEntry;
  onSave: (data: Draft) => void;
  onCancel: () => void;
}) {
  const { tr } = useT();
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [link, setLink] = useState(initial?.link ?? "");
  const [tech, setTech] = useState((initial?.technologies ?? []).join(", "));
  const [startDate, setStartDate] = useState(initial?.startDate ?? "");
  const [endDate, setEndDate] = useState(initial?.endDate ?? "");
  const [current, setCurrent] = useState(Boolean(initial?.current));
  const [points, setPoints] = useState((initial?.accomplishments ?? []).join("\n"));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      name: name.trim(),
      description: description.trim(),
      link: link.trim(),
      technologies: tech.split(",").map((t) => t.trim()).filter(Boolean),
      startDate,
      endDate: current ? "" : endDate,
      current,
      accomplishments: points.split("\n").map((l) => l.trim()).filter(Boolean),
    });
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <Label htmlFor="pj-name">{tr("Project name")}</Label>
        <Input id="pj-name" value={name} onChange={(e) => setName(e.target.value)} placeholder={tr("e.g. Budget tracker app")} required autoFocus />
      </div>
      <div>
        <Label htmlFor="pj-desc">{tr("What is it?")}</Label>
        <Textarea
          id="pj-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          placeholder={tr("One or two sentences on what it does and why you built it.")}
        />
      </div>
      <div>
        <Label htmlFor="pj-tech">{tr("Tools and languages")}</Label>
        <Input id="pj-tech" value={tech} onChange={(e) => setTech(e.target.value)} placeholder={tr("React, Node.js, PostgreSQL")} />
        <p className="mt-1 text-xs text-muted-foreground">{tr("Separate them with commas.")}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="pj-start">{tr("Started (optional)")}</Label>
          <Input id="pj-start" type="month" max={currentMonth()} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="pj-end">{tr("Finished")}</Label>
          <Input id="pj-end" type="month" max={currentMonth()} min={startDate || undefined} value={current ? "" : endDate} onChange={(e) => setEndDate(e.target.value)} disabled={current} />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={current} onChange={(e) => setCurrent(e.target.checked)} className="h-4 w-4 rounded" />{tr("I'm still working on it")}</label>
      <div>
        <Label htmlFor="pj-link">{tr("Link (optional)")}</Label>
        <Input id="pj-link" value={link} onChange={(e) => setLink(e.target.value)} placeholder={tr("github.com/you/project")} />
      </div>
      <div>
        <Label htmlFor="pj-points">{tr("Highlights (one per line)")}</Label>
        <Textarea
          id="pj-points"
          value={points}
          onChange={(e) => setPoints(e.target.value)}
          rows={4}
          placeholder={tr("Built the login system used by 200+ students\nCut load time in half by caching results")}
        />
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>{tr("Cancel")}</Button>
        <Button type="submit">{tr("Save project")}</Button>
      </DialogFooter>
    </form>
  );
}

const ProjectsSection: React.FC = () => {
  const { tr } = useT();
  const { activeProfile, addProjectEntry, updateProjectEntry, deleteProjectEntry } = useProfile();
  const dialog = useDialog();
  const [editing, setEditing] = useState<ProjectEntry | null>(null);
  const [open, setOpen] = useState(false);

  const projects = activeProfile.projects ?? [];

  const openNew = () => {
    setEditing(null);
    setOpen(true);
  };
  const openEdit = (p: ProjectEntry) => {
    setEditing(p);
    setOpen(true);
  };
  const close = () => {
    setOpen(false);
    setEditing(null);
  };

  const save = (data: Draft) => {
    if (editing) updateProjectEntry(editing.id, data);
    else addProjectEntry({ ...EMPTY, ...data });
    close();
  };

  const remove = async (p: ProjectEntry) => {
    const ok = await dialog.confirm({
      title: tr("Remove “{v0}”?", { v0: p.name || "this project" }),
      description: tr("It will disappear from your profile and from resumes you generate next."),
      confirmText: tr("Remove"),
      tone: "danger",
    });
    if (ok) deleteProjectEntry(p.id);
  };

  return (
    <div>
      <div className="mb-5 flex items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">{tr("Personal, school or side projects that show what you can build. Not the same as internships or jobs.")}</p>
        <Button onClick={openNew} size="sm" className="shrink-0 gap-1.5">
          <Plus className="h-4 w-4" />{" "}{tr("Add project")}</Button>
      </div>

      {projects.length === 0 ? (
        <div className="flex flex-col items-center rounded-lg border-2 border-dashed px-6 py-12 text-center">
          <span className="mb-3 flex h-14 w-14 items-center justify-center rounded-md bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300">
            <FolderKanban className="h-7 w-7" />
          </span>
          <p className="font-semibold">{tr("No projects yet")}</p>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">{tr("Projects are great when you're starting out. Add one you're proud of.")}</p>
          <Button onClick={openNew} className="mt-4 gap-1.5">
            <Plus className="h-4 w-4" />{" "}{tr("Add my first project")}</Button>
        </div>
      ) : (
        <ul className="space-y-3">
          <AnimatePresence initial={false}>
            {projects.map((p) => {
              const dates = formatPeriod(p, " - ");
              return (
                <motion.li
                  key={p.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, height: 0 }}
                  className="rounded-lg border bg-card p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="font-bold leading-tight">{p.name}</h3>
                      {dates && <p className="mt-0.5 text-xs text-muted-foreground">{dates}</p>}
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <button
                        onClick={() => openEdit(p)}
                        className="rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-blue-600"
                        aria-label={tr("Edit project")}
                        title={tr("Edit")}
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => remove(p)}
                        className="rounded-md p-2 text-muted-foreground hover:bg-red-50 hover:text-red-600"
                        aria-label={tr("Remove project")}
                        title={tr("Remove")}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {p.description && <p className="mt-2 text-sm text-muted-foreground">{tr(p.description)}</p>}

                  {p.technologies?.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {p.technologies.map((t) => (
                        <span key={t} className="rounded-md bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-800 dark:bg-sky-950 dark:text-sky-200">
                          {tr(t)}
                        </span>
                      ))}
                    </div>
                  )}

                  {p.accomplishments?.length > 0 && (
                    <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">
                      {p.accomplishments.map((a, i) => (
                        <li key={i}>{tr(a)}</li>
                      ))}
                    </ul>
                  )}

                  {p.link && (
                    <a
                      href={/^https?:\/\//.test(p.link) ? p.link : `https://${p.link}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:underline"
                    >
                      <ExternalLink className="h-3.5 w-3.5" /> {p.link}
                    </a>
                  )}
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      )}

      <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : close())}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? tr("Edit project") : tr("Add a project")}</DialogTitle>
            <DialogDescription>{tr("Keep it short. A couple of highlights is plenty.")}</DialogDescription>
          </DialogHeader>
          <ProjectForm key={editing?.id ?? "new"} initial={editing ?? undefined} onSave={save} onCancel={close} />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProjectsSection;
