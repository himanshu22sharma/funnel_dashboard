import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";
const isPreview = process.env.PREVIEW === "1";
// Preview = static build with no base path so you can open at http://localhost:3000/
const basePath = isPreview ? "" : isProd ? "/Lending_Dashboard_v1" : "";

const nextConfig: NextConfig = {
  // Static export for production or preview
  ...(isProd || isPreview ? { output: "export" as const } : {}),
  basePath,
  images: { unoptimized: true },
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
};

export default nextConfig;
