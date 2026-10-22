// Postings that PEOPLE bring in with a link feed the jobs index too, for a while, so the search finds them for everybody:
//  - a Computrabajo offer goes in at once, as one more Computrabajo job (the same key the scheduled reading uses, so it is never read twice and never
//    repeated); it is read from the data its page publishes, with no AI, and the scheduled reading then keeps it open or lets it close;
//  - any other posting is shared when a SECOND person adds the same link (see lib/jobImports): one person alone cannot put a job in front of everybody.
// A shared posting expires by itself (the index removes it) and is never shared if it is already in the index.
import { index } from "@/lib/ingest/run";
import { allowed, CT_SITES, fromComputrabajo } from "@/lib/ingest/computrabajo";
import { get } from "@/lib/ingest/computrabajo";
import { detectLanguage } from "@/lib/ingest/language";
import type { IndexedJob } from "@/lib/ingest/ats";
import { packDescription, unpackDescription } from "@/lib/ingest/pack";

/** how long a posting that a person added stays in the search if nothing else keeps it */
export const ADDED_KEPT_MS = 14 * 24 * 60 * 60 * 1000;

/** The country site, the path and the id of a link to ONE Computrabajo offer; null for any other link. */
export function computrabajoOffer(link: string): { site: string; host: string; path: string; id: string } | null {
  try {
    const u = new URL(link);
    const site = /^([a-z]{2})\.computrabajo\.com$/i.exec(u.hostname)?.[1]?.toLowerCase();
    const id = /^\/ofertas-de-trabajo\/oferta-de-trabajo-de-[^/?#]*-([0-9A-F]{32})$/i.exec(u.pathname)?.[1]?.toUpperCase();
    if (!site || !CT_SITES[site] || !id || !allowed(u.pathname)) return null;
    return { site, host: u.hostname.toLowerCase(), path: u.pathname, id };
  } catch {
    return null;
  }
}

/** Writes a job into the index as open, for `ADDED_KEPT_MS`. */
export async function putInIndex(job: IndexedJob, now = new Date()): Promise<void> {
  const doc: Record<string, unknown> = { ...job, lang: detectLanguage(`${job.title} ${job.description ?? ""}`), active: true, lastSeenAt: now };
  const empty = Object.keys(doc).filter((k) => doc[k] === undefined);
  empty.forEach((k) => delete doc[k]);
  const packed = packDescription(doc); // the description is kept compressed (descZ): see ingest/pack
  await index().updateOne(
    { key: job.key } as never,
    { $set: { ...packed, expiresAt: new Date(+now + ADDED_KEPT_MS) }, $setOnInsert: { firstSeenAt: now }, $unset: { closedAt: "", ...("descZ" in packed ? { description: "" } : { descZ: "" }), ...Object.fromEntries(empty.map((k) => [k, ""])) } } as never,
    { upsert: true }
  );
}

/**
 * The job of a link to one Computrabajo offer, and the offer is in the index when this returns. One that is already there is not read again.
 * Null when the link is not an offer of Computrabajo, or the page could not be read (the caller goes on with the general way).
 */
export async function addComputrabajoOffer(link: string): Promise<IndexedJob | null> {
  const o = computrabajoOffer(link);
  if (!o) return null;
  const key = `computrabajo:${o.site}:${o.id}`;
  try {
    const have = await index().findOne({ key, active: true });
    if (have) {
      const { _id, ...job } = unpackDescription(have) as unknown as IndexedJob & { _id?: unknown };
      void _id;
      return job;
    }
    const html = await get(`https://${o.host}${o.path}`);
    const job = html ? fromComputrabajo({ source: "computrabajo", token: `${o.site}:added` }, html, o.path, o.id) : null;
    if (!job) return null;
    await putInIndex(job);
    return job;
  } catch {
    return null;
  }
}
