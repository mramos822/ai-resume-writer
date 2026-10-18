// The public numbers of /api/stats (resumes made, resumes per look). Several parts of the landing page need them at the same moment,
// so they share one request, and the answer is reused for a minute.
export type SiteStats = { resumes?: number; templates?: Record<string, number> };

const TTL = 60_000;
let cache: { at: number; stats: SiteStats } | null = null;
let inflight: Promise<SiteStats> | null = null;

export function loadStats(): Promise<SiteStats> {
  if (cache && Date.now() - cache.at < TTL) return Promise.resolve(cache.stats);
  inflight ??= fetch("/api/stats")
    .then((r) => r.json())
    .then((d) => {
      const stats = (d ?? {}) as SiteStats;
      cache = { at: Date.now(), stats };
      return stats;
    })
    .catch(() => cache?.stats ?? {})
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

/** What is already known, with no request (used to draw the first frame with the real numbers when they are there). */
export function cachedStats(): SiteStats | null {
  return cache?.stats ?? null;
}
