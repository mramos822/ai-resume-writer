import { ObjectId } from "mongodb";
import admin from "@/lib/firebase-admin";
import { db } from "@/lib/mongodb";
import { HttpError } from "@/lib/apiAuth";
import { mergeProfileData, sameName } from "@/lib/profileMatch";

// A guest who creates an account (or logs in) keeps what they made: everything under the guest id moves to the real account.
// It needs two proofs at once, the token of the new account and the token the guest still holds, so nobody can take a guest's work
// without being that guest.

const isEmpty = (d: Record<string, unknown> | undefined) => {
  const x = (d ?? {}) as { name?: string; jobTitle?: string; careerObjective?: string; skills?: unknown[]; jobHistory?: unknown[]; education?: unknown[]; projects?: unknown[] };
  const blankName = !x.name || /^(John Doe|Profile \d+)$/.test(x.name.trim());
  return blankName && !x.jobTitle && !x.careerObjective && !(x.skills?.length) && !(x.jobHistory?.length) && !(x.education?.length) && !(x.projects?.length);
};

export async function claimGuest(newUid: string, guestToken: string): Promise<{ profileId: string | null; mergedInto?: string }> {
  if (newUid.startsWith("guest-")) throw new HttpError(400, "Sign in with your account first.");
  let guestUid: string;
  try {
    guestUid = (await admin.auth().verifyIdToken(guestToken)).uid;
  } catch {
    throw new HttpError(401, "Your guest session expired. Start again from the home page.");
  }
  if (!guestUid.startsWith("guest-")) throw new HttpError(400, "That was not a guest session.");

  const profiles = await db.collection("profiles").find({ userId: guestUid }).sort({ updatedAt: -1 }).toArray();
  const moved = profiles.map((p) => p._id.toString());

  await db.collection("profiles").updateMany({ userId: guestUid }, { $set: { userId: newUid } });
  await db.collection("uploads.files").updateMany({ "metadata.userId": guestUid }, { $set: { "metadata.userId": newUid } });
  await Promise.all([
    db.collection("jobAds").updateMany({ userId: guestUid }, { $set: { userId: newUid } }),
    db.collection("applications").updateMany({ userId: guestUid }, { $set: { userId: newUid } }),
    db.collection("savedJobs").updateMany({ userId: guestUid }, { $set: { userId: newUid } }),
    db.collection<{ _id: string }>("users").deleteOne({ _id: guestUid }),
  ]);

  // the new account may have got an empty "Profile 1" while signing in: it is not needed now that the real one arrived
  if (moved.length > 0) {
    const mine = await db.collection("profiles").find({ userId: newUid, _id: { $nin: moved.map((id) => new ObjectId(id)) } }).toArray();
    const emptyIds = mine.filter((p) => isEmpty(p.data as Record<string, unknown>)).map((p) => p._id);
    if (emptyIds.length > 0) await db.collection("profiles").deleteMany({ _id: { $in: emptyIds }, userId: newUid });
  }

  // Same person, same profile: when the account already has a profile with the same (or a very similar) name as the resume that just
  // arrived, the resume goes into that profile instead of making a duplicate. Nothing the old profile had is lost.
  let profileId: string | null = moved[0] ?? null;
  let mergedInto: string | undefined;
  if (profileId) {
    const arrived = await db.collection("profiles").findOne({ _id: new ObjectId(profileId), userId: newUid });
    const arrivedName = ((arrived?.data as { name?: string } | undefined)?.name || (arrived?.name as string | undefined)) ?? "";
    const others = await db.collection("profiles").find({ userId: newUid, _id: { $ne: new ObjectId(profileId) } }).toArray();
    const twin = others.find((p) => sameName((p.data as { name?: string } | undefined)?.name || (p.name as string), arrivedName));
    if (arrived && twin) {
      const data = mergeProfileData(twin.data as Record<string, unknown>, arrived.data as Record<string, unknown>);
      await db.collection("profiles").updateOne({ _id: twin._id, userId: newUid }, { $set: { data, updatedAt: new Date() } });
      const from = profileId;
      const to = twin._id.toString();
      await db.collection("uploads.files").updateMany({ "metadata.profileId": from }, { $set: { "metadata.profileId": to } });
      await Promise.all([
        db.collection("jobAds").updateMany({ userId: newUid, profileId: from }, { $set: { profileId: to } }),
        db.collection("applications").updateMany({ userId: newUid, profileId: from }, { $set: { profileId: to } }),
      ]);
      await db.collection("profiles").deleteOne({ _id: new ObjectId(from), userId: newUid });
      profileId = to;
      mergedInto = (twin.name as string) || (twin.data as { name?: string } | undefined)?.name || "";
    }
  }

  try {
    const fs = admin.firestore();
    await fs.recursiveDelete(fs.doc(`users/${guestUid}`));
  } catch {
    /* nothing to clean */
  }
  await admin.auth().deleteUser(guestUid).catch(() => {});
  return { profileId, ...(mergedInto !== undefined && { mergedInto }) };
}
