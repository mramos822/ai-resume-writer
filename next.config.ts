// next.config.ts
import withPWA from "next-pwa";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdfkit loads its font metrics from disk, so it must not be bundled
  serverExternalPackages: ["pdfkit"],
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
