import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Static HTML export so the site can be hosted as files or deployed to Vercel.
  // trailingSlash writes each route as a directory index (out/methodology/index.html).
  output: "export",
  trailingSlash: true,
};

export default nextConfig;
