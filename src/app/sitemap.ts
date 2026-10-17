import type { MetadataRoute } from "next";
import { PUBLIC_PAGES, SITE_URL } from "@/lib/site";
import { LEGAL_UPDATED } from "@/lib/legal";

export default function sitemap(): MetadataRoute.Sitemap {
  const legalDate = new Date(LEGAL_UPDATED);
  return PUBLIC_PAGES.map((path) => ({
    url: `${SITE_URL}${path === "/" ? "" : path}`,
    lastModified: ["/terms", "/privacy", "/cookies"].some((p) => path.endsWith(p)) && !Number.isNaN(+legalDate) ? legalDate : undefined,
    changeFrequency: path === "/" || path === "/es" ? "weekly" : "yearly",
    priority: path === "/" || path === "/es" ? 1 : 0.5,
  }));
}
