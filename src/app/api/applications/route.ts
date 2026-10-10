import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { authUid, errorResponse, HttpError } from "@/lib/apiAuth";
import { bucket, db } from "@/lib/mongodb";

// The applications of the signed-in person: the job, the tailored resume and cover letter, and where it stands.
const STATUSES = ["prepared", "applied", "interview", "offer", "rejected"] as const;
const col = () => db.collection("applications");

export async function GET(req: Request) {
  try {
    const uid = await authUid(req);
    const docs = await col().find({ userId: uid }).sort({ updatedAt: -1 }).limit(200).toArray();
    // a resume file can be deleted from the Resumes page: only report files that still exist, so the app makes a new one
    const ids = docs.map((d) => d.fileId).filter((x): x is string => typeof x === "string" && ObjectId.isValid(x));
    const alive = new Set((await db.collection("uploads.files").find({ _id: { $in: ids.map((x) => new ObjectId(x)) } }, { projection: { _id: 1 } }).toArray()).map((f) => f._id.toString()));
    return NextResponse.json(
      docs.map((d) => ({ job: d.job, fileId: d.fileId && alive.has(String(d.fileId)) ? d.fileId : null, coverLetter: d.coverLetter ?? "", template: d.template ?? "classic", status: d.status ?? "prepared", updatedAt: d.updatedAt, createdAt: d.createdAt }))
    );
  } catch (err) {
    return errorResponse(err, "We couldn't load your applications.");
  }
}

export async function PATCH(req: Request) {
  try {
    const uid = await authUid(req);
    const { key, status } = (await req.json().catch(() => ({}))) as { key?: string; status?: string };
    if (!key || !STATUSES.includes(status as (typeof STATUSES)[number])) throw new HttpError(400, "Invalid status.");
    await col().updateOne({ userId: uid, "job.key": key }, { $set: { status, updatedAt: new Date(), ...(status === "applied" ? { appliedAt: new Date() } : {}) } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err, "We couldn't update that application.");
  }
}

export async function DELETE(req: Request) {
  try {
    const uid = await authUid(req);
    const key = new URL(req.url).searchParams.get("key");
    if (!key) throw new HttpError(400, "Application not provided.");
    const doc = await col().findOne<{ fileId?: string }>({ userId: uid, "job.key": key });
    await col().deleteOne({ userId: uid, "job.key": key });
    if (doc?.fileId) {
      try {
        await bucket.delete(new ObjectId(doc.fileId));
      } catch {
        /* already gone */
      }
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err, "We couldn't remove that application.");
  }
}
