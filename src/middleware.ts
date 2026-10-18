import { NextResponse, type NextRequest } from "next/server";
import { LANG_COOKIE, localeOfPath, stripLocale } from "@/i18n/config";

// 1) Gives every API request an id. It travels with the request (so the logs can print it) and comes back in `x-request-id`.
// 2) Language: English is the default and lives at the plain address; Spanish lives under /es. The page is rewritten to the
//    same page without /es and told which language to use (`x-locale`). Nothing is guessed from the browser: a first visit is
//    always English, and Spanish is used only when the person chose it (the address has /es, or they chose it before).
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith("/api/")) {
    const id = req.headers.get("x-request-id") || crypto.randomUUID();
    const headers = new Headers(req.headers);
    headers.set("x-request-id", id);
    const res = NextResponse.next({ request: { headers } });
    res.headers.set("x-request-id", id);
    return res;
  }

  const locale = localeOfPath(pathname);
  const isDocument = req.method === "GET" && !req.headers.get("rsc") && !req.headers.get("next-router-prefetch") && (req.headers.get("accept") || "").includes("text/html");

  // someone who chose Spanish before and opens a plain address (a bookmark, a typed link) goes to the Spanish one
  if (locale === "en" && isDocument && req.cookies.get(LANG_COOKIE)?.value === "es") {
    const url = req.nextUrl.clone();
    url.pathname = pathname === "/" ? "/es" : `/es${pathname}`;
    return NextResponse.redirect(url);
  }

  const headers = new Headers(req.headers);
  headers.set("x-locale", locale);
  if (locale === "es") {
    const url = req.nextUrl.clone();
    url.pathname = stripLocale(pathname);
    return NextResponse.rewrite(url, { request: { headers } });
  }
  return NextResponse.next({ request: { headers } });
}

// every page, but not the framework's files, images and other static files
export const config = { matcher: ["/((?!_next/|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|mjs|js|css|json|txt|woff2?|pdf)$).*)"] };
