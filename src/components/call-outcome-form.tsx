"use client";

import { useActionState, useEffect, useId, useState } from "react";
import { recordCallAction, type ActionState } from "@/lib/actions";
import { CALL_STATUS_LABELS, MEETING_TYPE_LABELS, SALES_STAGE_LABELS } from "@/lib/domain/labels";
import { CALL_STATUSES, MEETING_TYPES, SALES_STAGES, type CallStatus, type SalesStage } from "@/lib/domain/types";
import { buttonClass, FieldLabel, FormMessage, inputClass } from "./ui";

const NEEDS_DATE: ReadonlySet<CallStatus> = new Set(["tekrar_aranacak"]);
const ALLOWS_DATE: ReadonlySet<CallStatus> = new Set(["tekrar_aranacak", "gorusuldu", "ulasilamadi", "aranacak"]);

export function CallOutcomeForm({
  businessId,
  currentStage,
  today,
  onDone,
  autoFocus,
  appointment,
}: {
  businessId: string;
  currentStage: SalesStage;
  today: string;
  onDone?: () => void;
  autoFocus?: boolean;
  /** "Randevu aldım": sonuç ve aşama hazır seçili gelir, randevu alanları açılır. */
  appointment?: boolean;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(recordCallAction, { ok: false });
  const [result, setResult] = useState<CallStatus | "">(appointment ? "gorusuldu" : "");
  const [stage, setStage] = useState<SalesStage | "">(appointment && currentStage !== "randevu_alindi" ? "randevu_alindi" : "");
  const withAppointment = stage === "randevu_alindi" || (appointment && currentStage === "randevu_alindi");
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
        <select
          id={`${uid}-stage`}
          name="stage"
          value={stage}
          onChange={(e) => setStage(e.target.value as SalesStage | "")}
          className={inputClass}
        >
          <option value="">Değişmesin ({SALES_STAGE_LABELS[currentStage]})</option>
          {SALES_STAGES.filter((s) => s !== currentStage).map((s) => (
            <option key={s} value={s}>
              {SALES_STAGE_LABELS[s]}
            </option>
          ))}
        </select>
      </div>
      {withAppointment && (
        <fieldset className="grid gap-3 rounded-md border border-meet/30 bg-meet-soft/50 p-3 sm:col-span-2 sm:grid-cols-2">
          <legend className="px-1 text-sm font-medium text-meet">Randevu (Google Takvim&apos;e yazılır)</legend>
          <input type="hidden" name="withAppointment" value="1" />
          <div className="grid grid-cols-[1fr_7rem] gap-2 sm:col-span-2">
            <div>
              <FieldLabel htmlFor={`${uid}-adate`}>Randevu tarihi</FieldLabel>
              <input id={`${uid}-adate`} type="date" name="apptDate" min={today} required className={inputClass} />
            </div>
            <div>
              <FieldLabel htmlFor={`${uid}-atime`}>Saat</FieldLabel>
              <input id={`${uid}-atime`} type="time" name="apptTime" required className={inputClass} />
            </div>
          </div>
          <div>
            <FieldLabel htmlFor={`${uid}-atype`}>Görüşme türü</FieldLabel>
            <select id={`${uid}-atype`} name="apptMeetingType" defaultValue="yuz_yuze" className={inputClass}>
              {MEETING_TYPES.map((t) => (
                <option key={t} value={t}>
                  {MEETING_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <FieldLabel htmlFor={`${uid}-acontact`}>Görüşülecek kişi</FieldLabel>
            <input id={`${uid}-acontact`} name="apptContact" maxLength={120} className={inputClass} />
          </div>
          <div className="sm:col-span-2">
            <FieldLabel htmlFor={`${uid}-aloc`}>Bağlantı veya adres (isteğe bağlı)</FieldLabel>
            <input id={`${uid}-aloc`} name="apptLocation" maxLength={400} className={inputClass} />
          </div>
        </fieldset>
      )}
      {!withAppointment && result && ALLOWS_DATE.has(result) && (
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
          {pending ? "Kaydediliyor" : withAppointment ? "Sonucu ve randevuyu kaydet" : "Sonucu kaydet"}
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
