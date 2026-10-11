import type { MetadataRoute } from "next";

const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Cuswin Arama",
    short_name: "Cuswin",
    description: "Cuswin satış araması ve takip listesi",
    lang: "tr",
    start_url: `${base}/`,
    display: "standalone",
    background_color: "#eef1f3",
    theme_color: "#15202b",
    icons: [{ src: `${base}/icon-512.png`, sizes: "512x512", type: "image/png", purpose: "any" }],
  };
}
