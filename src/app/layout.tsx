import type { Metadata, Viewport } from "next";
import { Onest } from "next/font/google";
import { MainNav } from "@/components/main-nav";
import { getRepository } from "@/lib/data";
import "./globals.css";

const onest = Onest({ variable: "--font-onest", subsets: ["latin", "latin-ext"] });

export const metadata: Metadata = {
  title: "Cuswin Arama",
  description: "Cuswin satış araması ve takip listesi",
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, title: "Cuswin", statusBarStyle: "default" },
};

export const viewport: Viewport = { themeColor: "#15202b" };

// Tüm ekranlar canlı CRM verisi gösterir; derleme sırasında önceden üretilmez.
export const dynamic = "force-dynamic";

export default function RootLayout({ children }: LayoutProps<"/">) {
  const mode = getRepository().mode;
  return (
    <html lang="tr" className={`${onest.variable} antialiased`}>
      <body className="min-h-dvh font-sans">
        {mode === "demo" ? (
          <div className="border-b border-late/30 bg-late-soft px-4 py-1.5 text-center text-sm text-late">
            Demo verisi gösteriliyor. Kayıtlar uydurmadır ve sunucu yeniden başlayınca sıfırlanır.
          </div>
        ) : (
          <div className="border-b border-meet/20 bg-meet-soft px-4 py-1.5 text-center text-sm text-meet">
            Yerel test: gerçek taranan kayıtlar bu bilgisayarda tutulur. Giriş koruması henüz yok.
          </div>
        )}
        <MainNav />
        <main className="mx-auto w-full max-w-6xl px-4 pb-28 pt-5 md:pb-12">{children}</main>
      </body>
    </html>
  );
}
