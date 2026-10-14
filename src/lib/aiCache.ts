// The same question to the AI about the same content should give the same answer, and should not cost another 20 seconds. Answers are kept
// by what was asked (a hash of everything the AI was given, the model and the version of the prompt), per person. A different resume,
// another job, another confirmed fact or a changed prompt is a different key, so nothing stale is ever shown.
import { createHash } from "crypto";
import { db } from "@/lib/mongodb";
import { AI_MODEL, AI_MODEL_STRONG } from "@/lib/aiConfig";

export const hashOf = (v: unknown): string => createHash("sha256").update(JSON.stringify(v)).digest("hex");

/** A job as the AI saw it: the same posting text gives the same signature, an edited one does not. */
export const jobSignature = (job: { key: string; title: string; company: string; tags?: string[]; description?: string; snippet?: string }) => ({
  key: job.key,
  text: createHash("sha1").update(`${job.title}|${job.company}|${(job.tags ?? []).join(",")}|${job.description || job.snippet || ""}`).digest("hex").slice(0, 16),
});

const KEEP_DAYS = 30;
let indexed = false;

/**
 * `compute` runs only when this exact question has no kept answer. An answer is kept only when `usable` says it is a real one (a failed
 * call, which comes back empty, is never kept: the next try asks again). If the store is down, it simply asks every time.
 */
export async function cachedAi<T>(
  scope: string,
  uid: string,
  key: unknown,
  compute: () => Promise<T>,
  usable: (value: T) => boolean = () => true,
  refresh = false // the person asked for a new one: the kept answer is skipped and the new one replaces it
): Promise<{ value: T; cached: boolean }> {
  const hash = hashOf({ scope, model: AI_MODEL, strong: AI_MODEL_STRONG, key });
  let col: ReturnType<typeof db.collection> | null = null;
  try {
    col = db.collection("aiCache");
    if (!indexed) {
      indexed = true;
      col.createIndex({ createdAt: 1 }, { expireAfterSeconds: KEEP_DAYS * 24 * 3600 }).catch(() => {});
      col.createIndex({ uid: 1, hash: 1 }).catch(() => {});
    }
  } catch {
    col = null;
  }
  if (col && !refresh) {
    const hit = await col.findOne<{ value: T }>({ uid, hash }).catch(() => null);
    if (hit && "value" in hit) return { value: hit.value, cached: true };
  }
  const value = await compute();
  if (col && usable(value)) {
    await col.updateOne({ uid, hash }, { $set: { uid, hash, scope, value, createdAt: new Date() } }, { upsert: true }).catch(() => {});
  }
  return { value, cached: false };
}
