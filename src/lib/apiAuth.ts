// src/lib/apiAuth.ts
// Server-side helpers so API routes only touch data that belongs to the signed-in user.
import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { verifyAuthToken } from "@/lib/firebase-admin";
import { db } from "@/lib/mongodb";

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** Returns the Firebase uid from the `Authorization: Bearer <idToken>` header, or throws a 401. */
export async function authUid(req: Request): Promise<string> {
  try {
    const decoded = await verifyAuthToken(req.headers.get("Authorization"));
    return decoded.uid;
  } catch {
    throw new HttpError(401, "Please sign in again to continue.");
  }
}

function toObjectId(id: string, what: string): ObjectId {
  if (!ObjectId.isValid(id)) throw new HttpError(400, `Invalid ${what}.`);
  return new ObjectId(id);
}

/** Loads a profile only if it belongs to `uid`; otherwise throws 404 (no hint that it exists). */
export async function ownedProfile(uid: string, profileId: string) {
  const profile = await db.collection("profiles").findOne({ _id: toObjectId(profileId, "profile id"), userId: uid });
  if (!profile) throw new HttpError(404, "Profile not found.");
  return profile;
}

/** Loads a job ad only if it belongs to `uid`. */
export async function ownedJobAd(uid: string, jobAdId: string) {
  const ad = await db.collection("jobAds").findOne({ _id: toObjectId(jobAdId, "job ad id"), userId: uid });
  if (!ad) throw new HttpError(404, "Job ad not found.");
  return ad;
}

/** A generated resume file is owned by whoever owns the profile it was generated from. */
export async function assertResumeOwner(uid: string, fileId: string) {
  const file = await db.collection("uploads.files").findOne({ _id: toObjectId(fileId, "file id") });
  const profileId = file?.metadata?.profileId as string | undefined;
  if (!file || !profileId) throw new HttpError(404, "File not found.");
  await ownedProfile(uid, profileId);
  return file;
}

/** Turns a thrown HttpError into a JSON response (unknown errors become a 500). */
export function errorResponse(err: unknown, fallback = "Something went wrong.") {
  if (err instanceof HttpError) return NextResponse.json({ error: err.message }, { status: err.status });
  console.error(fallback, err);
  return NextResponse.json({ error: fallback }, { status: 500 });
}
