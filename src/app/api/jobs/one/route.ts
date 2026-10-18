import { NextResponse } from "next/server";
import { authUid, errorResponse, HttpError } from "@/lib/apiAuth";
import { jobByKey } from "@/lib/jobImports";
import { limitedShared } from "@/lib/rateLimit";

// One job by its key, for a link inside the app (/home/job-ads?job=<key>): the jobs of our own index and the ones added from a link.
// A job of Adzuna is not kept anywhere (its terms limit it), so it is not here: it is found again by searching.
export async function GET(req: Request) {
  const tooMany = await limitedShared(req, "job-one", 120, 10 * 60 * 1000);
  if (tooMany) return tooMany;
  try {
    await authUid(req);
    const key = (new URL(req.url).searchParams.get("key") ?? "").slice(0, 300);
    if (!/^[a-z]+:[\w.:@%-]+$/i.test(key)) throw new HttpError(400, "That job link is not valid.");
    const job = await jobByKey(key);
    if (!job) throw new HttpError(404, "That job is no longer available here. Search for it again.");
    return NextResponse.json({ job });
  } catch (err) {
    return errorResponse(err, "We couldn't open that job.");
  }
}
