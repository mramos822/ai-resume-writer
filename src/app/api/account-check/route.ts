import { NextResponse } from "next/server";
import admin from "@/lib/firebase-admin";
import { authUid, errorResponse, HttpError } from "@/lib/apiAuth";

// Tells a person building a resume as a guest whether the email they typed already has an account, so they can log in
// instead of ending up with several accounts. Only a yes/no is returned, only to signed-in callers (guests included),
// and each caller can only ask a limited number of times.
const hits = new Map<string, { count: number; since: number }>();
const WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_WINDOW = 30;

export async function POST(req: Request) {
  try {
    const uid = await authUid(req);
    const now = Date.now();
    const h = hits.get(uid);
    if (!h || now - h.since > WINDOW_MS) hits.set(uid, { count: 1, since: now });
    else if (++h.count > MAX_PER_WINDOW) throw new HttpError(429, "Too many checks. Please try again later.");

    const { email } = (await req.json().catch(() => ({}))) as { email?: string };
    const mail = String(email ?? "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(mail)) return NextResponse.json({ exists: false });
    try {
      await admin.auth().getUserByEmail(mail);
      return NextResponse.json({ exists: true });
    } catch (err) {
      if ((err as { code?: string }).code === "auth/user-not-found") return NextResponse.json({ exists: false });
      throw err;
    }
  } catch (err) {
    return errorResponse(err, "We couldn't check that email.");
  }
}
