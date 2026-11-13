"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { getBrowserSupabase } from "@/lib/supabase/client";

/** Telefonda alttaki dört ana iş: bugün ne yapacağım, sahada nereye, ne diyeceğim, kayıtlar. */
const PRIMARY = [
  {
    href: "/",
    label: "Bugün",
    icon: "M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z",
  },
  {
    href: "/saha",
    label: "Saha",
    icon: "M12 22s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12zM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z",
  },
  {
    href: "/rehber",
    label: "Rehber",
    icon: "M21 12a8 8 0 0 1-11.8 7L3 21l2-6.2A8 8 0 1 1 21 12zM8.5 10.5h7M8.5 14h4.5",
  },
  {
    href: "/kayitlar",
    label: "Kayıtlar",
    icon: "M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01",
  },
] as const;

/** Daha az kullanılanlar: telefonda üstteki "Menü"de. */
const SECONDARY = [
  { href: "/rapor", label: "Rapor" },
  { href: "/randevular", label: "Randevular" },
  { href: "/ayarlar", label: "Ayarlar" },
] as const;

function isActive(pathname: string, href: string) {
  const p = pathname.replace(/\/$/, "") || "/";
  if (href === "/") return p === "/";
  if (href === "/rehber") return p.startsWith("/rehber") || p.startsWith("/dosyalar");
  if (href === "/saha") return p.startsWith("/saha") || p.startsWith("/harita");
  return p.startsWith(href) || (href === "/kayitlar" && p.startsWith("/isletme"));
}

export function MainNav({ showSignOut }: { showSignOut?: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  // Menü, açıldığı sayfadan başka bir sayfaya geçilince kendiliğinden kapanır.
  const [menuFor, setMenuFor] = useState<string>();
  const menu = menuFor === pathname;
  const signOut = async () => {
    await getBrowserSupabase().auth.signOut();
    router.replace("/giris");
  };
  const link =
    "rounded-md px-3 py-1.5 text-[15px] text-muted hover:text-ink aria-[current=page]:bg-paper aria-[current=page]:font-medium aria-[current=page]:text-ink";

  return (
    <>
      <header className="relative border-b border-line bg-surface">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-4">
          <Link href="/" className="text-[17px] font-semibold tracking-tight">
            Cuswin <span className="font-normal text-muted">Arama</span>
          </Link>
          <nav className="ml-auto hidden gap-1 md:flex" aria-label="Ana menü">
            {[...PRIMARY, ...SECONDARY].map((l) => (
              <Link key={l.href} href={l.href} aria-current={isActive(pathname, l.href) ? "page" : undefined} className={link}>
                {l.label}
              </Link>
            ))}
          </nav>
          {showSignOut && (
            <button type="button" onClick={signOut} className="hidden text-[15px] text-muted hover:text-ink md:ml-2 md:block">
              Çıkış
            </button>
          )}
          <button
            type="button"
            onClick={() => setMenuFor(menu ? undefined : pathname)}
            aria-expanded={menu}
            aria-controls="mobil-menu"
            className="ml-auto min-h-11 rounded-md border border-line px-4 text-[15px] font-medium text-ink aria-expanded:bg-paper md:hidden"
          >
            Menü
          </button>
        </div>
        {menu && (
          <nav
            id="mobil-menu"
            aria-label="Diğer"
            className="absolute inset-x-0 top-14 z-30 border-b border-line bg-surface shadow-md md:hidden"
          >
            {SECONDARY.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                aria-current={isActive(pathname, l.href) ? "page" : undefined}
                className="block border-t border-line px-4 py-3.5 text-[16px] aria-[current=page]:font-semibold"
              >
                {l.label}
              </Link>
            ))}
            {showSignOut && (
              <button
                type="button"
                onClick={signOut}
                className="block w-full border-t border-line px-4 py-3.5 text-left text-[16px] text-muted"
              >
                Çıkış
              </button>
            )}
          </nav>
        )}
      </header>
      <nav
        aria-label="Ana menü"
        className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-4 gap-1 border-t border-line bg-surface px-1.5 pb-[max(env(safe-area-inset-bottom),0.375rem)] pt-1.5 shadow-[0_-2px_10px_rgba(21,32,43,0.06)] md:hidden"
      >
        {PRIMARY.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            aria-current={isActive(pathname, l.href) ? "page" : undefined}
            className="group flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl text-[13px] font-medium leading-tight text-muted active:bg-paper aria-[current=page]:bg-ink aria-[current=page]:font-semibold aria-[current=page]:text-white"
          >
            <svg
              aria-hidden
              width="26"
              height="26"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d={l.icon} />
            </svg>
            {l.label}
          </Link>
        ))}
      </nav>
    </>
  );
}
