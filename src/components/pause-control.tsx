"use client";

import { useActionState, useId, useState } from "react";
import { setPauseAction, type ActionState } from "@/lib/actions";
import { isPausedOn } from "@/lib/domain/rules";
import { addDays, formatShortDate, relativeDay } from "@/lib/domain/time";
import type { Pause } from "@/lib/domain/types";
import { showToast } from "./toast";
import { buttonClass, FieldLabel, FormMessage, inputClass } from "./ui";

const initial: ActionState = { ok: false };

function describe(pause: Pause, today: string) {
  if (pause.forever) return "Süresiz ara verildi";
  if (pause.from === pause.until) return `${relativeDay(pause.from!, today)} ara verildi`;
  return `${formatShortDate(pause.from!)} – ${formatShortDate(pause.until!)} arası ara verildi`;
}

/** "Yarın arama yapmayacağım": sabah taraması ve günün listesini belirli günlerde durdurur. */
export function PauseControl({ pause, today, compact }: { pause?: Pause; today: string; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const [range, setRange] = useState(false);
  const [state, action, pending] = useActionState<ActionState, FormData>(async (prev, formData) => {
    const res = await setPauseAction(prev, formData);
    if (res.ok) {
      if (res.message) showToast(res.message);
      setOpen(false);
      setRange(false);
    }
    return res;
  }, initial);
  const uid = useId();

  const activeToday = isPausedOn(pause, today);
  const upcoming = pause && !activeToday && (pause.forever || (pause.until ?? "") >= today);

  if (pause && (activeToday || upcoming)) {
    return (
      <form
        action={action}
        className={`flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-[15px] ${
          activeToday ? "border-late/30 bg-late-soft text-late" : "border-line bg-surface text-ink"
        }`}
      >
        <input type="hidden" name="kind" value="devam" />
        <span>
          {describe(pause, today)}. {activeToday ? "Bugün otomatik liste ve tarama yok." : "O gün sabah liste ve tarama olmayacak."}
        </span>
        <button type="submit" disabled={pending} className="font-medium underline underline-offset-2">
          {activeToday ? "Devam et" : "Ara vermeyi kaldır"}
        </button>
      </form>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={compact ? "text-[15px] font-medium text-meet underline-offset-2 hover:underline" : buttonClass.secondary}
      >
        Ara ver (aramaya çıkmayacağım)
      </button>
    );
  }

  const choice = (kind: string, label: string) => (
    <button type="submit" name="kind" value={kind} disabled={pending} className={buttonClass.secondary}>
      {label}
    </button>
  );

  return (
    <form action={action} className="grid gap-3 rounded-md border border-line bg-surface p-3">
      <p className="text-[15px] text-muted">
        Seçtiğin günlerde sabah taraması ve yeni arama listesi oluşmaz. Takipler ve randevu hatırlatmaları sürer.
      </p>
      {!range ? (
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          {choice("bugun", "Bugün")}
          {choice("yarin", "Yarın")}
          <button type="button" onClick={() => setRange(true)} className={buttonClass.secondary}>
            Tarih seç
          </button>
          {choice("suresiz", "Süresiz")}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <input type="hidden" name="kind" value="aralik" />
          <div>
            <FieldLabel htmlFor={`${uid}-from`}>Başlangıç</FieldLabel>
            <input id={`${uid}-from`} type="date" name="from" min={today} defaultValue={addDays(today, 1)} required className={inputClass} />
          </div>
          <div>
            <FieldLabel htmlFor={`${uid}-until`}>Bitiş</FieldLabel>
            <input id={`${uid}-until`} type="date" name="until" min={today} defaultValue={addDays(today, 1)} required className={inputClass} />
          </div>
          <button type="submit" disabled={pending} className={`${buttonClass.primary} col-span-2`}>
            Bu günlerde ara ver
          </button>
        </div>
      )}
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => { setOpen(false); setRange(false); }} className="text-[15px] text-muted hover:text-ink">
          Vazgeç
        </button>
        <FormMessage state={state.ok ? { ok: false } : state} />
      </div>
    </form>
  );
}
