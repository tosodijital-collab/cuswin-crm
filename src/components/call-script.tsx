"use client";

// "Ara"ya basınca kartın içinde açılan konuşma: açılış → sorular → bağla → tarih iste → teyit,
// altında "ne derse ne diyeceğim". Metinler sales-playbook.ts ve Cuswin-Arama-Senaryosu.pdf ile aynı.

import { useState } from "react";
import { callScriptFor, type ScriptWho } from "@/lib/domain/call-script";
import type { Business } from "@/lib/domain/types";

export function CallScript({
  business,
  today,
  fieldDate,
  afterFile,
}: {
  business: Business;
  today: string;
  fieldDate?: string;
  /** Tanıtım gönderilmiş, dönüş yok: açılış "dosyayı göndermiştim" olur. */
  afterFile?: boolean;
}) {
  const [who, setWho] = useState<ScriptWho>("sekreter");
  const s = callScriptFor(business, who, today, fieldDate, { afterFile });

  return (
    <div className="grid gap-3">
      <div role="tablist" aria-label="Telefonu kim açtı?" className="grid grid-cols-2 gap-1 rounded-lg border border-line bg-surface p-1">
        {(
          [
            ["sekreter", "Sekreter açtı"],
            ["doktor", "Doktor açtı"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={who === id}
            onClick={() => setWho(id)}
            className="min-h-11 rounded-md text-[15px] font-medium text-muted aria-selected:bg-ink aria-selected:text-white"
          >
            {label}
          </button>
        ))}
      </div>

      <Say label="1. Açılış" text={s.opening} hint={s.note} />

      <div className="rounded-lg border border-line bg-surface px-3.5 py-3">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">2. Sor ve sus</p>
        <ol className="grid gap-3">
          {s.questions.map((q, i) => (
            <li key={q.text} className="flex gap-2.5">
              <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-ink text-xs font-semibold text-white">
                {i + 1}
              </span>
              <div>
                <p className="text-[17px] font-medium leading-snug">&quot;{q.text}&quot;</p>
                <p className="mt-0.5 text-sm text-muted">{q.listen}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>

      <Say label="3. Bağla (cevabını kullan)" text={s.bridge} />
      <Say label="4. Tarih iste" text={s.close} strong hint="Sustuktan sonra ilk konuşan kaybeder: cevabı bekle." />
      <Say label="5. Evet derse: teyit" text={s.confirm} hint="Sonra aşağıdan: Randevu aldım." />

      <details className="group/replies overflow-hidden rounded-lg border border-line bg-surface">
        <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-3.5 text-[16px] font-semibold">
          Ne derse ne diyeceğim ({s.replies.length})
          <span aria-hidden className="text-lg text-muted transition-transform group-open/replies:rotate-90">
            ›
          </span>
        </summary>
        <ul className="border-t border-line">
          {s.replies.map((r) => (
            <li key={r.q} className="border-b border-line last:border-b-0">
              <details className="group">
                <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 bg-paper/50 px-3.5 text-[15px] font-medium">
                  {r.q}
                  <span aria-hidden className="text-lg text-muted transition-transform group-open:rotate-90">
                    ›
                  </span>
                </summary>
                <p className="px-3.5 pb-3 pt-1 text-[16px] leading-relaxed">{r.a}</p>
                {r.app && <p className="px-3.5 pb-3 text-sm font-medium text-meet">Uygulamada: {r.app}</p>}
              </details>
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}

function Say({ label, text, strong, hint }: { label: string; text: string; strong?: boolean; hint?: string }) {
  return (
    <div className={`rounded-lg border px-3.5 py-3 ${strong ? "border-meet/40 bg-meet-soft" : "border-line bg-surface"}`}>
      <p className={`mb-1 text-xs font-semibold uppercase tracking-wide ${strong ? "text-meet" : "text-muted"}`}>{label}</p>
      <p className="text-[17px] leading-relaxed">&quot;{text}&quot;</p>
      {hint && <p className="mt-1.5 text-sm text-muted">{hint}</p>}
    </div>
  );
}
