import type { NextConfig } from "next";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

/** This app (`dashboard/`). */
const dashboardRoot = path.dirname(fileURLToPath(import.meta.url));
/** Repo root (`Lending_Dashboard_v1/`) — workspace installs hoist `next` here. */
const monorepoRoot = path.join(dashboardRoot, "..");

function turbopackRoot(): string {
  if (fs.existsSync(path.join(monorepoRoot, "node_modules", "next"))) {
    return monorepoRoot;
  }
  return dashboardRoot;
}

const isProd = process.env.NODE_ENV === "production";
const isPreview = process.env.PREVIEW === "1";
const isVercel = process.env.VERCEL === "1";
/** Static hosting (e.g. GitHub Pages) — no dev server rewrites; browser must call Lending CC directly (CORS). */
const useStaticExport = !isVercel && (isProd || isPreview);
// Vercel handles Next.js natively — no static export, no basePath
// Preview = static build with no base path so you can open at http://localhost:3000/
// GitHub Pages prod = static export with /Lending_Dashboard_v1 basePath
const basePath = isVercel ? "" : isPreview ? "" : isProd ? "/Lending_Dashboard_v1" : "";

const lendingCcDestBase = (
  process.env.LENDING_CC_API_BASE_URL ||
  process.env.NEXT_PUBLIC_LENDING_CC_API_BASE_URL ||
  ""
)
  .trim()
  .replace(/\/$/, "");

const nextConfig: NextConfig = {
  /** Workspaces: deps at repo root. Dashboard-only CI: deps stay under `dashboard/`. */
  turbopack: { root: turbopackRoot() },
  ...(isVercel ? {} : (isProd || isPreview) ? { output: "export" as const } : {}),
  basePath,
  images: { unoptimized: true },
  ...(!useStaticExport && lendingCcDestBase
    ? {
        async rewrites() {
          return [
            {
              source: "/lending-cc/api/query",
              destination: `${lendingCcDestBase}/api/query`,
            },
          ];
        },
      }
    : {}),
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
    NEXT_PUBLIC_BUILD_ID: process.env.BUILD_ID ?? "",
    // Funnel-summary calls Lending CC from the browser; NEXT_PUBLIC_* must be in the bundle.
    // Mirror LENDING_CC_* so one .env.local pair works for both `npm run sync:lending-cc` and the page.
    NEXT_PUBLIC_LENDING_CC_API_BASE_URL:
      process.env.NEXT_PUBLIC_LENDING_CC_API_BASE_URL ?? process.env.LENDING_CC_API_BASE_URL ?? "",
    NEXT_PUBLIC_LENDING_CC_API_TOKEN:
      process.env.NEXT_PUBLIC_LENDING_CC_API_TOKEN ?? process.env.LENDING_CC_API_TOKEN ?? "",
    // "1" when next dev / Vercel will proxy /lending-cc/api/query → Lending CC (avoids browser CORS).
    NEXT_PUBLIC_LENDING_CC_REWRITE: !useStaticExport && lendingCcDestBase ? "1" : "",
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
