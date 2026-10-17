import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

// Search engines may read the public pages; the app, the sign-in flow and the API are not for them.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/home", "/build", "/start", "/api/", "/login"] }],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
