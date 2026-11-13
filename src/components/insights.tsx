"use client";

// "Ne öğrendin?": sorulara gelen cevapları tek dokunuşla işaretle. Seçilenler hangi sonuç kaydedilirse
// onun notuna "Öğrenilen: …" satırı olarak eklenir; yüz yüze görüşmede ve listelerde geri gelir.

import { createContext, useContext, type ReactNode } from "react";
import { INSIGHTS, insightLine, parseInsights, type InsightId } from "@/lib/domain/sales-playbook";

const Ctx = createContext("");

export function InsightsProvider({ selected, children }: { selected: readonly InsightId[]; children: ReactNode }) {
  return <Ctx.Provider value={insightLine(selected)}>{children}</Ctx.Provider>;
}

/** Formun içine konur; seçili bir şey yoksa hiçbir şey göndermez. */
export function InsightsField() {
  const v = useContext(Ctx);
  return v ? <input type="hidden" name="insights" value={v} /> : null;
}

export function useInsightLine(): string {
  return useContext(Ctx);
}

export function InsightChips({ selected, onChange }: { selected: readonly InsightId[]; onChange: (ids: InsightId[]) => void }) {
  return (
    <fieldset>
      <legend className="mb-1.5 text-[15px] font-semibold">Ne öğrendin? <span className="font-normal text-muted">(dokun, nota eklenir)</span></legend>
      <div className="flex flex-wrap gap-1.5">
        {INSIGHTS.map((i) => {
          const on = selected.includes(i.id);
          return (
            <button
              key={i.id}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(on ? selected.filter((x) => x !== i.id) : [...selected, i.id])}
              className={`min-h-10 rounded-full border px-3 text-[14px] font-medium ${
                on ? (i.hot ? "border-late bg-late text-white" : "border-ink bg-ink text-white") : "border-line bg-surface text-ink"
              }`}
            >
              {i.label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

/** Son görüşmeden öğrenilenler: "Sıcak" rozeti ve kısa satır. */
export function InsightSummary({ notes }: { notes: (string | undefined)[] }) {
  const found = notes.map(parseInsights).find((p) => p.labels.length);
  if (!found) return null;
  return (
    <p className="mt-1 text-sm">
      {found.hot && <span className="mr-1.5 rounded bg-late px-1.5 py-0.5 text-[12px] font-semibold text-white">Sıcak</span>}
      <span className="text-muted">{found.labels.join(" · ")}</span>
    </p>
  );
}

export function isHot(notes: (string | undefined)[]): boolean {
  return notes.map(parseInsights).find((p) => p.labels.length)?.hot ?? false;
}
