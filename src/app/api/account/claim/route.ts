import { NextResponse } from "next/server";
import { verifyAuthToken } from "@/lib/firebase-admin";
import { claimGuest } from "@/lib/claimGuest";
import { errorResponse, HttpError } from "@/lib/apiAuth";
import { limited } from "@/lib/rateLimit";

// POST: a guest just made an account (or logged in): their resume moves to it. Authorization is the NEW account's token and the
// body carries the guest's token.
export async function POST(req: Request) {
  const tooMany = limited(req, "claim", 20, 60 * 60 * 1000);
  if (tooMany) return tooMany;
  try {
    let user;
    try {
      user = await verifyAuthToken(req.headers.get("Authorization"));
    } catch {
      throw new HttpError(401, "Please sign in again to continue.");
    }
    const { guestToken } = (await req.json().catch(() => ({}))) as { guestToken?: string };
    if (!guestToken || typeof guestToken !== "string") throw new HttpError(400, "Missing guest session.");
    return NextResponse.json(await claimGuest(user.uid, guestToken));
  } catch (err) {
    return errorResponse(err, "We couldn't move your resume to your account.");
  }
}
