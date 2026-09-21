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
    const res = await fetch(targetUrl, { redirect: "follow" });
    if (!res.ok) {
      return NextResponse.json(
        { error: `Failed to fetch (${res.status})` },
        { status: res.status }
      );
    }
    const html = await res.text();
    return new NextResponse(html, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 502 }
    );
  }
}
