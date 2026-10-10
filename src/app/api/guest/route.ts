import { limited } from "@/lib/rateLimit";
import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import admin from "@/lib/firebase-admin";

// Temporary guest start: hands out a sign-in token for a brand-new guest id, so "Create my resume" works with no
// sign-up (and without having to enable any provider in the Firebase console).
// Rate-limited per client so it cannot be used to mass-create users.
// TODO(accounts): remove this once real sign-up happens after the resume is built.
export async function POST(req: Request) {
  const tooMany = limited(req, "guest", 15, 60 * 60 * 1000);
  if (tooMany) return tooMany;
  try {
    const uid = `guest-${randomUUID()}`;
    const token = await admin.auth().createCustomToken(uid, { guest: true });
    return NextResponse.json({ token });
  } catch (err) {
    console.error("Guest token failed", err);
    return NextResponse.json({ error: "Could not start a guest session." }, { status: 500 });
  }
}
