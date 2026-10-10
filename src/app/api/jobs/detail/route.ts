import { NextResponse } from "next/server";
import { authUid, errorResponse, HttpError } from "@/lib/apiAuth";
import { fetchJobAdText } from "@/lib/jobAdText";
import { isSafePublicUrl } from "@/lib/safeUrl";
import { limited } from "@/lib/rateLimit";

// The full text of a job posting. Some sources (Adzuna) only share the first lines, so when the person opens a job we read the
// posting itself. `start` is the beginning of the text we already have: the page is cut from there, so menus and footers are dropped.
export async function GET(req: Request) {
  const tooMany = limited(req, "job-detail", 60, 10 * 60 * 1000);
  if (tooMany) return tooMany;
  try {
    await authUid(req);
    const params = new URL(req.url).searchParams;
    const url = params.get("url") || "";
    const start = (params.get("start") || "").replace(/(\.\.\.|…)\s*$/, "").trim().slice(0, 60);
    if (!url || !isSafePublicUrl(url)) throw new HttpError(400, "That link can't be opened.");
    if (start.length < 25) return NextResponse.json({ text: null });

    const page = await fetchJobAdText(url);
    if (!page) return NextResponse.json({ text: null });
    const at = page.toLowerCase().indexOf(start.toLowerCase());
    if (at < 0) return NextResponse.json({ text: null }); // not the same text: better to show nothing than a page full of menus
    return NextResponse.json({ text: page.slice(at, at + 12000) });
  } catch (err) {
    return errorResponse(err, "We couldn't load the full posting.");
  }
}
