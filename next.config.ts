import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Client-side Firestore keeps this app compatible with GitHub Pages.
  output: "export",
};

export default nextConfig;
