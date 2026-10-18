import { NextResponse } from "next/server";
import { authUid, errorResponse, HttpError } from "@/lib/apiAuth";
import { searchJobs, searchJobsWide } from "@/lib/jobSearch";
import { readPlace } from "@/lib/jobPlaces";
import { enrichListings } from "@/lib/jobEnrich";
import { cachedSearch, rememberSearch, searchKey, withKnownText } from "@/lib/jobCatalog";
import { searchIndex } from "@/lib/ingest/searchIndex";
import type { ExtraSource } from "@/lib/jobSearch";

// our own index (what the automatic ingestion keeps): complete postings, found at once
const OWN: ExtraSource[] = [["Company career pages", (q) => searchIndex(q)]];
import { isPartialPosting } from "@/lib/jobSearch";

/** Jobs whose posting could not be read whole are left out (a resume for them would be written from half of it); if that leaves nothing, they stay. */
const withoutCut = <T extends Parameters<typeof isPartialPosting>[0]>(jobs: T[]): T[] => {
  const whole = jobs.filter((j) => !isPartialPosting(j));
  return whole.length > 0 ? whole : jobs;
};

// Job search for signed-in people: real listings from public job boards (see lib/jobSearch).
const hits = new Map<string, { count: number; since: number }>();

export async function GET(req: Request) {
  try {
    const uid = await authUid(req);
    const now = Date.now();
    const h = hits.get(uid);
    if (!h || now - h.since > 60_000) hits.set(uid, { count: 1, since: now });
    else if (++h.count > 60) throw new HttpError(429, "Too many searches. Wait a moment and try again.");

    const sp = new URL(req.url).searchParams;
    const country = (sp.get("country") ?? "US").slice(0, 2);
    const typed = (sp.get("location") ?? "").slice(0, 120);
    // "Hillside NJ" is read as Hillside, New Jersey, and with its position the jobs are sorted by how far they are
    const place = typed.trim() ? readPlace(country, typed) : null;
    const query = {
      q: (sp.get("q") ?? "").slice(0, 120),
      location: place?.label ?? typed,
      remoteOnly: sp.get("remote") === "1",
      country,
      origin: place?.at,
    };
    // wide = also search similar titles and the person's main skills, so the pool is bigger and closer to their profile
    const skills = (sp.get("skills") ?? "").split(",").map((x) => x.trim()).filter(Boolean).slice(0, 3);
    const wide = sp.get("wide") === "1";
    // a search someone made a moment ago comes back at once, and does not use up the daily limit of the job boards
    const qkey = searchKey([wide, query.q, query.location, query.remoteOnly, query.country, skills.join(",")]);
    const again = await cachedSearch(qkey);
    if (again) return NextResponse.json({ ...again, place: place?.label ?? null });
    const result = wide ? await searchJobsWide(query, skills, OWN) : await searchJobs(query, OWN);
    // the boards share only the start of some postings: what was already read is reused, the rest is read now, so the fit shown is the real one
    const jobs = withoutCut(await enrichListings(await withKnownText(result.jobs)));
    const found = { jobs, sources: result.sources, bigCity: result.bigCity };
    await rememberSearch(qkey, found);
    return NextResponse.json({ ...found, place: place?.label ?? null });
  } catch (err) {
    return errorResponse(err, "We couldn't search for jobs right now.");
  }
}
