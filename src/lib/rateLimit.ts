import { NextResponse } from "next/server";

// `limited` is a small in-memory limiter: N requests per window per client, per server. `limitedShared` adds a count kept in the database,
// so the limit also holds when the site runs on several servers (or serverless instances) that do not share memory.
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

let indexed = false;

/** Like `limited`, but the count is shared by all servers. If the database is not available it falls back to the in-memory count only. */
export async function limitedShared(req: Request, bucket: string, max: number, windowMs: number): Promise<NextResponse | null> {
  const local = limited(req, bucket, max, windowMs);
  if (local) return local;
  try {
    const { db } = await import("@/lib/mongodb");
    const col = db.collection<{ _id: string; n: number; expireAt: Date }>("rateLimits");
    if (!indexed) {
      indexed = true;
      col.createIndex({ expireAt: 1 }, { expireAfterSeconds: 0 }).catch(() => {});
    }
    const now = Date.now();
    const slot = Math.floor(now / windowMs);
    const doc = await col.findOneAndUpdate(
      { _id: `${bucket}:${clientKey(req)}:${slot}` },
      { $inc: { n: 1 }, $setOnInsert: { expireAt: new Date((slot + 2) * windowMs) } },
      { upsert: true, returnDocument: "after" }
    );
    if (doc && doc.n > max) {
      const wait = Math.max(1, Math.ceil(((slot + 1) * windowMs - now) / 1000));
      return NextResponse.json({ error: "Too many requests. Please try again in a moment." }, { status: 429, headers: { "Retry-After": String(wait) } });
    }
  } catch {
    /* the in-memory limit above still applies */
  }
  return null;
}
