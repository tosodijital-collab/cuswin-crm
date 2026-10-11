import type { Metadata, Viewport } from "next";
import { Onest } from "next/font/google";
import { AppShell } from "@/components/app-shell";
import "./globals.css";

const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const onest = Onest({ variable: "--font-onest", subsets: ["latin", "latin-ext"] });

export const metadata: Metadata = {
  title: "Cuswin Arama",
  description: "Cuswin satış araması ve takip listesi",
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, title: "Cuswin", statusBarStyle: "default" },
  // GitHub Pages dosya türünü uzantıdan belirlediği için simgeler public/ altında .png olarak durur.
  icons: { icon: `${base}/icon-512.png`, apple: `${base}/apple-touch-icon.png` },
  manifest: `${base}/manifest.webmanifest`,
};

export const viewport: Viewport = { themeColor: "#15202b" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="tr" className={`${onest.variable} antialiased`}>
      <body className="min-h-dvh font-sans">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
