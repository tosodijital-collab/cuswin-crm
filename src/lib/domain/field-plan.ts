// Saha planı: önce telefonla randevu alınır, sahaya randevulara göre çıkılır.
// Her saha günü için: o günün yüz yüze randevuları, bölgede randevu almak için aranacaklar, ziyaret edilenler.

import { FIELD_DAYS, type FieldDayView, type FieldStop } from "./field-route";
import { toDateStr } from "./time";
import type { Activity, Appointment, Business, DateStr } from "./types";

export type AppointmentItem = { appointment: Appointment; business: Business };

export type ContactSummary = { lastCall?: Activity; lastVisit?: Activity };

export type FieldDayPlan = {
  view: FieldDayView;
  /** O tarihteki yüz yüze randevular (yapılanlar dahil, iptaller hariç), saate göre. */
  appointments: AppointmentItem[];
  /** Bölgede randevusu ve ziyareti olmayan klinikler: randevu için aranacak. */
  toCall: FieldStop[];
  /** Bölgede ziyaret edilmiş (randevusuz uğranmış ya da randevusu bu listede olmayan) klinikler. */
  visited: FieldStop[];
};

export type FieldPlan = {
  days: FieldDayPlan[];
  /** Saha günlerine denk gelmeyen, yaklaşan yüz yüze randevular. */
  otherAppointments: AppointmentItem[];
};

/** Her işletmenin son araması ve son ziyareti (geçmiş yeniden eskiye sıralı gelir). */
export function summarizeContacts(history: Activity[]): Map<string, ContactSummary> {
  const map = new Map<string, ContactSummary>();
  for (const a of [...history].sort((x, y) => y.at.localeCompare(x.at))) {
    if (a.voidedAt) continue;
    const s = map.get(a.businessId) ?? {};
    if (a.type === "arama" && !s.lastCall) s.lastCall = a;
    if (a.type === "ziyaret" && !s.lastVisit) s.lastVisit = a;
    map.set(a.businessId, s);
  }
  return map;
}

export function appointmentDate(a: Pick<Appointment, "startsAt">): DateStr {
  return toDateStr(new Date(a.startsAt));
}

export function buildFieldPlan(
  days: FieldDayView[],
  appointments: AppointmentItem[],
  contacts: Map<string, ContactSummary>,
  now: Date,
): FieldPlan {
  const inPerson = appointments
    .filter((v) => v.appointment.meetingType === "yuz_yuze" && v.appointment.status !== "iptal")
    .sort((a, b) => a.appointment.startsAt.localeCompare(b.appointment.startsAt));

  // Yaklaşan (planlı) randevusu olan klinik aranacaklar listesine girmez: randevusu zaten var.
  const hasUpcoming = new Set(
    inPerson.filter((v) => v.appointment.status === "planlandi" && new Date(v.appointment.startsAt) >= now).map((v) => v.business.id),
  );
  const fieldDates = new Set(FIELD_DAYS.map((d) => d.date));

  const plans = days.map((view): FieldDayPlan => {
    const dayAppointments = inPerson.filter((v) => appointmentDate(v.appointment) === view.day.date);
    const withAppointmentToday = new Set(dayAppointments.map((v) => v.business.id));
    const toCall: FieldStop[] = [];
    const visited: FieldStop[] = [];
    for (const s of view.stops) {
      if (withAppointmentToday.has(s.business.id)) continue;
      if (contacts.get(s.business.id)?.lastVisit) visited.push(s);
      else if (!hasUpcoming.has(s.business.id)) toCall.push(s);
    }
    return { view, appointments: dayAppointments, toCall, visited };
  });

  const otherAppointments = inPerson.filter(
    (v) =>
      v.appointment.status === "planlandi" &&
      new Date(v.appointment.startsAt) >= now &&
      !fieldDates.has(appointmentDate(v.appointment)),
  );
  return { days: plans, otherAppointments };
}
