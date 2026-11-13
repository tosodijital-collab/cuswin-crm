"use client";

import { useState } from "react";
import { CompetitorGuide, DoorGuide, ObjectionGuide, ProductGuide } from "./guides";
import { MaterialsList } from "./materials-list";
import { PageTitle } from "./ui";

// Telefon konuşması aramada kartın içinde açılır; Rehber kapıda ve demoda elinin altında olsun diye.
const TABS = [
  { id: "kapida", label: "Kapıda", body: DoorGuide },
  { id: "urun", label: "Ürün", body: ProductGuide },
  { id: "itiraz", label: "İtiraz", body: ObjectionGuide },
  { id: "rakip", label: "Rakip", body: CompetitorGuide },
  { id: "dosyalar", label: "Dosya", body: MaterialsList },
] as const;

export type GuideTab = (typeof TABS)[number]["id"];

/** Rehber: kapıda ne denir, doktor ne sorar, itiraza ve rakibe ne cevap verilir, hangi dosya gönderilir. */
export function GuideScreen({ initial = "kapida" }: { initial?: GuideTab }) {
  const [tab, setTab] = useState<GuideTab>(initial);
  const Body = TABS.find((t) => t.id === tab)!.body;
  return (
    <div>
      <PageTitle>Rehber</PageTitle>
      <div
        role="tablist"
        aria-label="Rehber bölümleri"
        className="sticky top-0 z-10 -mx-4 mb-4 border-b border-line bg-paper/95 px-4 py-2 backdrop-blur"
      >
        <div className="grid grid-cols-5 gap-1 rounded-xl border border-line bg-surface p-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => {
                setTab(t.id);
                window.scrollTo({ top: 0 });
              }}
              className="min-h-12 rounded-lg text-[14px] font-medium text-muted active:bg-paper aria-selected:bg-ink aria-selected:font-semibold aria-selected:text-white"
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <Body />
    </div>
  );
}
