import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { sweepInactiveGuests, sweepOldMessages } from "@/lib/retention";

// For a scheduler (a daily cron on the host): runs the retention cleanup now. It needs `Authorization: Bearer <CRON_SECRET>`.
// The cleanup also runs by itself, at most once an hour, whenever someone starts a guest session.
export const maxDuration = 60;

export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET || "";
  const given = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  const ok = secret.length >= 16 && given.length === secret.length && timingSafeEqual(Buffer.from(given), Buffer.from(secret));
  if (!ok) return NextResponse.json({ error: "Not allowed." }, { status: 401 });
  try {
    const guests = await sweepInactiveGuests(200);
    const messages = await sweepOldMessages();
    return NextResponse.json({ guestsRemoved: guests, messagesRemoved: messages });
  } catch (e) {
    console.error("Cleanup failed", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Cleanup failed." }, { status: 500 });
  }
}
