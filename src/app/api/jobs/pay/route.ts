import { NextResponse } from "next/server";
import { authUid, errorResponse } from "@/lib/apiAuth";
import { limitedShared } from "@/lib/rateLimit";
import { cleanListing, type JobListing } from "@/lib/jobSearch";
import { knownPays, rememberPays } from "@/lib/jobCatalog";
import { readPay } from "@/lib/jobEnrich";

// The pay of the jobs a person has on screen. Job boards often leave the pay out of what they share ("$29 / hr - $53.50 / hr" is in the text of
// the posting, not in the data), so it is read from the posting itself (no AI), once for everybody: what was read is kept for the job.
// The answer holds what is known by now: a pay, null when the posting was read and names none; a job that could not be read is not in it.
export const maxDuration = 30;
const MAX_JOBS = 30;
const BUDGET_MS = 9000;
const PARALLEL = 5;

export async function POST(req: Request) {
  const tooMany = await limitedShared(req, "job-pay", 40, 10 * 60 * 1000);
  if (tooMany) return tooMany;
  try {
    await authUid(req);
    const body = (await req.json().catch(() => ({}))) as { jobs?: unknown };
    const jobs = (Array.isArray(body.jobs) ? body.jobs : [])
      .slice(0, MAX_JOBS)
      .map((j) => cleanListing(j as never))
      .filter((j): j is JobListing => !!j && !j.salary);
    const pays = await knownPays(jobs.map((j) => j.key));
    const todo = jobs.filter((j) => !(j.key in pays));
    const found: { key: string; source: JobListing["source"]; pay: string | null }[] = [];
    const stop = Date.now() + BUDGET_MS;
    const queue = [...todo];
    const worker = async () => {
      for (let j = queue.shift(); j; j = queue.shift()) {
        if (Date.now() > stop) return;
        const pay = await readPay(j).catch(() => undefined);
        if (pay !== undefined) {
          pays[j.key] = pay;
          found.push({ key: j.key, source: j.source, pay });
        }
      }
    };
    await Promise.all(Array.from({ length: PARALLEL }, worker));
    await rememberPays(found);
    return NextResponse.json({ pays });
  } catch (err) {
    return errorResponse(err, "We couldn't read the pay of those jobs.");
  }
}
