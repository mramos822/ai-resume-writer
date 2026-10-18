// next.config.ts
import withPWA from "next-pwa";
import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false, // nobody needs to be told which framework this is
  // a check of the production build can go to its own folder while the dev server keeps running (NEXT_DIST_DIR=.next-check npm run build)
  distDir: process.env.NEXT_DIST_DIR || ".next",
  turbopack: { root: path.resolve(__dirname) },
  // pdfkit loads its font metrics from disk, so it must not be bundled
  serverExternalPackages: ["pdfkit", "pdfjs-dist", "@napi-rs/canvas"],
  // the PDF routes read the Carlito fonts from disk, so they travel with the serverless functions. pdfkit also loads the metrics of its standard fonts
  // (Helvetica...) with a dynamic require through its own "#standard-fonts/..." map, which the file tracer cannot see: without these lines the host
  // answers 'Cannot find module .../pdfkit/js/standard-fonts/Helvetica.cjs' and no PDF (nor the page-fit measure of the review) works there
  outputFileTracingIncludes: { "/api/**": ["./public/fonts/**", "./node_modules/pdfkit/package.json", "./node_modules/pdfkit/js/standard-fonts/**", "./node_modules/pdfkit/js/data/**"] },
  // the landing page is the root of the site; the old address keeps working
  // browser-side protections for every page and API response
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
          // no page of Kaizo may be put inside another site, post a form elsewhere, change its own base address or load a plugin
          { key: "Content-Security-Policy", value: "frame-ancestors 'self'; base-uri 'self'; form-action 'self'; object-src 'none'" },
        ],
      },
      // the app, the sign-in flow and the API are not for search engines
      ...["/home/:path*", "/build/:path*", "/start", "/login", "/api/:path*"].map((source) => ({ source, headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] })),
    ];
  },
  async redirects() {
    return [{ source: "/homepage", destination: "/", permanent: true }];
  },
  eslint: {
    ignoreDuringBuilds: false,
  },
};

// next-pwa injects a webpack config, which clashes with Turbopack in dev (and is disabled there anyway),
// so only wrap the config for production builds.
export default process.env.NODE_ENV === "development"
  ? nextConfig
  : withPWA({
      dest: "public",
      register: true,
      skipWaiting: true,
    })(nextConfig);
