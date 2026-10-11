import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Cuswin Arama",
    short_name: "Cuswin",
    description: "Cuswin satış araması ve takip listesi",
    lang: "tr",
    start_url: "/",
    display: "standalone",
    background_color: "#eef1f3",
    theme_color: "#15202b",
    icons: [{ src: "/icon", sizes: "512x512", type: "image/png", purpose: "any" }],
  };
}
