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

/** Gönderilen takip/teyit mesajlarının notu (day-plan.ts SENT_PREFIX ile aynı). */
const SENT_MESSAGE_PREFIX = "Mesaj gönderildi: ";

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
  /** WhatsApp'tan giden tanıtım/broşür, takip ve teyit mesajları. */
  messages: number;
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
    messages: 0,
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
        if (a.note?.includes("WhatsApp'tan gönderildi")) r.messages++;
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
        if (a.note?.startsWith(SENT_MESSAGE_PREFIX)) r.messages++;
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
    `Mesaj: ${r.messages} · Tanıştırma: ${r.referrals} · Teklif: ${r.offers} · Yeni müşteri: ${r.newCustomers}`,
    `Hedef: ${goal.customers}/${goal.target} müşteri, ${goal.daysLeft} gün kaldı`,
  ].join("\n");
}

export type PeriodKind = "gun" | "hafta" | "ay" | "hedef";
export type PeriodRange = {
  from: DateStr;
  to: DateStr;
  prevFrom: DateStr;
  prevTo: DateStr;
  title: string;
  /** Kıyas yazısı: "düne göre", "geçen haftaya göre"... */
  vs: string;
};

/** Ayın ilk günü. */
export function monthStart(today: DateStr): DateStr {
  return `${today.slice(0, 7)}-01`;
}

const dayDiff = (a: DateStr, b: DateStr) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86_400_000);

/**
 * Dönem ve karşılaştırma dönemi. Karşılaştırma aynı uzunlukta bir önceki dönemdir:
 * bugün ↔ dün, bu hafta (pzt–bugün) ↔ geçen haftanın aynı günleri, bu ay ↔ geçen ayın aynı günleri.
 */
export function periodRange(kind: PeriodKind, today: DateStr): PeriodRange {
  if (kind === "gun") {
    const y = addDays(today, -1);
    return { from: today, to: today, prevFrom: y, prevTo: y, title: "bugün", vs: "düne göre" };
  }
  if (kind === "hafta") {
    const from = weekStart(today);
    return { from, to: today, prevFrom: addDays(from, -7), prevTo: addDays(today, -7), title: "bu hafta", vs: "geçen haftaya göre" };
  }
  if (kind === "ay") {
    const from = monthStart(today);
    const prevFrom = monthStart(addDays(from, -1));
    const len = dayDiff(from, today);
    const prevEnd = addDays(from, -1);
    const prevTo = [addDays(prevFrom, len), prevEnd].sort()[0];
    return { from, to: today, prevFrom, prevTo, title: "bu ay", vs: "geçen aya göre" };
  }
  const to = today < SALES_GOAL.to ? today : SALES_GOAL.to;
  const len = Math.max(0, dayDiff(SALES_GOAL.from, to));
  const prevTo = addDays(SALES_GOAL.from, -1);
  return { from: SALES_GOAL.from, to, prevFrom: addDays(prevTo, -len), prevTo, title: "ilk 30 gün", vs: "önceki 30 güne göre" };
}

export type DayRow = { date: DateStr; calls: number; reached: number; appointments: number; visits: number; demos: number };

/** Dönemin her günü için kısa satır (en yeni gün üstte). */
export function dailyBreakdown(activities: Activity[], from: DateStr, to: DateStr): DayRow[] {
  const rows: DayRow[] = [];
  for (let d = to; d >= from; d = addDays(d, -1)) {
    const r = buildActivityReport(activities, d, d);
    rows.push({ date: d, calls: r.calls, reached: r.reached, appointments: r.appointmentsBooked, visits: r.visits, demos: r.demos });
  }
  return rows;
}

/** Dönüşüm oranları (yüzde, tam sayı); payda 0 ise yok. */
export function conversionRates(r: ActivityReport): { label: string; value?: number; detail: string }[] {
  const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : undefined);
  return [
    { label: "Aramada ulaşılan", value: pct(r.reached, r.calls), detail: `${r.reached}/${r.calls}` },
    { label: "Ulaşılandan randevu", value: pct(r.appointmentsBooked, r.reached), detail: `${r.appointmentsBooked}/${r.reached}` },
    { label: "Ziyarette demo", value: pct(r.demos, r.visits), detail: `${r.demos}/${r.visits}` },
    { label: "Demodan müşteri", value: pct(r.newCustomers, r.demos), detail: `${r.newCustomers}/${r.demos}` },
  ];
}
