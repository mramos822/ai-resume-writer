import { after, NextResponse } from "next/server";
import { authUid, errorResponse } from "@/lib/apiAuth";
import { limitedShared } from "@/lib/rateLimit";
import { cleanListing, type JobListing } from "@/lib/jobSearch";
import { storedFacts, warm } from "@/lib/jobFactsStore";

// The page tells which jobs the person has on screen. The ones the AI has not read yet are read in the background, slowly and within the
// day's budget (see lib/jobFactsStore); the answer is immediate: the facts that are already known, and how many are being read.
export const maxDuration = 60;
const MAX_JOBS = 12;

export async function POST(req: Request) {
  const tooMany = await limitedShared(req, "job-warm", 30, 10 * 60 * 1000);
  if (tooMany) return tooMany;
  try {
    await authUid(req);
    const body = (await req.json().catch(() => ({}))) as { jobs?: unknown };
    const jobs = (Array.isArray(body.jobs) ? body.jobs : [])
      .slice(0, MAX_JOBS)
      .map((j) => cleanListing(j as never))
      .filter((j): j is JobListing => !!j);
    const ready = await storedFacts(jobs.map((j) => j.key));
    const pending = jobs.filter((j) => !ready[j.key]);
    // after the answer has gone: about ten readings fit in the time a function may run
    if (pending.length > 0) after(() => warm(pending.slice(0, 10)).catch((e) => console.error("Warm failed", e instanceof Error ? e.message : e)));
    return NextResponse.json({ ready, pending: pending.length });
  } catch (err) {
    return errorResponse(err, "We couldn't read those jobs.");
  }
}
