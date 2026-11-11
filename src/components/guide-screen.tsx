"use client";

import { useState } from "react";
import { ObjectionGuide, PhoneGuide, VisitGuide } from "./guides";
import { MaterialsList } from "./materials-list";
import { PageTitle } from "./ui";

const TABS = [
  { id: "telefon", label: "Telefon", body: PhoneGuide },
  { id: "ziyaret", label: "Ziyaret", body: VisitGuide },
  { id: "itiraz", label: "İtirazlar", body: ObjectionGuide },
  { id: "dosyalar", label: "Dosyalar", body: MaterialsList },
] as const;

export type GuideTab = (typeof TABS)[number]["id"];

/** Rehber: aramada ne denir, ziyarette ne yapılır, itiraza ne cevap verilir, hangi dosya gönderilir. */
export function GuideScreen({ initial = "telefon" }: { initial?: GuideTab }) {
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
        <div className="grid grid-cols-4 gap-1 rounded-xl border border-line bg-surface p-1">
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
              className="min-h-12 rounded-lg text-[15px] font-medium text-muted active:bg-paper aria-selected:bg-ink aria-selected:font-semibold aria-selected:text-white"
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
