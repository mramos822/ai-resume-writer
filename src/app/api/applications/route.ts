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
    const profileId = new URL(req.url).searchParams.get("profileId");
    let docs = await col().find({ userId: uid }).sort({ updatedAt: -1 }).limit(200).toArray();
    if (profileId) {
      // applications made before they were tied to a profile are placed by the profile of their resume file
      const legacy = docs.filter((d) => !d.profileId && typeof d.fileId === "string" && ObjectId.isValid(d.fileId));
      const owner = new Map<string, string>();
      if (legacy.length) {
        const files = await db.collection("uploads.files").find({ _id: { $in: legacy.map((d) => new ObjectId(d.fileId)) } }, { projection: { "metadata.profileId": 1 } }).toArray();
        for (const f of files) owner.set(f._id.toString(), String(f.metadata?.profileId ?? ""));
      }
      docs = docs.filter((d) => (d.profileId ? String(d.profileId) : owner.get(String(d.fileId))) === profileId);
    }
    // a resume file can be deleted from the Resumes page: only report files that still exist, so the app makes a new one
    const ids = docs.map((d) => d.fileId).filter((x): x is string => typeof x === "string" && ObjectId.isValid(x));
    const alive = new Set((await db.collection("uploads.files").find({ _id: { $in: ids.map((x) => new ObjectId(x)) } }, { projection: { _id: 1 } }).toArray()).map((f) => f._id.toString()));
    return NextResponse.json(
      docs.map((d) => ({ job: d.job, fileId: d.fileId && alive.has(String(d.fileId)) ? d.fileId : null, profileId: d.profileId ?? null, coverLetter: d.coverLetter ?? "", template: d.template ?? "classic", status: d.status ?? "prepared", updatedAt: d.updatedAt, createdAt: d.createdAt }))
    );
  } catch (err) {
    return errorResponse(err, "We couldn't load your applications.");
  }
}

export async function PATCH(req: Request) {
  try {
    const uid = await authUid(req);
    const { key, status, profileId, clearCoverLetter } = (await req.json().catch(() => ({}))) as { key?: string; status?: string; profileId?: string; clearCoverLetter?: boolean };
    if (key && clearCoverLetter === true) {
      // only the letter goes: the job and its tailored resume stay
      await col().updateOne({ userId: uid, "job.key": key, ...(profileId ? { profileId } : {}) }, { $set: { coverLetter: "", updatedAt: new Date() } });
      return NextResponse.json({ ok: true });
    }
    if (!key || !STATUSES.includes(status as (typeof STATUSES)[number])) throw new HttpError(400, "Invalid status.");
    await col().updateOne({ userId: uid, "job.key": key, ...(profileId ? { profileId } : {}) }, { $set: { status, updatedAt: new Date(), ...(status === "applied" ? { appliedAt: new Date() } : {}) } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err, "We couldn't update that application.");
  }
}

export async function DELETE(req: Request) {
  try {
    const uid = await authUid(req);
    const params = new URL(req.url).searchParams;
    const key = params.get("key");
    const profileId = params.get("profileId");
    if (!key) throw new HttpError(400, "Application not provided.");
    const filter = { userId: uid, "job.key": key, ...(profileId ? { profileId } : {}) };
    const doc = await col().findOne<{ fileId?: string }>(filter);
    await col().deleteOne(filter);
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
