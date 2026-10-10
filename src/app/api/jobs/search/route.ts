import { NextResponse } from "next/server";
import { authUid, errorResponse, HttpError } from "@/lib/apiAuth";
import { searchJobs, searchJobsWide } from "@/lib/jobSearch";

// Job search for signed-in people: real listings from public job boards (see lib/jobSearch).
const hits = new Map<string, { count: number; since: number }>();

export async function GET(req: Request) {
  try {
    const uid = await authUid(req);
    const now = Date.now();
    const h = hits.get(uid);
    if (!h || now - h.since > 60_000) hits.set(uid, { count: 1, since: now });
    else if (++h.count > 20) throw new HttpError(429, "Too many searches. Wait a moment and try again.");

    const sp = new URL(req.url).searchParams;
    const query = {
      q: (sp.get("q") ?? "").slice(0, 120),
      location: (sp.get("location") ?? "").slice(0, 120),
      remoteOnly: sp.get("remote") === "1",
      country: (sp.get("country") ?? "US").slice(0, 2),
    };
    // wide = also search similar titles and the person's main skills, so the pool is bigger and closer to their profile
    const skills = (sp.get("skills") ?? "").split(",").map((x) => x.trim()).filter(Boolean).slice(0, 3);
    const result = sp.get("wide") === "1" ? await searchJobsWide(query, skills) : await searchJobs(query);
    return NextResponse.json(result);
  } catch (err) {
    return errorResponse(err, "We couldn't search for jobs right now.");
  }
}
