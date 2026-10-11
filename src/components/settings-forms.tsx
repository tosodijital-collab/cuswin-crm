"use client";

import { useActionState, useEffect } from "react";
import { notifyDataChanged } from "@/lib/client/refresh";
import { runDailyListAction, saveSettingsAction, startScanAction, type ActionState } from "@/lib/actions";
import { ANKARA_DISTRICTS, CATEGORY_LABELS } from "@/lib/domain/labels";
import { CATEGORIES, type Settings } from "@/lib/domain/types";
import { buttonClass, FieldLabel, FormMessage, inputClass } from "./ui";

const initial: ActionState = { ok: false };

export function SettingsForm({ settings }: { settings: Settings }) {
  const [state, action, pending] = useActionState(saveSettingsAction, initial);
  return (
    <form action={action} className="grid gap-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <FieldLabel htmlFor="dailyTarget">Günlük yeni işletme hedefi</FieldLabel>
          <input id="dailyTarget" type="number" name="dailyTarget" min={1} max={100} required defaultValue={settings.dailyTarget} className={inputClass} />
        </div>
        <div>
          <FieldLabel htmlFor="reminderMinutes">Randevu hatırlatması (dakika önce)</FieldLabel>
          <input id="reminderMinutes" type="number" name="reminderMinutes" min={0} max={1440} required defaultValue={settings.reminderMinutes} className={inputClass} />
        </div>
        <div>
          <FieldLabel htmlFor="scanLimit">Bir taramada eklenecek en fazla yeni işletme</FieldLabel>
          <input id="scanLimit" type="number" name="scanLimit" min={1} max={200} required defaultValue={settings.scanLimit} className={inputClass} />
        </div>
      </div>
      <fieldset>
        <legend className="mb-1 text-sm font-medium text-muted">Aranacak kategoriler</legend>
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          {CATEGORIES.map((c) => (
            <label key={c} className="flex items-center gap-2 text-[15px]">
              <input type="checkbox" name="categories" value={c} defaultChecked={settings.categories.includes(c)} className="size-4 accent-ink" />
              {CATEGORY_LABELS[c]}
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="mb-1 text-sm font-medium text-muted">İlçeler (hiçbiri seçilmezse Ankara geneli)</legend>
        <div className="grid grid-cols-2 gap-x-5 gap-y-2 sm:grid-cols-3 lg:grid-cols-5">
          {ANKARA_DISTRICTS.map((d) => (
            <label key={d} className="flex items-center gap-2 text-[15px]">
              <input type="checkbox" name="districts" value={d} defaultChecked={settings.districts.includes(d)} className="size-4 accent-ink" />
              {d}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className={buttonClass.primary}>
          Ayarları kaydet
        </button>
        <FormMessage state={state} />
      </div>
    </form>
  );
}

export function RunNowButton({ primary }: { primary?: boolean }) {
  const [state, action, pending] = useActionState(runDailyListAction, initial);
  return (
    <form action={action} className="flex flex-wrap items-center gap-3">
      <button type="submit" disabled={pending} className={primary ? buttonClass.primary : buttonClass.secondary}>
        {pending ? "Hazırlanıyor" : "Bugünün listesini şimdi hazırla"}
      </button>
      <FormMessage state={state} />
    </form>
  );
}

export function ScanButton({ running, disabled }: { running: boolean; disabled: boolean }) {
  const [state, action, pending] = useActionState(startScanAction, initial);
  // İstek bırakıldıktan sonra ve tarama sürerken ekranı tazele; tarama bitince durur.
  const active = running || state.ok;
  useEffect(() => {
    if (!active) return;
    const t = setInterval(notifyDataChanged, 10_000);
    return () => clearInterval(t);
  }, [active]);
  return (
    <form action={action} className="flex flex-wrap items-center gap-3">
      <button type="submit" disabled={pending || running || disabled} className={buttonClass.primary}>
        {running ? "Tarama sürüyor" : "Şimdi tara"}
      </button>
      <FormMessage state={state} />
    </form>
  );
}
