"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Bugün" },
  { href: "/kayitlar", label: "Kayıtlar" },
  { href: "/randevular", label: "Randevular" },
  { href: "/ayarlar", label: "Ayarlar" },
] as const;

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname.startsWith(href) || (href === "/kayitlar" && pathname.startsWith("/isletme"));
}

export function MainNav() {
  const pathname = usePathname();
  return (
    <>
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <Link href="/" className="text-[17px] font-semibold tracking-tight">
            Cuswin <span className="font-normal text-muted">Arama</span>
          </Link>
          <nav className="hidden gap-1 md:flex" aria-label="Ana menü">
            {LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                aria-current={isActive(pathname, l.href) ? "page" : undefined}
                className="rounded-md px-3 py-1.5 text-[15px] text-muted hover:text-ink aria-[current=page]:bg-paper aria-[current=page]:font-medium aria-[current=page]:text-ink"
              >
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <nav
        aria-label="Ana menü"
        className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-4 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        {LINKS.map((l) => (
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
