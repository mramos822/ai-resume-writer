import { ObjectId } from "mongodb";
import admin from "@/lib/firebase-admin";
import { bucket, db } from "@/lib/mongodb";

// Everything Kaizo keeps about one person, in one place: used to export it and to delete it.
// If a new collection that holds user data is added, add it here too (the privacy policy promises a full copy and a full delete).

async function profileIds(uid: string): Promise<string[]> {
  const rows = await db.collection("profiles").find({ userId: uid }, { projection: { _id: 1 } }).toArray();
  return rows.map((r) => r._id.toString());
}

/** A copy of the person's data (not the files themselves: resumes are downloaded as PDF/DOCX from the app). */
export async function exportAccount(uid: string, email?: string | null) {
  const ids = await profileIds(uid);
  const [profiles, jobAds, applications, savedJobs, files] = await Promise.all([
    db.collection("profiles").find({ userId: uid }).toArray(),
    db.collection("jobAds").find({ userId: uid }).toArray(),
    db.collection("applications").find({ userId: uid }).toArray(),
    db.collection("savedJobs").find({ userId: uid }).toArray(),
    db
      .collection("uploads.files")
      .find({ $or: [{ "metadata.userId": uid }, { "metadata.profileId": { $in: ids } }] }, { projection: { filename: 1, uploadDate: 1, length: 1, metadata: 1 } })
      .toArray(),
  ]);
  return {
    exportedAt: new Date().toISOString(),
    account: { id: uid, email: email ?? null },
    profiles,
    jobAds,
    applications,
    savedJobs,
    files: files.map((f) => ({ id: f._id.toString(), name: f.filename, uploadedAt: f.uploadDate, bytes: f.length, kind: f.metadata?.origin ?? f.metadata?.format ?? "file" })),
  };
}

/** Deletes everything Kaizo keeps about the person, then their sign-in account. */
export async function deleteAccount(uid: string, email?: string | null) {
  const ids = await profileIds(uid);

  // files (resumes made, resumes uploaded)
  const files = await db
    .collection("uploads.files")
    .find({ $or: [{ "metadata.userId": uid }, { "metadata.profileId": { $in: ids } }] }, { projection: { _id: 1 } })
    .toArray();
  for (const f of files) {
    try {
      await bucket.delete(new ObjectId(f._id));
    } catch {
      /* already gone */
    }
  }

  await Promise.all([
    db.collection("resumeReviews").deleteMany({ profileId: { $in: ids } }),
    db.collection("applications").deleteMany({ userId: uid }),
    db.collection("savedJobs").deleteMany({ userId: uid }),
    db.collection("aiCache").deleteMany({ uid }),
    db.collection("jobAds").deleteMany({ userId: uid }),
    db.collection("profiles").deleteMany({ userId: uid }),
    db.collection<{ _id: string }>("users").deleteOne({ _id: uid }),
    email ? db.collection("contact_messages").deleteMany({ email: email.toLowerCase() }) : Promise.resolve(),
  ]);

  // the person's documents in Firestore (settings, list of uploads)
  try {
    const fs = admin.firestore();
    await fs.recursiveDelete(fs.doc(`users/${uid}`));
  } catch (e) {
    console.error("Could not clear Firestore data", e instanceof Error ? e.message : e);
  }

  // last, the sign-in account itself
  await admin.auth().deleteUser(uid);
}
