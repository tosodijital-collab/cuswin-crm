"use client";

import { useActionState, useEffect, useId, useState } from "react";
import { recordCallAction, type ActionState } from "@/app/actions";
import { CALL_STATUS_LABELS, SALES_STAGE_LABELS } from "@/lib/domain/labels";
import { CALL_STATUSES, SALES_STAGES, type CallStatus, type SalesStage } from "@/lib/domain/types";
import { buttonClass, FieldLabel, FormMessage, inputClass } from "./ui";

const NEEDS_DATE: ReadonlySet<CallStatus> = new Set(["tekrar_aranacak"]);
const ALLOWS_DATE: ReadonlySet<CallStatus> = new Set(["tekrar_aranacak", "gorusuldu", "ulasilamadi", "aranacak"]);

export function CallOutcomeForm({
  businessId,
  currentStage,
  today,
  onDone,
  autoFocus,
}: {
  businessId: string;
  currentStage: SalesStage;
  today: string;
  onDone?: () => void;
  autoFocus?: boolean;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(recordCallAction, { ok: false });
  const [result, setResult] = useState<CallStatus | "">("");
  const uid = useId();

  useEffect(() => {
    if (state.ok) onDone?.();
  }, [state, onDone]);

  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="businessId" value={businessId} />
      <div>
        <FieldLabel htmlFor={`${uid}-result`}>Arama sonucu</FieldLabel>
        <select
          id={`${uid}-result`}
          name="result"
          required
          autoFocus={autoFocus}
          value={result}
          onChange={(e) => setResult(e.target.value as CallStatus)}
          className={inputClass}
        >
          <option value="" disabled>
            Seçin
          </option>
          {CALL_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s === "aranacak" ? "Aranacak (yeniden aç)" : CALL_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      </div>
      <div>
        <FieldLabel htmlFor={`${uid}-stage`}>Satış aşaması</FieldLabel>
        <select id={`${uid}-stage`} name="stage" defaultValue="" className={inputClass}>
          <option value="">Değişmesin ({SALES_STAGE_LABELS[currentStage]})</option>
          {SALES_STAGES.filter((s) => s !== currentStage).map((s) => (
            <option key={s} value={s}>
              {SALES_STAGE_LABELS[s]}
            </option>
          ))}
        </select>
      </div>
      {result && ALLOWS_DATE.has(result) && (
        <div className="grid grid-cols-[1fr_7rem] gap-2 sm:col-span-2">
          <div>
            <FieldLabel htmlFor={`${uid}-date`}>
              {NEEDS_DATE.has(result)
                ? "Ne zaman aranacak?"
                : result === "ulasilamadi"
                  ? "Sonraki deneme (boşsa yarın)"
                  : "Sonraki arama (isteğe bağlı)"}
            </FieldLabel>
            <input
              id={`${uid}-date`}
              type="date"
              name="nextDate"
              min={today}
              required={NEEDS_DATE.has(result)}
              className={inputClass}
            />
          </div>
          <div>
            <FieldLabel htmlFor={`${uid}-time`}>Saat</FieldLabel>
            <input id={`${uid}-time`} type="time" name="nextTime" className={inputClass} />
          </div>
        </div>
      )}
      <div className="sm:col-span-2">
        <FieldLabel htmlFor={`${uid}-note`}>Not</FieldLabel>
        <textarea
          id={`${uid}-note`}
          name="note"
          rows={2}
          maxLength={2000}
          placeholder="Kiminle konuşuldu, ne söylendi?"
          className={inputClass}
        />
      </div>
      <div className="flex items-center gap-3 sm:col-span-2">
        <button type="submit" disabled={pending} className={buttonClass.primary}>
          {pending ? "Kaydediliyor" : "Sonucu kaydet"}
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
