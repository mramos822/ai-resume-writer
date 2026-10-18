// src/app/api/job-ads/fetch/route.ts
import { NextResponse } from "next/server";
import { authUid, errorResponse } from "@/lib/apiAuth";
import { isSafePublicUrl } from "@/lib/safeUrl";

export async function GET(request: Request) {
  try {
    await authUid(request);
  } catch (err) {
    return errorResponse(err);
  }
  const { searchParams } = new URL(request.url);
  const targetUrl = searchParams.get("url");
  if (!targetUrl) {
    return NextResponse.json({ error: "Missing url parameter" }, { status: 400 });
  }
  if (!isSafePublicUrl(targetUrl)) {
    return NextResponse.json({ error: "That link can't be opened." }, { status: 400 });
  }

  try {
    // follow redirects by hand (at most 3), checking every hop: a public page must not be able to bounce us to an internal address
    let url = targetUrl;
    let res = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(10_000) });
    for (let hop = 0; hop < 3 && res.status >= 300 && res.status < 400; hop++) {
      const next = res.headers.get("location");
      if (!next) break;
      url = new URL(next, url).toString();
      if (!isSafePublicUrl(url)) return NextResponse.json({ error: "That link can't be opened." }, { status: 400 });
      res = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(10_000) });
    }
    if (!res.ok) {
      return NextResponse.json(
        { error: `Failed to fetch (${res.status})` },
        { status: res.status }
      );
    }
    const html = (await res.text()).slice(0, 2_000_000);
    return new NextResponse(html, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  } catch (error) {
    console.error("Job link fetch failed", (error as Error).name);
    return NextResponse.json({ error: "We couldn't open that link. Paste the job text instead." }, { status: 502 });
  }
}
