import type { NextConfig } from "next";

const noStore = [{ key: "Cache-Control", value: "private, no-store, max-age=0" }];
const security = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  serverExternalPackages: ["sharp", "pg"],
  outputFileTracingIncludes: { "/**": ["./db/schema.sql"] },
  async headers() {
    return [
      { source: "/:path*", headers: security },
      { source: "/api/:path*", headers: noStore },
      { source: "/admin/:path*", headers: [...noStore, { key: "X-Robots-Tag", value: "noindex, nofollow" }] },
      { source: "/z/:path*", headers: [...noStore, { key: "X-Robots-Tag", value: "noindex, nofollow" }] },
      { source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache" }, { key: "Service-Worker-Allowed", value: "/" }] },
      { source: "/models/:path*", headers: [{ key: "Cache-Control", value: "public, max-age=604800" }] },
    ];
  },
};
export default config;
