"use client";

// Ekranın altından açılan panel. Kayıttan sonraki adımı (teyit at, tanıtımı gönder) burada gösteririz:
// kayıt listeyi tazeleyince kart başka bölüme geçse ya da kaybolsa bile adım ekranda kalır.

import { useEffect, useState, type ReactNode } from "react";

type Sheet = { title: string; body: ReactNode };
type Listener = (s: Sheet | undefined) => void;
const listeners = new Set<Listener>();

export function openSheet(title: string, body: ReactNode) {
  for (const l of listeners) l({ title, body });
}

export function closeSheet() {
  for (const l of listeners) l(undefined);
}

export function SheetHost() {
  const [sheet, setSheet] = useState<Sheet>();
  useEffect(() => {
    listeners.add(setSheet);
    return () => {
      listeners.delete(setSheet);
    };
  }, []);
  useEffect(() => {
    if (!sheet) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setSheet(undefined);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sheet]);
  if (!sheet) return null;
  return (
    <div className="fixed inset-0 z-[2000] flex items-end justify-center">
      <button type="button" aria-label="Kapat" onClick={() => setSheet(undefined)} className="absolute inset-0 bg-ink/40" />
      <section
        role="dialog"
        aria-modal="true"
        aria-label={sheet.title}
        className="relative max-h-[88dvh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-paper px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-3 shadow-2xl"
      >
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-line" aria-hidden />
        <div className="mb-3 flex items-start justify-between gap-3">
          <h2 className="text-[18px] font-semibold leading-snug">{sheet.title}</h2>
          <button type="button" onClick={() => setSheet(undefined)} className="-mr-2 -mt-1 min-h-11 min-w-11 text-2xl leading-none text-muted">
            ×
          </button>
        </div>
        {sheet.body}
      </section>
    </div>
  );
}
