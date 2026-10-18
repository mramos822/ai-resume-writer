// The public address of the site, for the sitemap, robots.txt and the links search engines and social networks read.
// Set NEXT_PUBLIC_SITE_URL in the host (for example https://kaizo.app). Without it the local address is used, which is only right in development.
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/+$/, "");

/** The pages anyone may find: the app itself (/home, /build) and the API are private. */
export const PUBLIC_PAGES = ["/", "/terms", "/privacy", "/cookies", "/accessibility", "/contact", "/es", "/es/terms", "/es/privacy", "/es/cookies", "/es/accessibility", "/es/contact"];
