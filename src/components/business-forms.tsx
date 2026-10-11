"use client";

import { useActionState, useEffect, useId, useRef } from "react";
import { addNoteAction, setStageAction, voidActivityAction, type ActionState } from "@/lib/actions";
import { SALES_STAGE_LABELS } from "@/lib/domain/labels";
import { SALES_STAGES, type SalesStage } from "@/lib/domain/types";
import { buttonClass, FieldLabel, FormMessage, inputClass } from "./ui";

const initial: ActionState = { ok: false };

export function StageForm({ businessId, stage }: { businessId: string; stage: SalesStage }) {
  const [state, action, pending] = useActionState(setStageAction, initial);
  const uid = useId();
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="businessId" value={businessId} />
      <div className="min-w-48 flex-1">
        <FieldLabel htmlFor={uid}>Satış aşaması</FieldLabel>
        <select id={uid} name="stage" defaultValue={stage} key={stage} className={inputClass}>
          {SALES_STAGES.map((s) => (
            <option key={s} value={s}>
              {SALES_STAGE_LABELS[s]}
            </option>
          ))}
        </select>
      </div>
      <button type="submit" disabled={pending} className={buttonClass.secondary}>
        Aşamayı kaydet
      </button>
      <div className="w-full">
        <FormMessage state={state} />
      </div>
    </form>
  );
}

export function NoteForm({ businessId }: { businessId: string }) {
  const [state, action, pending] = useActionState(addNoteAction, initial);
  const ref = useRef<HTMLFormElement>(null);
  const uid = useId();
  useEffect(() => {
    if (state.ok) ref.current?.reset();
  }, [state]);
  return (
    <form ref={ref} action={action} className="grid gap-2">
      <input type="hidden" name="businessId" value={businessId} />
      <FieldLabel htmlFor={uid}>Arama dışı not</FieldLabel>
      <textarea id={uid} name="note" rows={2} required maxLength={2000} className={inputClass} />
      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className={buttonClass.secondary}>
          Notu ekle
        </button>
        <FormMessage state={state} />
      </div>
    </form>
  );
}

export function VoidActivityButton({ businessId, activityId }: { businessId: string; activityId: string }) {
  const [state, action, pending] = useActionState(voidActivityAction, initial);
  return (
    <form action={action} className="inline">
      <input type="hidden" name="businessId" value={businessId} />
      <input type="hidden" name="activityId" value={activityId} />
      <button
        type="submit"
        disabled={pending}
        className="text-sm text-muted underline-offset-2 hover:text-stop hover:underline"
        title="Kayıt silinmez; üstü çizilir ve hesaplamalardan çıkarılır"
      >
        Hatalı kayıt
      </button>
      {!state.ok && state.message && <span className="ml-2 text-sm text-stop">{state.message}</span>}
    </form>
  );
}
