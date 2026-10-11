import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Kişisel, canlı CRM verisi: önbellek bileşenleri gereksiz. Docker için bağımsız çıktı.
  output: process.env.BUILD_STANDALONE === "1" ? "standalone" : undefined,
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
