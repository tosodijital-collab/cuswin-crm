"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { getBrowserSupabase } from "@/lib/supabase/client";

/** Telefonda alttaki dört ana iş: bugün ne yapacağım, sahada nereye, ne diyeceğim, kayıtlar. */
const PRIMARY = [
  { href: "/", label: "Bugün" },
  { href: "/saha", label: "Saha" },
  { href: "/rehber", label: "Rehber" },
  { href: "/kayitlar", label: "Kayıtlar" },
] as const;

/** Daha az kullanılanlar: telefonda üstteki "Menü"de. */
const SECONDARY = [
  { href: "/rapor", label: "Gün sonu" },
  { href: "/randevular", label: "Randevular" },
  { href: "/ayarlar", label: "Ayarlar" },
] as const;

function isActive(pathname: string, href: string) {
  const p = pathname.replace(/\/$/, "") || "/";
  if (href === "/") return p === "/";
  if (href === "/rehber") return p.startsWith("/rehber") || p.startsWith("/dosyalar");
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
            className="ml-auto min-h-11 rounded-md px-3 text-[15px] font-medium text-ink aria-expanded:bg-paper md:hidden"
          >
            Menü
          </button>
        </div>
        {menu && (
          <nav id="mobil-menu" aria-label="Diğer" className="absolute inset-x-0 top-14 z-30 border-b border-line bg-surface shadow-md md:hidden">
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
              <button type="button" onClick={signOut} className="block w-full border-t border-line px-4 py-3.5 text-left text-[16px] text-muted">
                Çıkış
              </button>
            )}
          </nav>
        )}
      </header>
      <nav
        aria-label="Ana menü"
        className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-4 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        {PRIMARY.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            aria-current={isActive(pathname, l.href) ? "page" : undefined}
            className="py-3.5 text-center text-[15px] text-muted aria-[current=page]:font-semibold aria-[current=page]:text-ink"
          >
            {l.label}
          </Link>
        ))}
      </nav>
    </>
  );
}
