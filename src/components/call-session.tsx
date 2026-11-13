"use client";

// Arka arkaya arama: bugünün aramaları tek tek açılır. Sonuç kaydedilince görev kapanır ve sıradaki
// klinik kendiliğinden gelir; listeye dönmek gerekmez.

import Link from "next/link";
import { useState } from "react";
import type { TaskView } from "@/lib/data";
import { formatPhone, telHref } from "@/lib/domain/contact-info";
import { taskLabel } from "@/lib/domain/day-plan";
import { CALL_STATUS_LABELS, CATEGORY_LABELS } from "@/lib/domain/labels";
import { relativeDay, toDateStr } from "@/lib/domain/time";
import { CallResult } from "./call-result";
import { CallScript } from "./call-script";
import { InsightSummary } from "./insights";
import { Panel } from "./ui";

export function CallSession({ rows, today, done, onExit }: { rows: TaskView[]; today: string; done: number; onExit: () => void }) {
  const [skipped, setSkipped] = useState<string[]>([]);
  const [scriptFor, setScriptFor] = useState<string>();
  const queue = [...rows.filter((r) => !skipped.includes(r.task.id)), ...rows.filter((r) => skipped.includes(r.task.id))];
  const current = queue[0];
  const total = done + rows.length;

  return (
    <div className="grid gap-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm text-muted">Arama modu</p>
          <p className="text-[17px] font-semibold tabular-nums">
            {done}/{total} arandı · {rows.length} kaldı
          </p>
        </div>
        <button type="button" onClick={onExit} className="min-h-11 rounded-md border border-line bg-surface px-4 text-[15px] font-medium">
          Bitir
        </button>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-line" aria-hidden>
        <div className="h-full rounded-full bg-call transition-all" style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
      </div>

      {!current ? (
        <Panel className="px-4 py-8 text-center">
          <p className="text-xl font-semibold">Bugünün aramaları bitti</p>
          <p className="mt-1 text-[15px] text-muted">Tekrar aranacaklar kendi günlerine planlandı. Takvimden görebilirsin.</p>
          <button type="button" onClick={onExit} className="mt-4 min-h-12 rounded-md bg-ink px-5 text-[16px] font-semibold text-white">
            Plana dön
          </button>
        </Panel>
      ) : (
        <Panel key={current.task.id} className="overflow-hidden">
          <Current
            row={current}
            today={today}
            scriptOpen={scriptFor === current.task.id}
            onScript={(open) => setScriptFor(open ? current.task.id : undefined)}
          />
          <div className="border-t border-line px-4 py-3">
            <button
              type="button"
              onClick={() => setSkipped((s) => [...s.filter((x) => x !== current.task.id), current.task.id])}
              className="min-h-11 w-full text-[15px] font-medium text-muted"
            >
              Şimdi değil, sona at →
            </button>
          </div>
        </Panel>
      )}
    </div>
  );
}

function Current({ row, today, scriptOpen, onScript }: { row: TaskView; today: string; scriptOpen: boolean; onScript: (open: boolean) => void }) {
  const b = row.business;
  const tel = telHref(b.phone);
  const label = taskLabel(row.task, today);
  const last = row.lastCall?.callResult
    ? `Son arama ${relativeDay(toDateStr(new Date(row.lastCall.at)), today).toLocaleLowerCase("tr-TR")}: ${CALL_STATUS_LABELS[row.lastCall.callResult].toLocaleLowerCase("tr-TR")}`
    : undefined;
  return (
    <div className="px-4 py-4">
      <p className={`text-sm font-semibold ${label.late ? "text-late" : "text-meet"}`}>{label.text}</p>
      <Link href={`/isletme?id=${b.id}`} className="mt-0.5 block text-xl font-semibold leading-snug hover:underline">
        {b.name}
      </Link>
      <p className="mt-0.5 text-sm text-muted">{b.categories.map((c) => CATEGORY_LABELS[c]).join(", ")}</p>
      {last && <p className="mt-1 text-sm text-muted">{last}</p>}
      <InsightSummary notes={[row.lastCall?.note]} />

      {tel ? (
        <a
          href={tel}
          onClick={() => onScript(true)}
          className="mt-3 flex min-h-14 items-center justify-center rounded-md bg-call px-4 text-[18px] font-semibold tabular-nums text-white hover:bg-call/90"
        >
          Ara · {formatPhone(b.phone)}
        </a>
      ) : (
        <p className="mt-3 text-sm text-stop">Telefon yok. Kayıttan ekle ya da &quot;Sona at&quot;.</p>
      )}

      <button type="button" onClick={() => onScript(!scriptOpen)} aria-expanded={scriptOpen} className="mt-2 min-h-11 w-full text-[15px] font-medium text-meet">
        {scriptOpen ? "Konuşmayı gizle" : "Ne diyeceğim?"}
      </button>
      {scriptOpen && (
        <div className="mt-1">
          <CallScript business={b} today={today} />
        </div>
      )}

      <p className="mb-2 mt-4 text-[17px] font-semibold">Nasıl bitti?</p>
      <CallResult business={b} today={today} onDone={() => {}} />
    </div>
  );
}
