import { NextResponse } from "next/server";
import { authUid, errorResponse, HttpError } from "@/lib/apiAuth";
import { db } from "@/lib/mongodb";
import { cleanListing, type JobListing } from "@/lib/jobSearch";

// Jobs the person saved from the job search.
const col = () => db.collection("savedJobs");

export async function GET(req: Request) {
  try {
    const uid = await authUid(req);
    const docs = await col().find({ userId: uid }).sort({ savedAt: -1 }).limit(200).toArray();
    return NextResponse.json(docs.map((d) => ({ ...(d.job as JobListing), savedAt: d.savedAt })));
  } catch (err) {
    return errorResponse(err, "We couldn't load your saved jobs.");
  }
}

export async function POST(req: Request) {
  try {
    const uid = await authUid(req);
    const job = cleanListing(await req.json().catch(() => null));
    if (!job) throw new HttpError(400, "That job could not be saved.");
    await col().updateOne({ userId: uid, "job.key": job.key }, { $set: { userId: uid, job, savedAt: new Date() } }, { upsert: true });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err, "We couldn't save that job.");
  }
}

export async function DELETE(req: Request) {
  try {
    const uid = await authUid(req);
    const key = new URL(req.url).searchParams.get("key");
    if (!key) throw new HttpError(400, "Job not provided.");
    await col().deleteOne({ userId: uid, "job.key": key });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err, "We couldn't remove that job.");
  }
}
