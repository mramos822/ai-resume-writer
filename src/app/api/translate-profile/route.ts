import { NextResponse } from "next/server";
import { authUid, errorResponse } from "@/lib/apiAuth";
import { limitedShared } from "@/lib/rateLimit";
import { translateTexts } from "@/lib/translateTexts";

const MAX_TEXTS = 400;
const MAX_CHARS = 60000;

/** Translates the texts of a resume (a list of strings) into English or neutral Latin American Spanish, same order and length. */
export async function POST(req: Request) {
  const tooMany = await limitedShared(req, "ai", 60, 10 * 60 * 1000);
  if (tooMany) return tooMany;
  try {
    await authUid(req);
    const body = (await req.json()) as { texts?: unknown; target?: unknown };
    const target = body.target === "es" ? "es" : body.target === "en" ? "en" : null;
    const texts = Array.isArray(body.texts) ? body.texts.map((t) => (typeof t === "string" ? t : "")) : null;
    if (!target || !texts || texts.length > MAX_TEXTS || texts.join("").length > MAX_CHARS) {
      return NextResponse.json({ error: "Nothing to translate." }, { status: 400 });
    }
    return NextResponse.json({ texts: await translateTexts(texts, target) });
  } catch (err) {
    return errorResponse(err, "We couldn't translate your resume right now.");
  }
}
