"use client";

import React, { useRef } from "react";
import { Camera, Trash2, UserRound } from "lucide-react";
import { fileToSquarePhoto } from "@/lib/photo";
import { useToast } from "@/context/toastContext";
import { Button } from "@/components/ui/button";

/** Round photo with upload / replace / remove. `value` is a data URL, "" when there is none. */
export default function PhotoPicker({ value, onChange }: { value: string; onChange: (photo: string) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const toast = useToast();

  const onFile = async (file?: File) => {
    if (!file) return;
    try {
      onChange(await fileToSquarePhoto(file));
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  return (
    <div className="flex items-center gap-4">
      <button
        type="button"
        onClick={() => input.current?.click()}
        aria-label={value ? "Change photo" : "Add photo"}
        className="group relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-dashed bg-muted text-muted-foreground transition-colors hover:border-blue-500"
      >
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt="Your photo" className="h-full w-full object-cover" />
        ) : (
          <UserRound className="h-8 w-8" />
        )}
        <span className="absolute inset-0 flex items-center justify-center bg-black/45 text-white opacity-0 transition-opacity group-hover:opacity-100">
          <Camera className="h-5 w-5" />
        </span>
      </button>
      <div>
        <p className="text-sm font-semibold">Photo <span className="font-normal text-muted-foreground">(optional)</span></p>
        <p className="mb-2 text-xs text-muted-foreground">Templates make room for it when you add one.</p>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => input.current?.click()}>
            {value ? "Change" : "Add a photo"}
          </Button>
          {value && (
            <Button type="button" variant="ghost" size="sm" onClick={() => onChange("")}>
              <Trash2 className="h-4 w-4" /> Remove
            </Button>
          )}
        </div>
      </div>
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          onFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
    </div>
  );
}
