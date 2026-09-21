// src/components/ProfileSelector.tsx

"use client";
import React, { useState } from "react";
import { useProfile } from "@/context/profileContext";
import { Button } from "@/components/ui/button";
import { useDialog } from "@/context/dialogContext";

export default function ProfileSelector() {
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

      <Button onClick={createProfile} size="sm">
        + New
      </Button>

      <input
        type="text"
        value={newName}
        onChange={(e) => setNewName(e.target.value)}
        placeholder="Rename to…"
        className="border p-1 rounded w-32"
      />
      <Button
        onClick={() => {
          renameProfile(newName);
          setNewName("");
        }}
        size="sm"
      >
        Rename
      </Button>

      <Button
        onClick={async () => {
          if (!activeProfileId) return;
          const ok = await dialog.confirm({
            title: "Delete this profile?",
            description: "All of its details and uploads will be removed for good.",
            confirmText: "Delete profile",
            tone: "danger",
          });
          if (ok) deleteProfile(activeProfileId);
        }}
        size="sm"
        variant="destructive"
      >
        Delete
      </Button>
    </div>
  );
}
