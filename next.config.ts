// next.config.ts
import withPWA from "next-pwa";
import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: { root: path.resolve(__dirname) },
  // pdfkit loads its font metrics from disk, so it must not be bundled
  serverExternalPackages: ["pdfkit", "pdfjs-dist", "@napi-rs/canvas"],
  // the PDF routes read the Carlito fonts from disk, so they travel with the serverless functions
  outputFileTracingIncludes: { "/api/**": ["./public/fonts/**"] },
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
        ],
      },
    ];
  },
  async redirects() {
    return [{ source: "/homepage", destination: "/", permanent: true }];
  },
  eslint: {
    ignoreDuringBuilds: true,
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
