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
};

export default nextConfig;
