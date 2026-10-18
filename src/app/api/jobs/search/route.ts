import { after, NextResponse } from "next/server";
import { authUid, errorResponse, HttpError } from "@/lib/apiAuth";
import { ENOUGH_OWN, isPartialPosting, searchJobs, searchJobsWide, type ExtraSource } from "@/lib/jobSearch";
import { readPlace } from "@/lib/jobPlaces";
import { enrichListings } from "@/lib/jobEnrich";
import { ADZUNA_TTL, cachedSearch, QUERY_TTL, rememberSearch, searchKey, withKnownText } from "@/lib/jobCatalog";
import { searchIndex } from "@/lib/ingest/searchIndex";
import { ingestNow } from "@/lib/ingest/schedule";
import { withStoredFacts } from "@/lib/jobFactsStore";

// Job search for signed-in people. It answers in two parts so the person waits as little as possible:
//  - ?phase=own: our own index (complete postings, found at once),
//  - ?phase=live: Remotive and Arbeitnow (other sites, whole postings), and ?phase=adzuna: Adzuna (its postings come cut and are read
//    one by one: the slowest), each added to the list when it arrives.
// Without a phase it does both, as before. Every answer says where its time went in the Server-Timing header.

// our own index (what the automatic ingestion keeps): complete postings, found at once
const OWN: ExtraSource[] = [["Company career pages", (q) => searchIndex(q)]];

/** Jobs whose posting could not be read whole are left out (a resume for them would be written from half of it); if that leaves nothing, they stay. */
const withoutCut = <T extends Parameters<typeof isPartialPosting>[0]>(jobs: T[]): T[] => {
  const whole = jobs.filter((j) => !isPartialPosting(j));
  return whole.length > 0 ? whole : jobs;
};

const hits = new Map<string, { count: number; since: number }>();

/** Marks how long each step took, for the Server-Timing header (visible in the browser's network panel). */
function timer() {
  const marks: string[] = [];
  let last = performance.now();
  return {
    mark(name: string) {
      const n = performance.now();
      marks.push(`${name};dur=${Math.round(n - last)}`);
      last = n;
    },
    header: () => ({ "Server-Timing": marks.join(", ") }),
  };
}

export async function GET(req: Request) {
  try {
    const t = timer();
    const uid = await authUid(req);
    t.mark("auth");
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
      // English always; Spanish too for someone who uses Kaizo in Spanish (jobs of Latin America)
      // (or every language, when the person chose "All languages")
      langs: sp.get("lang") === "all" ? ["en", "es", "fr", "de", "pt", "it"] : sp.get("lang") === "es" ? ["en", "es"] : ["en"],
    };
    // wide = also search similar titles and the person's main skills, so the pool is bigger and closer to their profile
    const skills = (sp.get("skills") ?? "").split(",").map((x) => x.trim()).filter(Boolean).slice(0, 3);
    after(() => ingestNow({ by: "search", onlyIfDue: true })); // the index follows the companies even without a scheduler
    const wide = sp.get("wide") === "1";
    const asked = sp.get("phase");
    const phase = asked === "own" || asked === "live" || asked === "adzuna" ? asked : "all";
    const live = phase === "own" ? "never" : phase === "all" ? "auto" : "only";
    const boards = phase === "live" ? "fast" : phase === "adzuna" ? "adzuna" : "all";
    // a search someone made a moment ago comes back at once, and does not use up the daily limit of the job boards
    const qkey = searchKey([wide, query.q, query.location, query.remoteOnly, query.country, skills.join(","), query.langs.join("+"), phase]);
    // when our own jobs are plenty and no place was asked for, the other boards add nothing: the page need not ask for them
    const moreToCome = (n: number) => phase === "own" && (query.location.trim() !== "" || n < ENOUGH_OWN);
    t.mark("setup");
    const ttl = phase === "adzuna" ? ADZUNA_TTL : QUERY_TTL;
    const again = await cachedSearch(qkey, ttl);
    t.mark("cache");
    if (again) {
      const jobs = await withStoredFacts(again.jobs);
      t.mark("facts");
      return NextResponse.json({ ...again, jobs, place: place?.label ?? null, more: moreToCome(again.jobs.length) }, { headers: t.header() });
    }
    const result = wide ? await searchJobsWide(query, skills, OWN, { live, boards }) : await searchJobs(query, OWN, { live, boards });
    t.mark("search");
    // the boards share only the start of some postings: what was already read is reused, the rest is read now, so the fit shown is the real one
    const jobs = withoutCut(await enrichListings(await withKnownText(result.jobs)));
    t.mark("read");
    const found = { jobs, sources: result.sources, bigCity: result.bigCity };
    // remembered after the answer has gone: nobody waits for the database to write it down
    after(() => rememberSearch(qkey, found, ttl));
    const withFacts = await withStoredFacts(found.jobs);
    t.mark("facts");
    return NextResponse.json({ ...found, jobs: withFacts, place: place?.label ?? null, more: moreToCome(found.jobs.length) }, { headers: t.header() });
  } catch (err) {
    return errorResponse(err, "We couldn't search for jobs right now.");
  }
}
