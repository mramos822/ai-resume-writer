import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/mongodb";
import { limited } from "@/lib/rateLimit";

const TOPICS = ["question", "privacy", "appeal", "problem", "feedback", "other"];
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/;

// Public: the contact form. Messages are stored for the team to read; nothing is shown back to anyone.
export async function POST(req: NextRequest) {
  const tooMany = limited(req, "contact", 5, 10 * 60 * 1000);
  if (tooMany) return tooMany;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  // a hidden field that people never fill in: bots do. Pretend it worked.
  if (typeof body.website === "string" && body.website.trim()) return NextResponse.json({ ok: true });

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const topic = typeof body.topic === "string" && TOPICS.includes(body.topic) ? body.topic : "other";
  const message = typeof body.message === "string" ? body.message.trim() : "";

  if (name.length < 1 || name.length > 100) return NextResponse.json({ error: "Please enter your name." }, { status: 400 });
  if (!EMAIL.test(email)) return NextResponse.json({ error: "Please enter a valid email so we can answer you." }, { status: 400 });
  if (message.length < 10 || message.length > 4000) return NextResponse.json({ error: "Your message should be between 10 and 4000 characters." }, { status: 400 });

  try {
    await db.collection("contact_messages").insertOne({ name, email, topic, message, createdAt: new Date(), status: "new" });
  } catch (e) {
    console.error("Could not store a contact message", e);
    return NextResponse.json({ error: "We couldn't send your message. Please try again." }, { status: 500 });
  }
  void notifyTeam(`New Kaizo message (${topic}) from ${name}: ${message.slice(0, 200)}${message.length > 200 ? "…" : ""}`);
  return NextResponse.json({ ok: true });
}

// Optional: CONTACT_WEBHOOK_URL (a Slack, Discord or Teams incoming webhook) gets a short note for every message, so nobody has to
// remember to look. It is never required, and a failure never affects the person who wrote.
async function notifyTeam(text: string) {
  const url = process.env.CONTACT_WEBHOOK_URL;
  if (!url || !/^https:\/\//.test(url)) return;
  try {
    await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, content: text }), signal: AbortSignal.timeout(5000) });
  } catch {
    /* the message is saved anyway */
  }
}
