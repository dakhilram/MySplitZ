import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Client-side Firestore keeps this app compatible with GitHub Pages.
  output: "export",
  basePath: process.env.GITHUB_ACTIONS
    ? `/${process.env.GITHUB_REPOSITORY?.split("/")[1] ?? "dads-trip-book"}`
    : "",
};

export default nextConfig;
