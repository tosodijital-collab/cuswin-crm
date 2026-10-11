import type { NextConfig } from "next";

// GitHub Pages'te statik yayın. Özel alan adı (doktor.toso.tr) bağlanana kadar site /<depo-adı> altında
// yayınlanır; o durumda NEXT_PUBLIC_BASE_PATH="/cuswin-crm" verilir.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || undefined;

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  basePath,
  images: { unoptimized: true },
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
