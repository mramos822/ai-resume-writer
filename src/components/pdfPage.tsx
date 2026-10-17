"use client";

// The first page of a resume file, drawn from the PDF itself. What you see is exactly what that resume contains, whatever
// the profile looks like today (the profile keeps changing, a resume you made does not).
import React, { useEffect, useState } from "react";
import { authFetch } from "@/lib/authFetch";
import { useT } from "@/i18n/provider";

type PdfJs = typeof import("pdfjs-dist");

let loader: Promise<PdfJs> | null = null;
function pdfjs(): Promise<PdfJs> {
  if (!loader) {
    loader = import("pdfjs-dist").then((m) => {
      m.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs"; // copied from node_modules/pdfjs-dist/build (see package.json "copy-pdf-worker")
      return m;
    });
  }
  return loader;
}

// finished drawings, by file and width, so moving between resumes does not draw them again. A drawing is a JPEG of a few hundred KB, so
// the memory is small, but it is capped anyway: past MAX_DRAWN the oldest one is forgotten (it is drawn again if it is ever needed).
const MAX_DRAWN = 30;
const drawn = new Map<string, string>();
const pending = new Map<string, Promise<string>>();

async function draw(fileId: string, width: number): Promise<string> {
  const key = `${fileId}:${width}`;
  const hit = drawn.get(key);
  if (hit) return hit;
  let job = pending.get(key);
  if (!job) {
    job = (async () => {
      const res = await authFetch(`/api/resumes/${fileId}?view=true`);
      if (!res.ok) throw new Error("Could not open this resume.");
      const data = new Uint8Array(await res.arrayBuffer());
      const lib = await pdfjs();
      const doc = await lib.getDocument({ data }).promise;
      try {
        const page = await doc.getPage(1);
        const base = page.getViewport({ scale: 1 });
        const ratio = Math.min(2, window.devicePixelRatio || 1);
        const viewport = page.getViewport({ scale: (width * ratio) / base.width });
        const canvas = document.createElement("canvas");
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        await page.render({ canvasContext: canvas.getContext("2d")!, viewport }).promise;
        const url = canvas.toDataURL("image/jpeg", 0.92);
        drawn.set(key, url);
        if (drawn.size > MAX_DRAWN) drawn.delete(drawn.keys().next().value as string);
        return url;
      } finally {
        void doc.destroy();
      }
    })().finally(() => pending.delete(key));
    pending.set(key, job);
  }
  return job;
}

/**
 * Draws files ahead of time, one after the other and while the browser is idle, so that when the person moves to one it is already there.
 * Errors are ignored (the real view shows them if the file is opened). It stops when `stop()` is called.
 */
export function preloadPdfPages(fileIds: string[], width: number): () => void {
  let off = false;
  const idle = (cb: () => void) => ("requestIdleCallback" in window ? (window as unknown as { requestIdleCallback: (f: () => void, o?: { timeout: number }) => void }).requestIdleCallback(cb, { timeout: 1500 }) : setTimeout(cb, 200));
  (async () => {
    for (const id of fileIds) {
      if (off) return;
      if (drawn.has(`${id}:${width}`)) continue;
      await new Promise<void>((resolve) => idle(resolve));
      if (off) return;
      await draw(id, width).catch(() => undefined);
    }
  })();
  return () => {
    off = true;
  };
}

/** Forget a file's drawings (after it is renamed or deleted). */
export function forgetPdfPage(fileId: string) {
  for (const k of Array.from(drawn.keys())) if (k.startsWith(`${fileId}:`)) drawn.delete(k);
}

export default function PdfPage({ fileId, width, alt, className = "" }: { fileId: string; width: number; alt: string; className?: string }) {
  const { tr } = useT();
  const [src, setSrc] = useState<string | null>(() => drawn.get(`${fileId}:${width}`) ?? null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let off = false;
    setFailed(false);
    const known = drawn.get(`${fileId}:${width}`);
    if (known) {
      setSrc(known);
      return;
    }
    setSrc(null);
    draw(fileId, width)
      .then((u) => !off && setSrc(u))
      .catch(() => !off && setFailed(true));
    return () => {
      off = true;
    };
  }, [fileId, width]);

  if (failed) {
    return (
      <div className={`flex aspect-[8.5/11] w-full items-center justify-center bg-muted p-3 text-center text-xs text-muted-foreground ${className}`} role="img" aria-label={alt}>{tr("Preview not available")}</div>
    );
  }
  if (!src) return <div className={`shimmer aspect-[8.5/11] w-full bg-muted ${className}`} aria-busy aria-label={tr("Loading: {alt}", { alt })} />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} draggable={false} className={`block w-full select-none bg-white ${className}`} />;
}
