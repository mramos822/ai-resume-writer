"use client";

import React, { useEffect, useRef, useState } from "react";
import { useT } from "@/i18n/provider";
import { loadStats } from "@/lib/siteStats";

/** The number of resumes created, kept live: it connects to /api/stats/stream and moves the moment someone creates one. */
function useLiveResumeCount(): number | null {
  const [total, setTotal] = useState<number | null>(null);
  useEffect(() => {
    if (typeof EventSource === "undefined") {
      // very old browser: ask every 10 seconds instead
      const ask = () =>
        fetch("/api/stats")
          .then((r) => r.json())
          .then((d) => typeof d.resumes === "number" && setTotal(d.resumes))
          .catch(() => {});
      ask();
      const t = setInterval(ask, 10_000);
      return () => clearInterval(t);
    }
    // the number is asked for at once (the live feed below can take a few seconds to open), and the feed keeps it moving
    loadStats().then((d) => typeof d.resumes === "number" && setTotal((cur) => cur ?? d.resumes!));
    const es = new EventSource("/api/stats/stream"); // reconnects by itself if the connection drops
    es.onmessage = (e) => {
      try {
        const n = JSON.parse(e.data).resumes;
        if (typeof n === "number") setTotal(n);
      } catch {
        /* ignore a broken message */
      }
    };
    return () => es.close();
  }, []);
  return total;
}

/** Counts from the old number to the new one, so a new resume is seen as a tick and not a jump. */
function useTween(target: number | null): number {
  const [shown, setShown] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    if (target === null) return;
    const start = performance.now();
    const begin = from.current;
    const dur = begin === 0 ? 1400 : 600;
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / dur);
      const v = Math.round(begin + (target - begin) * (1 - Math.pow(1 - t, 3)));
      from.current = v;
      setShown(v);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target]);
  return shown;
}

export default function LiveResumeCount({ tone = "light", size = "lg", variant = "plain" }: { tone?: "light" | "dark"; size?: "md" | "lg"; variant?: "plain" | "tiles" }) {
  const { tr } = useT();
  const total = useLiveResumeCount();
  const shown = useTween(total);
  const [pulse, setPulse] = useState(0);
  const prev = useRef<number | null>(null);

  // a little flash each time the number really goes up
  useEffect(() => {
    if (total !== null && prev.current !== null && total > prev.current) setPulse((p) => p + 1);
    prev.current = total;
  }, [total]);

  const dark = tone === "dark";

  // one tile per digit, like a counter board: a new resume makes the last digits turn over
  if (variant === "tiles") {
    const text = total === null ? "" : shown.toLocaleString("en-US");
    return (
      <div aria-live="polite" aria-label={total === null ? tr("Loading resumes created") : tr("{text} resumes created", { text })}>
        <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-blue-100">
          <span className="relative flex h-2 w-2" aria-hidden>
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-green-400" />
          </span>{tr("Live now")}</div>
        <div key={pulse} className={`flex items-end gap-1.5 ${pulse > 0 ? "animate-[pulse_0.7s_ease-out_1]" : ""}`} aria-hidden>
          {total === null
            ? [0, 1].map((i) => <span key={i} className="h-14 w-10 animate-pulse rounded-lg bg-white/15" />)
            : text.split("").map((ch, i, all) =>
                ch === "," ? (
                  <span key={i} className="pb-1 text-2xl font-bold text-white/60">,</span>
                ) : (
                  <span
                    key={`${all.length - i}-${ch}`}
                    className="relative flex h-14 w-10 items-center justify-center rounded-lg bg-white/15 text-3xl font-extrabold tabular-nums text-white shadow-inner ring-1 ring-white/20 after:absolute after:inset-x-0 after:top-1/2 after:h-px after:bg-black/20"
                  >
                    {ch}
                  </span>
                ),
              )}
        </div>
        <p className="mt-3 text-sm text-blue-100">{tr("resumes created with Kaizo")}</p>
      </div>
    );
  }

  return (
    <div aria-live="polite">
      <p key={pulse} className={`font-extrabold tabular-nums ${size === "lg" ? "text-2xl sm:text-3xl" : "text-4xl xl:text-5xl"} ${dark ? "text-white" : "text-blue-600"} ${pulse > 0 ? "animate-[pulse_0.7s_ease-out_1]" : ""}`}>
        {total === null ? "…" : shown.toLocaleString("en-US")}
      </p>
      <p className={`mt-1 flex items-center ${dark ? "justify-start" : "justify-center"} gap-1.5 text-sm ${dark ? "text-blue-100" : "text-gray-600"}`}>
        <span className="relative flex h-2 w-2" aria-hidden>
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
        </span>{tr("resumes created, live")}</p>
    </div>
  );
}
