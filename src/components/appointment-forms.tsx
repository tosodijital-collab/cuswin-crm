"use client";

import { useActionState, useEffect, useId, useState } from "react";
import {
  cancelAppointmentAction,
  completeAppointmentAction,
  createAppointmentAction,
  retryCalendarAction,
  updateAppointmentAction,
  type ActionState,
} from "@/app/actions";
import { MEETING_TYPE_LABELS } from "@/lib/domain/labels";
import { MEETING_TYPES, type Appointment } from "@/lib/domain/types";
import { buttonClass, FieldLabel, FormMessage, inputClass } from "./ui";

const initial: ActionState = { ok: false };

type Defaults = { date: string; time: string };

/** Yeni randevu (businessId) ya da mevcut randevuyu değiştirme (appointment). */
export function AppointmentForm({
  businessId,
  appointment,
  defaults,
  defaultReminder,
  onDone,
}: {
  businessId?: string;
  appointment?: Appointment;
  defaults: Defaults;
  defaultReminder: number;
  onDone?: () => void;
}) {
  const [state, action, pending] = useActionState(
    appointment ? updateAppointmentAction : createAppointmentAction,
    initial,
  );
  const uid = useId();
  useEffect(() => {
    if (state.ok) onDone?.();
  }, [state, onDone]);

  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      {businessId && <input type="hidden" name="businessId" value={businessId} />}
      {appointment && <input type="hidden" name="appointmentId" value={appointment.id} />}
      <div className="grid grid-cols-[1fr_7rem] gap-2 sm:col-span-2">
        <div>
          <FieldLabel htmlFor={`${uid}-date`}>Tarih</FieldLabel>
          <input id={`${uid}-date`} type="date" name="date" required defaultValue={defaults.date} className={inputClass} />
        </div>
        <div>
          <FieldLabel htmlFor={`${uid}-time`}>Saat</FieldLabel>
          <input id={`${uid}-time`} type="time" name="time" required defaultValue={defaults.time} className={inputClass} />
        </div>
      </div>
      <div>
        <FieldLabel htmlFor={`${uid}-contact`}>Görüşülecek kişi</FieldLabel>
        <input
          id={`${uid}-contact`}
          name="contactName"
          maxLength={120}
          defaultValue={appointment?.contactName}
          className={inputClass}
        />
      </div>
      <div>
        <FieldLabel htmlFor={`${uid}-type`}>Görüşme türü</FieldLabel>
        <select
          id={`${uid}-type`}
          name="meetingType"
          required
          defaultValue={appointment?.meetingType ?? "yuz_yuze"}
          className={inputClass}
        >
          {MEETING_TYPES.map((t) => (
            <option key={t} value={t}>
              {MEETING_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
      </div>
      <div className="sm:col-span-2">
        <FieldLabel htmlFor={`${uid}-loc`}>Bağlantı veya adres</FieldLabel>
        <input id={`${uid}-loc`} name="location" maxLength={400} defaultValue={appointment?.location} className={inputClass} />
      </div>
      <div className="sm:col-span-2">
        <FieldLabel htmlFor={`${uid}-note`}>Kısa not</FieldLabel>
        <input id={`${uid}-note`} name="note" maxLength={1000} defaultValue={appointment?.note} className={inputClass} />
      </div>
      <div>
        <FieldLabel htmlFor={`${uid}-rem`}>Hatırlatma (dakika önce)</FieldLabel>
        <input
          id={`${uid}-rem`}
          type="number"
          name="reminderMinutes"
          min={0}
          max={1440}
          required
          defaultValue={appointment?.reminderMinutes ?? defaultReminder}
          className={inputClass}
        />
      </div>
      <div className="flex items-end gap-3 sm:col-span-2">
        <button type="submit" disabled={pending} className={buttonClass.primary}>
          {appointment ? "Randevuyu güncelle" : "Randevuyu kaydet"}
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

export function AppointmentControls({
  appointment,
  defaults,
  isPast,
}: {
  appointment: Appointment;
  defaults: Defaults;
  isPast: boolean;
}) {
  const [mode, setMode] = useState<"none" | "edit" | "complete">("none");
  const [cancelState, cancelAction, cancelPending] = useActionState(cancelAppointmentAction, initial);
  const [doneState, doneAction, donePending] = useActionState(completeAppointmentAction, initial);
  const uid = useId();
  const close = () => setMode("none");

  if (appointment.status !== "planlandi") return null;

  return (
    <div className="mt-2">
      {mode === "none" && (
        <div className="flex flex-wrap gap-2">
          {isPast && (
            <button type="button" onClick={() => setMode("complete")} className={buttonClass.primary}>
              Sonucu gir
            </button>
          )}
          <button type="button" onClick={() => setMode("edit")} className={buttonClass.secondary}>
            Değiştir
          </button>
          <form action={cancelAction}>
            <input type="hidden" name="appointmentId" value={appointment.id} />
            <button type="submit" disabled={cancelPending} className={buttonClass.danger}>
              İptal et
            </button>
          </form>
          <FormMessage state={cancelState} />
        </div>
      )}
      {mode === "edit" && (
        <div className="rounded-md border border-line bg-paper/60 p-3">
          <AppointmentForm appointment={appointment} defaults={defaults} defaultReminder={appointment.reminderMinutes} onDone={close} />
        </div>
      )}
      {mode === "complete" && (
        <form action={doneAction} className="grid gap-2 rounded-md border border-line bg-paper/60 p-3">
          <input type="hidden" name="appointmentId" value={appointment.id} />
          <FieldLabel htmlFor={uid}>Görüşme nasıl geçti?</FieldLabel>
          <textarea id={uid} name="outcome" rows={2} required maxLength={1000} className={inputClass} />
          <div className="flex items-center gap-3">
            <button type="submit" disabled={donePending} className={buttonClass.primary}>
              Görüşmeyi kaydet
            </button>
            <button type="button" onClick={close} className="text-[15px] text-muted hover:text-ink">
              Vazgeç
            </button>
            <FormMessage state={doneState} />
          </div>
        </form>
      )}
    </div>
  );
}

export function NewAppointmentToggle(props: { businessId: string; defaults: Defaults; defaultReminder: number }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={buttonClass.secondary}>
        Randevu ekle
      </button>
    );
  }
  return <AppointmentForm {...props} onDone={() => setOpen(false)} />;
}

export function CalendarStatus({ appointment }: { appointment: Appointment }) {
  const [state, action, pending] = useActionState(retryCalendarAction, initial);
  const sync = appointment.calendar;
  if (!sync || sync.status === "kapali") return null;
  if (sync.status === "hata") {
    return (
      <form action={action} className="mt-1 flex flex-wrap items-center gap-2 text-sm text-stop">
        <input type="hidden" name="appointmentId" value={appointment.id} />
        <span>Google Takvim&apos;e yazılamadı: {sync.error}</span>
        <button type="submit" disabled={pending} className="font-medium underline">
          Tekrar dene
        </button>
        <FormMessage state={state} />
      </form>
    );
  }
  return (
    <p className="mt-1 text-sm text-call">
      {sync.status === "eklendi" ? "Google Takvim'de" : "Google Takvim'den kaldırıldı"}
    </p>
  );
}
