import { NextResponse } from "next/server";
import { db } from "@/lib/mongodb";
import { ensureIndexes } from "@/lib/dbIndexes";

// Health check for uptime monitors and the host: answers 200 only if the database answers too. It reveals nothing else.
export async function GET() {
  try {
    await db.command({ ping: 1 });
    void ensureIndexes();
    return NextResponse.json({ status: "ok" }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ status: "unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
