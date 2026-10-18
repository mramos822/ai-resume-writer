import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireAdmin } from "@/lib/admin";
import { errorResponse, HttpError } from "@/lib/apiAuth";
import { db } from "@/lib/mongodb";

// The contact messages, for the people who run Kaizo (see lib/admin). The Privacy Policy promises an answer within 45 days:
// the list shows how long each one has been waiting.
const STATUSES = ["new", "answered"] as const;

export async function GET(req: Request) {
  try {
    await requireAdmin(req);
    if (new URL(req.url).searchParams.get("check") === "1") return NextResponse.json({ admin: true });
    const rows = await db.collection("contact_messages").find({}).sort({ createdAt: -1 }).limit(300).toArray();
    return NextResponse.json({ messages: rows.map((m) => ({ id: m._id.toString(), name: m.name, email: m.email, topic: m.topic, message: m.message, status: m.status ?? "new", createdAt: m.createdAt })) });
  } catch (err) {
    return errorResponse(err, "We couldn't load the messages.");
  }
}

export async function PATCH(req: Request) {
  try {
    await requireAdmin(req);
    const { id, status } = (await req.json().catch(() => ({}))) as { id?: string; status?: string };
    if (!id || !ObjectId.isValid(id) || !STATUSES.includes(status as (typeof STATUSES)[number])) throw new HttpError(400, "Invalid request.");
    await db.collection("contact_messages").updateOne({ _id: new ObjectId(id) }, { $set: { status, answeredAt: status === "answered" ? new Date() : null } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err, "We couldn't update that message.");
  }
}
