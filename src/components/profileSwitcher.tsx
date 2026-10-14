"use client";

// The profile switcher of the dashboard: a button with the name of the profile in use, and a sheet (from the bottom on a phone, a
// card in the middle on a big screen) with every profile, the one in use marked, and the way to make, rename or delete them.
import React, { useState } from "react";
import { Check, ChevronsUpDown, Pencil, Plus, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { getProfileProgress } from "@/lib/profileProgress";
import type { ProfileDoc } from "@/context/profileContext";
import { useT } from "@/i18n/provider";

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
  onCreate: () => void | Promise<void>;
  onRename: () => void | Promise<void>;
  onDelete: () => void | Promise<void>;
}) {
  const { tr } = useT();
  const [open, setOpen] = useState(false);
  const initial = (activeName.trim()[0] || "?").toUpperCase();

  // the actions open their own dialogs, so the sheet closes first (two dialogs would fight for the focus)
  const then = (fn: () => void | Promise<void>) => () => {
    setOpen(false);
    window.setTimeout(() => void fn(), 150);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className="inline-flex max-w-full items-center gap-2 rounded-full border bg-card py-1 pl-1 pr-3 text-sm font-medium transition-colors hover:border-blue-500/50"
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">{initial}</span>
        <span className="max-w-[10rem] truncate">{activeName}</span>
        {profiles.length > 1 && <span className="rounded-full bg-muted px-1.5 text-xs font-semibold text-muted-foreground">{profiles.length}</span>}
        <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          showCloseButton={false}
          className="top-auto bottom-0 left-0 max-h-[88vh] max-w-full translate-x-0 translate-y-0 gap-0 overflow-y-auto rounded-b-none rounded-t-3xl p-5 max-sm:data-[state=open]:slide-in-from-bottom sm:top-[50%] sm:bottom-auto sm:left-[50%] sm:max-w-md sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-3xl sm:p-6"
        >
          <span aria-hidden className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-border sm:hidden" />
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
            onClick={then(onCreate)}
            className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 text-base font-bold text-white shadow-md shadow-blue-600/25 transition-colors hover:bg-blue-700"
          >
            <Plus className="h-5 w-5" /> {tr("New profile")}
          </button>
        </DialogContent>
      </Dialog>
    </>
  );
}
