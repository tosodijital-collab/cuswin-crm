// Gün sonu raporu ve satış hedefi. Satış kiti: "Her akşam tabloyu güncelle".
// Araştırmadaki 90 günlük plan: ilk 30 günde 5 ücretli klinik.

import { addDays, toDateStr } from "./time";
import type { Activity, Business, DateStr, VisitResult } from "./types";

export const SALES_GOAL = {
  label: "İlk 30 gün: 5 ücretli klinik",
  customers: 5,
  from: "2026-11-12",
  to: "2026-12-11",
} as const;

/** Tanıştırmayla açılan kayıtların ilk notu; rapor bununla sayar. */
export const REFERRAL_NOTE_PREFIX = "Tanıştırma ile eklendi";

// Randevu geçmişine değişiklik, iptal ve sonuç da "randevu" türüyle yazılır; yeni randevu yalnızca tarihtir.
const NOT_A_NEW_APPOINTMENT = /^(Randevu değiştirildi|Randevu iptal|Görüşme yapıldı)/;

export type ActivityReport = {
  calls: number;
  /** Arama sonucu "görüşüldü" ya da "tekrar aranacak": birine ulaşıldı. */
  reached: number;
  unreachable: number;
  appointmentsBooked: number;
  visits: number;
  visitsBy: Partial<Record<VisitResult, number>>;
  /** Demo yapılan ziyaret. */
  demos: number;
  referrals: number;
  offers: number;
  newCustomers: number;
};

/** [from, to] (Türkiye günleri, ikisi dahil) arasındaki geçmişten sayılar. */
export function buildActivityReport(activities: Activity[], from: DateStr, to: DateStr): ActivityReport {
  const r: ActivityReport = {
    calls: 0,
    reached: 0,
    unreachable: 0,
    appointmentsBooked: 0,
    visits: 0,
    visitsBy: {},
    demos: 0,
    referrals: 0,
    offers: 0,
    newCustomers: 0,
  };
  for (const a of activities) {
    if (a.voidedAt) continue;
    const day = toDateStr(new Date(a.at));
    if (day < from || day > to) continue;
    switch (a.type) {
      case "arama":
        r.calls++;
        if (a.callResult === "gorusuldu" || a.callResult === "tekrar_aranacak") r.reached++;
        if (a.callResult === "ulasilamadi") r.unreachable++;
        break;
      case "randevu":
        if (!NOT_A_NEW_APPOINTMENT.test(a.note ?? "")) r.appointmentsBooked++;
        break;
      case "ziyaret":
        r.visits++;
        if (a.visitResult) r.visitsBy[a.visitResult] = (r.visitsBy[a.visitResult] ?? 0) + 1;
        if (a.visitResult === "demo_yapildi") r.demos++;
        break;
      case "not":
        if (a.note?.startsWith(REFERRAL_NOTE_PREFIX)) r.referrals++;
        break;
      case "asama":
        if (a.stage === "teklif_gonderildi") r.offers++;
        if (a.stage === "musteri_oldu") r.newCustomers++;
        break;
    }
  }
  return r;
}

export type GoalProgress = { customers: number; target: number; daysLeft: number; daysTotal: number; started: boolean };

export function goalProgress(businesses: Pick<Business, "salesStage">[], today: DateStr): GoalProgress {
  const span = (a: DateStr, b: DateStr) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);
  const daysTotal = span(SALES_GOAL.from, SALES_GOAL.to) + 1;
  const started = today >= SALES_GOAL.from;
  const daysLeft = started ? Math.max(0, span(today, SALES_GOAL.to) + 1) : daysTotal;
  return {
    customers: businesses.filter((b) => b.salesStage === "musteri_oldu").length,
    target: SALES_GOAL.customers,
    daysLeft,
    daysTotal,
    started,
  };
}

/** Haftanın pazartesisi (rapor "bu hafta" dönemi). */
export function weekStart(today: DateStr): DateStr {
  const dow = new Date(`${today}T12:00:00+03:00`).getUTCDay(); // 0 pazar
  return addDays(today, -((dow + 6) % 7));
}

/** WhatsApp'a ya da nota yapıştırmak için kısa özet. */
export function reportText(title: string, r: ActivityReport, goal: GoalProgress): string {
  return [
    `Cuswin saha · ${title}`,
    `Arama: ${r.calls} (ulaşılan ${r.reached}, ulaşılamayan ${r.unreachable})`,
    `Randevu alındı: ${r.appointmentsBooked}`,
    `Ziyaret: ${r.visits} (demo ${r.demos})`,
    `Tanıştırma: ${r.referrals} · Teklif: ${r.offers} · Yeni müşteri: ${r.newCustomers}`,
    `Hedef: ${goal.customers}/${goal.target} müşteri, ${goal.daysLeft} gün kaldı`,
  ].join("\n");
}
