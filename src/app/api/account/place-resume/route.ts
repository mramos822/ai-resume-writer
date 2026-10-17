import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { authUid, ownedProfile, errorResponse, HttpError } from "@/lib/apiAuth";
import { db } from "@/lib/mongodb";
import { limitedShared } from "@/lib/rateLimit";

/**
 * After a guest creates an account their resume sits in a profile of its own. This lets them choose another profile of the
 * account to hold it: the details of the resume replace that profile's details, its PDF files move there, and the profile that
 * was made for the resume is removed (it is a copy of what now lives in the chosen one).
 */
export async function POST(req: Request) {
  const tooMany = await limitedShared(req, "account", 20, 10 * 60 * 1000);
  if (tooMany) return tooMany;
  try {
    const uid = await authUid(req);
    const body = (await req.json().catch(() => ({}))) as { fromProfileId?: unknown; toProfileId?: unknown };
    if (typeof body.fromProfileId !== "string" || typeof body.toProfileId !== "string") throw new HttpError(400, "Choose a profile.");
    if (body.fromProfileId === body.toProfileId) return NextResponse.json({ profileId: body.toProfileId });

    const from = await ownedProfile(uid, body.fromProfileId);
    const to = await ownedProfile(uid, body.toProfileId);

    await db.collection("profiles").updateOne({ _id: to._id, userId: uid }, { $set: { data: from.data, updatedAt: new Date() } });
    await db.collection("uploads.files").updateMany({ "metadata.profileId": from._id.toString() }, { $set: { "metadata.profileId": to._id.toString() } });
    await Promise.all([
      db.collection("jobAds").updateMany({ userId: uid, profileId: from._id.toString() }, { $set: { profileId: to._id.toString() } }),
      db.collection("applications").updateMany({ userId: uid, profileId: from._id.toString() }, { $set: { profileId: to._id.toString() } }),
    ]);
    await db.collection("profiles").deleteOne({ _id: new ObjectId(from._id), userId: uid });
    return NextResponse.json({ profileId: to._id.toString() });
  } catch (err) {
    return errorResponse(err, "We couldn't move your resume to that profile.");
  }
}
