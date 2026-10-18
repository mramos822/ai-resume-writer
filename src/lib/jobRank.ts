// The order of the jobs: the most recent first, and among the ones of the same age, the best fit first. A job posted today with a modest fit
// shows before one posted a month ago with a better fit; between two jobs of the same age, the one that fits better goes first.

const DAY = 24 * 60 * 60 * 1000;

/** How old a job is, in steps: 0 = the last two days, 1 = this week, 2 = two weeks, 3 = a month, 4 = three months, 5 = older or without a date. */
export function ageStep(postedAt: string | undefined, now: number = Date.now()): number {
  const t = Date.parse(String(postedAt ?? ""));
  if (!Number.isFinite(t) || t <= 0) return 5;
  const days = (now - t) / DAY;
  return days <= 2 ? 0 : days <= 7 ? 1 : days <= 14 ? 2 : days <= 30 ? 3 : days <= 90 ? 4 : 5;
}

/** For sort(): newer step first, then the better fit, then the newer date. */
export function byFreshnessThenFit(a: { postedAt?: string; fit: number }, b: { postedAt?: string; fit: number }, now: number = Date.now()): number {
  return ageStep(a.postedAt, now) - ageStep(b.postedAt, now) || b.fit - a.fit || (Date.parse(b.postedAt ?? "") || 0) - (Date.parse(a.postedAt ?? "") || 0);
}
