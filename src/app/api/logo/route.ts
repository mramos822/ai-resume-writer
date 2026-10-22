import { limited } from "@/lib/rateLimit";

// The icon of a company's website, for the logo of a job. The browser asks THIS address instead of Google's icon service directly: when the
// service has no icon for a guessed site it answers 404 and the browser prints a red error in the console for each one. Here the answer is
// always a success: the image when there is one, "no content" (204) when there is not (the page then shows the generated initials). The answer is
// kept by the network for days, so a company is looked up once, and the visitor's address never goes to the icon service.
const DOMAIN = /^[a-z0-9-]{1,63}(\.[a-z0-9-]{1,63}){1,3}$/;
const KEEP = "public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400";

export async function GET(req: Request) {
  if (limited(req, "logo", 600, 60_000)) return new Response(null, { status: 204 });
  const d = (new URL(req.url).searchParams.get("d") ?? "").toLowerCase();
  if (!DOMAIN.test(d)) return new Response(null, { status: 204, headers: { "Cache-Control": KEEP } });
  try {
    const res = await fetch(`https://t0.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=http://${d}&size=128`, { signal: AbortSignal.timeout(4000), cache: "no-store" });
    const type = res.headers.get("content-type") ?? "";
    if (!res.ok || !type.startsWith("image/")) return new Response(null, { status: 204, headers: { "Cache-Control": KEEP } });
    return new Response(await res.arrayBuffer(), { headers: { "Content-Type": type, "Cache-Control": KEEP } });
  } catch {
    return new Response(null, { status: 204, headers: { "Cache-Control": "public, max-age=300" } }); // (a failure is tried again soon)
  }
}
