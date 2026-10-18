"use client";

// The profile switcher of the dashboard: a button with the name of the profile in use, and a sheet (from the bottom on a phone, a
// card in the middle on a big screen) with every profile, the one in use marked, and the way to make, rename or delete them.
// A new profile is named right there: a name that is already used is not accepted, and the person can pick another or open that one.
import React, { useEffect, useRef, useState } from "react";
import { ArrowLeft, Check, ChevronDown, Pencil, Plus, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { getProfileProgress } from "@/lib/profileProgress";
import type { ProfileDoc } from "@/context/profileContext";
import { useT } from "@/i18n/provider";

const MAX_NAME = 60;
/** the same name written with other capitals or extra spaces is the same name */
const norm = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();

export default function ProfileSwitcher({
  profiles,
  activeId,
  activeName,
  onSelect,
  onCreate,
  onRename,
  onDelete,
}: {
  profiles: ProfileDoc[];
  activeId: string;
  activeName: string;
  onSelect: (id: string) => void;
  /** makes the profile with that name; may throw (for example when the name is taken on the server) */
  onCreate: (name: string) => Promise<void>;
  onRename: () => void | Promise<void>;
  onDelete: () => void | Promise<void>;
}) {
  const { tr } = useT();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"list" | "name">("list");
  const [name, setName] = useState("");
  const [problem, setProblem] = useState<{ kind: "empty" | "failed" } | { kind: "taken"; id: string; name: string } | null>(null);
  const [working, setWorking] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const initial = (activeName.trim()[0] || "?").toUpperCase();

  // every time the sheet opens it starts on the list
  useEffect(() => {
    if (open) return;
    const t = window.setTimeout(() => {
      setView("list");
      setName("");
      setProblem(null);
    }, 200);
    return () => window.clearTimeout(t);
  }, [open]);

  // the actions open their own dialogs, so the sheet closes first (two dialogs would fight for the focus)
  const then = (fn: () => void | Promise<void>) => () => {
    setOpen(false);
    window.setTimeout(() => void fn(), 150);
  };

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (working) return;
    const clean = name.trim().replace(/\s+/g, " ");
    if (!clean) {
      setProblem({ kind: "empty" });
      input.current?.focus();
      return;
    }
    const taken = profiles.find((p) => norm(p.name) === norm(clean));
    if (taken) {
      setProblem({ kind: "taken", id: taken.id, name: taken.name });
      return;
    }
    setWorking(true);
    try {
      await onCreate(clean);
      setOpen(false);
    } catch (err) {
      const e2 = err as { code?: string; id?: string; name?: string };
      if (e2.code === "name-taken" && e2.id) setProblem({ kind: "taken", id: e2.id, name: e2.name ?? clean });
      else if (e2.code === "name-empty") setProblem({ kind: "empty" });
      else setProblem({ kind: "failed" });
    } finally {
      setWorking(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-label={`${tr("Profile")}: ${activeName}`}
        className="group inline-flex max-w-full items-center gap-2 rounded-full bg-muted/60 py-1 pl-1 pr-2.5 text-sm font-semibold text-foreground/90 transition-colors hover:bg-muted active:scale-[0.98]"
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">{initial}</span>
        <span className="max-w-[12rem] truncate">{activeName}</span>
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-y-0.5" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          showCloseButton={false}
          onOpenAutoFocus={(e) => {
            // on the list nothing should take the focus; the name field is focused when its view opens
            e.preventDefault();
          }}
          className="top-auto bottom-0 left-0 max-h-[88vh] max-w-full translate-x-0 translate-y-0 gap-0 overflow-y-auto rounded-b-none rounded-t-3xl p-5 max-sm:data-[state=open]:slide-in-from-bottom sm:top-[50%] sm:bottom-auto sm:left-[50%] sm:max-w-md sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-3xl sm:p-6"
        >
          <span aria-hidden className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-border sm:hidden" />

          {view === "list" ? (
            <>
              <DialogTitle className="text-xl font-extrabold">{tr("Your profiles")}</DialogTitle>
              <DialogDescription className="mt-1 text-sm text-muted-foreground">{tr("Each profile is a different version of you, for example for another kind of job.")}</DialogDescription>

              <ul className="mt-4 space-y-2.5">
                {profiles.map((p) => {
                  const on = p.id === activeId;
                  const percent = getProfileProgress(p.data, tr).percent;
                  return (
                    <li key={p.id} className={`rounded-2xl border p-3 transition-colors ${on ? "border-blue-500 bg-blue-600/5" : "bg-card hover:border-blue-500/40"}`}>
                      <button
                        type="button"
                        onClick={() => {
                          if (!on) onSelect(p.id);
                          setOpen(false);
                        }}
                        className="flex w-full items-center gap-3 text-left"
                      >
                        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-base font-bold ${on ? "bg-blue-600 text-white" : "bg-muted text-muted-foreground"}`}>
                          {(p.name.trim()[0] || "?").toUpperCase()}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-bold">{p.name}</span>
                          <span className="block truncate text-sm text-muted-foreground">
                            {p.data.jobTitle?.trim() || tr("No target job yet")}{" · "}{percent}%
                          </span>
                        </span>
                        {on && (
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white" aria-label={tr("In use")}>
                            <Check className="h-3.5 w-3.5" strokeWidth={3} />
                          </span>
                        )}
                      </button>
                      {on && (
                        <div className="mt-3 flex gap-2 border-t pt-3">
                          <button type="button" onClick={then(onRename)} className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg bg-muted text-sm font-semibold transition-colors hover:bg-accent">
                            <Pencil className="h-3.5 w-3.5" /> {tr("Rename")}
                          </button>
                          <button
                            type="button"
                            onClick={then(onDelete)}
                            className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg bg-muted text-sm font-semibold text-red-500 transition-colors hover:bg-red-500/10"
                          >
                            <Trash2 className="h-3.5 w-3.5" /> {tr("Delete")}
                          </button>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>

              <button
                type="button"
                onClick={() => {
                  setView("name");
                  window.setTimeout(() => input.current?.focus(), 60);
                }}
                className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 text-base font-bold text-white shadow-md shadow-blue-600/25 transition-colors hover:bg-blue-700"
              >
                <Plus className="h-5 w-5" /> {tr("New profile")}
              </button>
            </>
          ) : (
            <form onSubmit={create} noValidate>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setView("list");
                    setProblem(null);
                  }}
                  aria-label={tr("Back")}
                  className="-ml-1 flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>
                <DialogTitle className="text-xl font-extrabold">{tr("Name your new profile")}</DialogTitle>
              </div>
              <DialogDescription className="mt-2 text-sm text-muted-foreground">{tr("Pick a name that helps you tell your profiles apart, like “Marketing jobs”.")}</DialogDescription>

              <label htmlFor="new-profile-name" className="mt-5 block text-sm font-semibold">{tr("Profile name")}</label>
              <input
                id="new-profile-name"
                ref={input}
                value={name}
                maxLength={MAX_NAME}
                autoComplete="off"
                onChange={(e) => {
                  setName(e.target.value);
                  if (problem) setProblem(null);
                }}
                aria-invalid={problem?.kind === "taken" || problem?.kind === "empty"}
                className={`mt-1.5 h-12 w-full rounded-xl border bg-background px-4 text-base outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 ${problem?.kind === "taken" || problem?.kind === "empty" ? "border-red-500" : ""}`}
              />

              {problem?.kind === "empty" && <p className="mt-2 text-sm text-red-500">{tr("Write a name for your profile.")}</p>}
              {problem?.kind === "failed" && <p className="mt-2 text-sm text-red-500">{tr("We couldn't create the profile. Try again.")}</p>}
              {problem?.kind === "taken" && (
                <div role="alert" className="mt-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3">
                  <p className="text-sm font-semibold">{tr("A profile called “{name}” already exists.", { name: problem.name })}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">{tr("Try another name, or work with that profile.")}</p>
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setProblem(null);
                        input.current?.focus();
                        input.current?.select();
                      }}
                      className="inline-flex h-10 flex-1 items-center justify-center rounded-lg border bg-background text-sm font-semibold transition-colors hover:bg-accent"
                    >
                      {tr("Try another name")}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (problem.id !== activeId) onSelect(problem.id);
                        setOpen(false);
                      }}
                      className="inline-flex h-10 flex-1 items-center justify-center rounded-lg bg-blue-600 text-sm font-bold text-white transition-colors hover:bg-blue-700"
                    >
                      {tr("Use that profile")}
                    </button>
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={working}
                className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 text-base font-bold text-white shadow-md shadow-blue-600/25 transition-colors hover:bg-blue-700 disabled:opacity-60"
              >
                {working ? tr("Creating…") : tr("Create profile")}
              </button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
