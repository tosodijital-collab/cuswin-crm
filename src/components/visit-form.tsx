"use client";

import { useActionState, useEffect, useId, useState } from "react";
import { recordVisitAction, type ActionState } from "@/lib/actions";
import { SALES_STAGE_LABELS, VISIT_RESULT_LABELS } from "@/lib/domain/labels";
import { suggestedFollowUp } from "@/lib/domain/rules";
import { SALES_STAGES, VISIT_RESULTS, type SalesStage, type VisitResult } from "@/lib/domain/types";
import { showToast } from "./toast";
import { buttonClass, FieldLabel, FormMessage, inputClass } from "./ui";

/** Saha ziyareti sonucu. Arama değildir: arama sayısına ve ulaşılamama sayacına girmez. */
export function VisitForm({
  businessId,
  currentStage,
  today,
  appointmentId,
  onDone,
}: {
  businessId: string;
  currentStage: SalesStage;
  today: string;
  /** Ziyaret bir randevuya bağlıysa; kapalı değilse randevu "yapıldı" olur. */
  appointmentId?: string;
  onDone?: () => void;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(recordVisitAction, { ok: false });
  const [result, setResult] = useState<VisitResult>();
  const uid = useId();

  useEffect(() => {
    if (state.ok && onDone) {
      if (state.message) showToast(state.message);
      onDone();
    }
  }, [state, onDone]);

  return (
    <form action={action} className="grid gap-3">
      <input type="hidden" name="businessId" value={businessId} />
      {appointmentId && <input type="hidden" name="appointmentId" value={appointmentId} />}
      <fieldset>
        <legend className="mb-1 text-sm font-medium text-muted">Ziyaret sonucu</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {VISIT_RESULTS.map((r) => (
            <label
              key={r}
              className="flex min-h-11 cursor-pointer items-center gap-2 rounded-md border border-line bg-surface px-3 text-[15px] has-checked:border-ink has-checked:bg-paper"
            >
              <input type="radio" name="result" value={r} required onChange={() => setResult(r)} className="accent-ink" />
              {VISIT_RESULT_LABELS[r]}
            </label>
          ))}
        </div>
      </fieldset>

      {result && result !== "ilgilenmiyor" && (
        <div className="grid grid-cols-[1fr_7rem] gap-2">
          <div>
            <FieldLabel htmlFor={`${uid}-date`}>
              {result === "kapali" ? "Randevu için tekrar ara" : "Takip araması (tarih koymadan çıkma)"}
            </FieldLabel>
            {/* Sonuç değişince önerilen gün yeniden gelsin diye key sonuca bağlı. */}
            <input
              key={result}
              id={`${uid}-date`}
              type="date"
              name="nextDate"
              min={today}
              defaultValue={suggestedFollowUp(result, today)}
              className={inputClass}
            />
          </div>
          <div>
            <FieldLabel htmlFor={`${uid}-time`}>Saat</FieldLabel>
            <input id={`${uid}-time`} type="time" name="nextTime" className={inputClass} />
          </div>
        </div>
      )}

      {result && result !== "kapali" && (
        <div>
          <FieldLabel htmlFor={`${uid}-ref`}>Tanıştırma: bu sorunu yaşayan başka klinik var mı?</FieldLabel>
          <input
            id={`${uid}-ref`}
            name="referral"
            maxLength={300}
            placeholder="Klinik ya da doktor adı, telefon"
            className={inputClass}
          />
        </div>
      )}

      <details className="rounded-md border border-line bg-surface px-3 py-2">
        <summary className="cursor-pointer text-[15px] text-muted">Satış aşaması ve not</summary>
        <div className="mt-3 grid gap-3">
          <div>
            <FieldLabel htmlFor={`${uid}-stage`}>Satış aşaması</FieldLabel>
            <select id={`${uid}-stage`} name="stage" defaultValue="" className={inputClass}>
              <option value="">Sonuca göre otomatik ({SALES_STAGE_LABELS[currentStage]})</option>
              {SALES_STAGES.filter((s) => s !== currentStage).map((s) => (
                <option key={s} value={s}>
                  {SALES_STAGE_LABELS[s]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <FieldLabel htmlFor={`${uid}-note`}>Not</FieldLabel>
            <textarea
              id={`${uid}-note`}
              name="note"
              rows={2}
              maxLength={2000}
              placeholder="Kiminle görüştün, ne dedi, demo yapıldı mı?"
              className={inputClass}
            />
          </div>
        </div>
      </details>

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className={buttonClass.primary}>
          {pending ? "Kaydediliyor" : "Ziyareti kaydet"}
        </button>
        {onDone && (
          <button type="button" onClick={onDone} className="text-[15px] text-muted hover:text-ink">
            Vazgeç
          </button>
        )}
        <FormMessage state={state} />
      </div>
    </form>
  );
}
