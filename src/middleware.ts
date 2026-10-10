import { NextResponse, type NextRequest } from "next/server";

// Gives every API request an id. It travels with the request (so the logs can print it) and comes back in the `x-request-id` header.
export function middleware(req: NextRequest) {
  const id = req.headers.get("x-request-id") || crypto.randomUUID();
  const headers = new Headers(req.headers);
  headers.set("x-request-id", id);
  const res = NextResponse.next({ request: { headers } });
  res.headers.set("x-request-id", id);
  return res;
}

export const config = { matcher: "/api/:path*" };
