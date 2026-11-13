"use client";

import { useActionState, useId, useState } from "react";
import { recordVisitAction, type ActionState } from "@/lib/actions";
import { SALES_STAGE_LABELS, VISIT_RESULT_LABELS } from "@/lib/domain/labels";
import { suggestedFollowUp } from "@/lib/domain/rules";
import { insightLine, type InsightId } from "@/lib/domain/sales-playbook";
import { SALES_STAGES, VISIT_RESULTS, type SalesStage, type VisitResult } from "@/lib/domain/types";
import { InsightChips } from "./insights";
import { showToast } from "./toast";
import { buttonClass, FieldLabel, FormMessage, inputClass } from "./ui";

/** Saha ziyareti sonucu. Arama değildir: arama sayısına ve ulaşılamama sayacına girmez. */
export function VisitForm({
  businessId,
  currentStage,
  today,
  appointmentId,
  onDone,
  onSaved,
}: {
  businessId: string;
  currentStage: SalesStage;
  today: string;
  /** Ziyaret bir randevuya bağlıysa; kapalı değilse randevu "yapıldı" olur. */
  appointmentId?: string;
  onDone?: () => void;
  /** Kayıt başarılı olunca (sıradaki adımı göstermek için). */
  onSaved?: (result: VisitResult) => void;
}) {
  // Sonraki adım kaydın hemen ardından açılır: kayıt listeyi tazeleyince kart başka bölüme geçebilir.
  const [state, action, pending] = useActionState<ActionState, FormData>(async (prev, fd) => {
    const r = await recordVisitAction(prev, fd);
    if (r.ok) {
      if (r.message) showToast(r.message);
      const saved = fd.get("result");
      if (saved) onSaved?.(saved as VisitResult);
      onDone?.();
    }
    return r;
  }, { ok: false });
  const [result, setResult] = useState<VisitResult>();
  const [insights, setInsights] = useState<InsightId[]>([]);
  const uid = useId();

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
              {result === "kapali" ? "Tekrar ara" : "Takip araması"}
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
          <p className="col-span-2 -mt-1 text-sm text-muted">Tarih koymadan çıkma. O gün Bugün ekranında aranacaklara düşer.</p>
        </div>
      )}

      {result && result !== "kapali" && (
        <>
          <InsightChips selected={insights} onChange={setInsights} />
          {insights.length > 0 && <input type="hidden" name="insights" value={insightLine(insights)} />}
        </>
      )}

      {result && result !== "kapali" && (
        <fieldset className="rounded-md border border-line bg-surface p-3">
          <legend className="sr-only">Tanıştırma</legend>
          <p className="mb-2 text-sm font-medium text-muted">Tanıştırma: bu sorunu yaşayan başka klinik var mı?</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <input name="referralName" maxLength={200} placeholder="Klinik ya da doktor adı" aria-label="Tanıştırılan klinik" className={inputClass} />
            <input name="referralPhone" type="tel" maxLength={40} placeholder="Telefon (varsa)" aria-label="Tanıştırılan kliniğin telefonu" className={inputClass} />
          </div>
          <p className="mt-1.5 text-sm text-muted">Yazarsan aranacaklara yeni kayıt olarak eklenir.</p>
        </fieldset>
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
