import { NextResponse } from "next/server";

// A small in-memory limiter: N requests per window per client. It is enough to stop a script from hammering one endpoint on a
// single server; with several servers each keeps its own count (move it to a shared store such as Redis if that happens).
const hits = new Map<string, { n: number; reset: number }>();

export function clientKey(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return fwd || req.headers.get("x-real-ip") || "unknown";
}

/** Returns a 429 response when the client is over the limit, otherwise null. */
export function limited(req: Request, bucket: string, max: number, windowMs: number): NextResponse | null {
  const now = Date.now();
  const key = `${bucket}:${clientKey(req)}`;
  const cur = hits.get(key);
  if (!cur || cur.reset <= now) {
    hits.set(key, { n: 1, reset: now + windowMs });
    if (hits.size > 5000) for (const [k, v] of hits) if (v.reset <= now) hits.delete(k);
    return null;
  }
  cur.n += 1;
  if (cur.n <= max) return null;
  const wait = Math.max(1, Math.ceil((cur.reset - now) / 1000));
  return NextResponse.json({ error: "Too many requests. Please try again in a moment." }, { status: 429, headers: { "Retry-After": String(wait) } });
}
