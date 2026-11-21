import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Logo and shop photo uploads go through server actions (max 4 MB file + form overhead).
    serverActions: { bodySizeLimit: "5mb" },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
