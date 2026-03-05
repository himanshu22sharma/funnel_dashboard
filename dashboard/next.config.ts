import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";
const isPreview = process.env.PREVIEW === "1";
const isVercel = process.env.VERCEL === "1";
// Vercel handles Next.js natively — no static export, no basePath
// Preview = static build with no base path so you can open at http://localhost:3000/
// GitHub Pages prod = static export with /Lending_Dashboard_v1 basePath
const basePath = isVercel ? "" : isPreview ? "" : isProd ? "/Lending_Dashboard_v1" : "";

const nextConfig: NextConfig = {
  ...(isVercel ? {} : (isProd || isPreview) ? { output: "export" as const } : {}),
  basePath,
  images: { unoptimized: true },
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
    NEXT_PUBLIC_BUILD_ID: process.env.BUILD_ID ?? "",
  },
  // Prevent browser from caching in dev so changes show immediately
  ...(process.env.NODE_ENV === "development"
    ? {
        async headers() {
          return [
            {
              source: "/:path*",
              headers: [
                { key: "Cache-Control", value: "no-store, must-revalidate" },
              ],
            },
          ];
        },
      }
    : {}),
};

export default nextConfig;
