// src/components/ProfileSelector.tsx

"use client";
import React, { useState } from "react";
import { useProfile } from "@/context/profileContext";
import { Button } from "@/components/ui/button";
import { useDialog } from "@/context/dialogContext";
import { useT } from "@/i18n/provider";

export default function ProfileSelector() {
  const { tr } = useT();
  const {
    profiles,
    activeProfileId,
    setActiveProfileId,
    createProfile,
    renameProfile,
    deleteProfile,
  } = useProfile();
  const [newName, setNewName] = useState("");
  const dialog = useDialog();

  return (
    <div className="flex items-center space-x-2">
      <select
        value={activeProfileId ?? ""}
        onChange={(e) => setActiveProfileId(e.target.value)}
        className="border p-1 rounded"
      >
        {profiles.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>

      <Button onClick={createProfile} size="sm">{tr("+ New")}</Button>

      <input
        type="text"
        value={newName}
        onChange={(e) => setNewName(e.target.value)}
        placeholder={tr("Rename to…")}
        className="border p-1 rounded w-32"
      />
      <Button
        onClick={() => {
          renameProfile(newName);
          setNewName("");
        }}
        size="sm"
      >{tr("Rename")}</Button>

      <Button
        onClick={async () => {
          if (!activeProfileId) return;
          const ok = await dialog.confirm({
            title: tr("Delete this profile?"),
            description: tr("All of its details and uploads will be removed for good."),
            confirmText: tr("Delete profile"),
            tone: "danger",
          });
          if (ok) deleteProfile(activeProfileId);
        }}
        size="sm"
        variant="destructive"
      >{tr("Delete")}</Button>
    </div>
  );
}
