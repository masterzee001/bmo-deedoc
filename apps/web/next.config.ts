import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Emits a self-contained server bundle with only the traced dependencies, so
  // the production image does not need the monorepo's node_modules.
  output: "standalone",
  // The traced root must be the workspace root, otherwise Next only traces
  // apps/web and omits the linked @pics-nigeria packages.
  outputFileTracingRoot: new URL("../../", import.meta.url).pathname,
  poweredByHeader: false,
  images: {
    // The app serves no images through next/image: evidence is private and
    // reached by short-lived signed URLs, never optimized by the web tier.
    // Disabling the optimizer means Next never invokes its bundled sharp, which
    // carries libvips advisories that upstream only fixes in a major release.
    // The worker does process images, and uses its own patched sharp.
    unoptimized: true,
  },
};

export default nextConfig;
