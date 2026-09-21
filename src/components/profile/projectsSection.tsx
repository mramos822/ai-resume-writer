"use client";

import React, { useState } from "react";
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
        <Label htmlFor="pj-name">Project name</Label>
        <Input id="pj-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Budget tracker app" required autoFocus />
      </div>
      <div>
        <Label htmlFor="pj-desc">What is it?</Label>
        <Textarea
          id="pj-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          placeholder="One or two sentences on what it does and why you built it."
        />
      </div>
      <div>
        <Label htmlFor="pj-tech">Tools and languages</Label>
        <Input id="pj-tech" value={tech} onChange={(e) => setTech(e.target.value)} placeholder="React, Node.js, PostgreSQL" />
        <p className="mt-1 text-xs text-muted-foreground">Separate them with commas.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="pj-start">Started (optional)</Label>
          <Input id="pj-start" type="month" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="pj-end">Finished</Label>
          <Input id="pj-end" type="month" value={current ? "" : endDate} onChange={(e) => setEndDate(e.target.value)} disabled={current} />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={current} onChange={(e) => setCurrent(e.target.checked)} className="h-4 w-4 rounded" />
        I&apos;m still working on it
      </label>
      <div>
        <Label htmlFor="pj-link">Link (optional)</Label>
        <Input id="pj-link" value={link} onChange={(e) => setLink(e.target.value)} placeholder="github.com/you/project" />
      </div>
      <div>
        <Label htmlFor="pj-points">Highlights (one per line)</Label>
        <Textarea
          id="pj-points"
          value={points}
          onChange={(e) => setPoints(e.target.value)}
          rows={4}
          placeholder={"Built the login system used by 200+ students\nCut load time in half by caching results"}
        />
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">Save project</Button>
      </DialogFooter>
    </form>
  );
}

const ProjectsSection: React.FC = () => {
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
      title: `Remove “${p.name || "this project"}”?`,
      description: "It will disappear from your profile and from resumes you generate next.",
      confirmText: "Remove",
      tone: "danger",
    });
    if (ok) deleteProjectEntry(p.id);
  };

  return (
    <div>
      <div className="mb-5 flex items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          Personal, school or side projects that show what you can build. Not the same as internships or jobs.
        </p>
        <Button onClick={openNew} size="sm" className="shrink-0 gap-1.5">
          <Plus className="h-4 w-4" /> Add project
        </Button>
      </div>

      {projects.length === 0 ? (
        <div className="flex flex-col items-center rounded-lg border-2 border-dashed px-6 py-12 text-center">
          <span className="mb-3 flex h-14 w-14 items-center justify-center rounded-md bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300">
            <FolderKanban className="h-7 w-7" />
          </span>
          <p className="font-semibold">No projects yet</p>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Projects are great when you&apos;re starting out. Add one you&apos;re proud of.
          </p>
          <Button onClick={openNew} className="mt-4 gap-1.5">
            <Plus className="h-4 w-4" /> Add my first project
          </Button>
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
                        aria-label="Edit project"
                        title="Edit"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => remove(p)}
                        className="rounded-md p-2 text-muted-foreground hover:bg-red-50 hover:text-red-600"
                        aria-label="Remove project"
                        title="Remove"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {p.description && <p className="mt-2 text-sm text-muted-foreground">{p.description}</p>}

                  {p.technologies?.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {p.technologies.map((t) => (
                        <span key={t} className="rounded-md bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-800 dark:bg-sky-950 dark:text-sky-200">
                          {t}
                        </span>
                      ))}
                    </div>
                  )}

                  {p.accomplishments?.length > 0 && (
                    <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">
                      {p.accomplishments.map((a, i) => (
                        <li key={i}>{a}</li>
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
            <DialogTitle>{editing ? "Edit project" : "Add a project"}</DialogTitle>
            <DialogDescription>Keep it short. A couple of highlights is plenty.</DialogDescription>
          </DialogHeader>
          <ProjectForm key={editing?.id ?? "new"} initial={editing ?? undefined} onSave={save} onCancel={close} />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProjectsSection;
