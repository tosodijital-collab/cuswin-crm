import type { NextConfig } from "next";

// GitHub Pages'te statik yayın. Özel alan adı (doktor.toso.tr) bağlanana kadar site /<depo-adı> altında
// yayınlanır; o durumda NEXT_PUBLIC_BASE_PATH="/cuswin-crm" verilir.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || undefined;

// Her yayının kimliği: sayfaya gömülür ve /version.json'a yazılır. Ana ekrandaki uygulama eski sayfayı
// önbellekte tutarsa ikisi farklı çıkar ve uygulama kendini yeniler.
const buildId = process.env.GITHUB_SHA?.slice(0, 12) || `yerel-${Date.now().toString(36)}`;

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  basePath,
  images: { unoptimized: true },
  env: { NEXT_PUBLIC_BUILD_ID: buildId },
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
