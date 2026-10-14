"use client";

import { useEffect, useState } from "react";
import { POPULAR_TEMPLATES } from "@/lib/templates";

// The "Popular" ribbon goes to the three looks that have made the most resumes, worked out from the live counts, so it moves by itself.
// Until the counts arrive (or if they cannot be read) the default three are used. The counts are fetched once a minute at most.
const TTL = 60_000;
let cache: { at: number; counts: Record<string, number> } | null = null;
let inflight: Promise<Record<string, number>> | null = null;

export function loadLookCounts(): Promise<Record<string, number>> {
  if (cache && Date.now() - cache.at < TTL) return Promise.resolve(cache.counts);
  inflight ??= fetch("/api/stats")
    .then((r) => r.json())
    .then((d) => {
      const counts = (d?.templates ?? {}) as Record<string, number>;
      cache = { at: Date.now(), counts };
      return counts;
    })
    .catch(() => cache?.counts ?? {})
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

/** The three looks with the most resumes; a tie is settled by the default order, and missing places are filled from the defaults. */
export function topThree(counts: Record<string, number>): string[] {
  const order = (id: string) => POPULAR_TEMPLATES.indexOf(id as never);
  const ranked = Object.entries(counts)
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1] || (order(a[0]) === -1 ? 99 : order(a[0])) - (order(b[0]) === -1 ? 99 : order(b[0])))
    .map(([id]) => id);
  return [...new Set([...ranked, ...POPULAR_TEMPLATES])].slice(0, 3);
}

/** Returns `isPopular(id)`, true for the current top three. */
export function usePopularTemplates(): (id: unknown) => boolean {
  const [counts, setCounts] = useState<Record<string, number> | null>(cache?.counts ?? null);
  useEffect(() => {
    let alive = true;
    const run = () => loadLookCounts().then((c) => alive && setCounts(c));
    run();
    const t = window.setInterval(run, TTL);
    return () => {
      alive = false;
      window.clearInterval(t);
    };
  }, []);
  const top = counts ? topThree(counts) : [...POPULAR_TEMPLATES];
  return (id) => top.includes(String(id));
}
