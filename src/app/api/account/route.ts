import { NextResponse } from "next/server";
import { verifyAuthToken } from "@/lib/firebase-admin";
import { deleteAccount, exportAccount } from "@/lib/accountData";
import { errorResponse, HttpError } from "@/lib/apiAuth";
import { limitedShared } from "@/lib/rateLimit";

const RECENT_LOGIN_SECONDS = 15 * 60;

async function who(req: Request) {
  try {
    return await verifyAuthToken(req.headers.get("Authorization"));
  } catch {
    throw new HttpError(401, "Please sign in again to continue.");
  }
}

// GET: a copy of everything Kaizo keeps about you (your right to access your data), as a JSON download.
export async function GET(req: Request) {
  const tooMany = await limitedShared(req, "account-export", 5, 60 * 60 * 1000);
  if (tooMany) return tooMany;
  try {
    const user = await who(req);
    const data = await exportAccount(user.uid, user.email);
    return new NextResponse(JSON.stringify(data, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": 'attachment; filename="kaizo-my-data.json"',
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return errorResponse(err, "We couldn't prepare your data.");
  }
}

// DELETE: removes the account and everything in it, for good. Needs a recent sign-in and the word DELETE as confirmation.
export async function DELETE(req: Request) {
  const tooMany = await limitedShared(req, "account-delete", 20, 60 * 60 * 1000);
  if (tooMany) return tooMany;
  try {
    const user = await who(req);
    const { confirm } = (await req.json().catch(() => ({}))) as { confirm?: string };
    if (confirm !== "DELETE") throw new HttpError(400, "Type DELETE to confirm.");
    const isGuest = user.uid.startsWith("guest-"); // no password to protect: a guest can always clear their own data
    if (!isGuest && (!user.auth_time || Date.now() / 1000 - user.auth_time > RECENT_LOGIN_SECONDS)) {
      return NextResponse.json({ error: "For your security, log in again and then delete your account.", code: "reauth" }, { status: 401 });
    }
    await deleteAccount(user.uid, user.email);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err, "We couldn't delete your account. Please try again or contact us.");
  }
}
