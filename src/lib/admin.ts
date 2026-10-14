import type { auth } from "firebase-admin";
import { verifyAuthToken } from "@/lib/firebase-admin";
import { HttpError } from "@/lib/apiAuth";
import { isAdmin } from "@/lib/adminRules";

export { adminEmails, isAdmin } from "@/lib/adminRules";

/** The signed-in admin, or a 401/403. */
export async function requireAdmin(req: Request) {
  let user: auth.DecodedIdToken;
  try {
    user = await verifyAuthToken(req.headers.get("Authorization"));
  } catch {
    throw new HttpError(401, "Please sign in again to continue.");
  }
  if (!isAdmin(user)) throw new HttpError(403, "Not allowed.");
  return user;
}
