import { NextResponse } from "next/server";
import { authUid, errorResponse } from "@/lib/apiAuth";
import { limited } from "@/lib/rateLimit";
import { suggestPlaces } from "@/lib/jobPlaces";

// The place filter of the job search: cities and regions of a country that match what the person is typing.
export async function GET(req: Request) {
  const tooMany = limited(req, "job-places", 600, 10 * 60 * 1000);
  if (tooMany) return tooMany;
  try {
    await authUid(req);
    const sp = new URL(req.url).searchParams;
    const country = (sp.get("country") ?? "").trim().slice(0, 2);
    const q = (sp.get("q") ?? "").slice(0, 80);
    return NextResponse.json({ places: country && q ? suggestPlaces(country, q) : [] });
  } catch (err) {
    return errorResponse(err, "We couldn't load the places.");
  }
}
