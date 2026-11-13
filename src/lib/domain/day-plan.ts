// Bugün ekranının planı: hafta şeridi, görev etiketleri, gönderilecek mesajlar ve bugün yapılanlar. Saf fonksiyonlar.

import { FOLLOW_UPS } from "./sales-playbook";
import { addDays, toDateStr } from "./time";
import type { Activity, Appointment, Business, CallTask, DateStr } from "./types";

/** Gönderilen mesajlar bu önekle not olarak kaydedilir; listeden düşmesi buna bakar. */
export const SENT_PREFIX = "Mesaj gönderildi: ";
export const SENT_LABELS = { takip3: "3. gün takip", takip14: "2. hafta takip", teyit: "randevu teyidi" } as const;
export type MessageKind = keyof typeof SENT_LABELS;

export function sentNote(kind: MessageKind): string {
  return SENT_PREFIX + SENT_LABELS[kind];
}

export function daysBetween(from: DateStr, to: DateStr): number {
  return Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86_400_000);
}

/** Bugünden başlayan 7 gün. */
export function weekDays(today: DateStr, count = 7): DateStr[] {
  return Array.from({ length: count }, (_, i) => addDays(today, i));
}

/** Görev neden bugün listede: kısa etiket ve gecikmişse uyarı tonu. */
export function taskLabel(task: Pick<CallTask, "kind" | "reason" | "dueDate" | "dueTime">, today: DateStr): { text: string; late: boolean } {
  if (task.dueDate < today) {
    const d = daysBetween(task.dueDate, today);
    return { text: d === 1 ? "Dünden kaldı" : `${d} gündür bekliyor`, late: true };
  }
  if (task.kind === "yeni") return { text: "Yeni klinik", late: false };
  if (task.reason === "ulasilamadi") return { text: "Dün açmadı, tekrar", late: false };
  return { text: task.dueTime ? `Takip · saat ${task.dueTime}` : "Takip", late: false };
}

/** Bugün yapılacak aramaların sırası: saati olanlar saatine göre, sonra takipler, sonra dünden kalanlar, en son yeniler. */
export function orderToday<T extends { task: Pick<CallTask, "kind" | "reason" | "dueDate" | "dueTime"> }>(items: T[]): T[] {
  const rank = (t: T["task"]) => (t.dueTime ? 0 : t.kind === "takip" && t.reason === "planlandi" ? 1 : t.reason === "ulasilamadi" ? 2 : t.kind === "yeni" ? 4 : 3);
  return [...items].sort(
    (a, b) => rank(a.task) - rank(b.task) || (a.task.dueTime ?? "").localeCompare(b.task.dueTime ?? "") || a.task.dueDate.localeCompare(b.task.dueDate),
  );
}

export type DoneItem = { business: Business; activity: Activity };

/** Bugün yapılan arama ve ziyaretler (işletme başına en sonuncusu), yeniden eskiye. */
export function doneToday(history: Activity[], businesses: Map<string, Business>, today: DateStr): DoneItem[] {
  const seen = new Set<string>();
  const out: DoneItem[] = [];
  for (const a of [...history].sort((x, y) => y.at.localeCompare(x.at))) {
    if (a.voidedAt || (a.type !== "arama" && a.type !== "ziyaret")) continue;
    if (toDateStr(new Date(a.at)) !== today || seen.has(a.businessId)) continue;
    const business = businesses.get(a.businessId);
    if (!business) continue;
    seen.add(a.businessId);
    out.push({ business, activity: a });
  }
  return out;
}

export type MessageTask = {
  kind: MessageKind;
  business: Business;
  /** Ne zaman / neden ("3 gün önce görüştün"). */
  why: string;
  text?: string;
  appointment?: Appointment;
};

const FOLLOW_UP_VISITS = new Set(["demo_yapildi", "doktorla_gorusuldu", "sekreterle_gorusuldu"]);

/**
 * Bugün gönderilecek mesajlar:
 * - Görüşmeden 3 gün sonra (3–13. gün) "3. gün takip", 14–30. gün "2. hafta takip" (satış kiti).
 *   Görüşmeden sonra arandıysa, randevusu varsa ya da kapandıysa çıkmaz.
 * - Yarınki randevulara teyit.
 * Gönderilen her mesaj not olarak kaydedilir; kaydı olan bir daha çıkmaz.
 */
export function messagesDue({
  businesses,
  history,
  sentNotes,
  appointments,
  today,
}: {
  businesses: Map<string, Business>;
  history: Activity[];
  sentNotes: Activity[];
  appointments: Appointment[];
  today: DateStr;
}): MessageTask[] {
  const sentAfter = (businessId: string, kind: MessageKind, sinceIso: string) =>
    sentNotes.some((n) => n.businessId === businessId && n.note === sentNote(kind) && n.at >= sinceIso);
  const upcoming = new Set(appointments.filter((a) => a.status === "planlandi" && toDateStr(new Date(a.startsAt)) >= today).map((a) => a.businessId));

  const latest = new Map<string, { visit?: Activity; lastAt: string }>();
  for (const a of [...history].sort((x, y) => y.at.localeCompare(x.at))) {
    if (a.voidedAt) continue;
    const cur = latest.get(a.businessId) ?? { lastAt: a.at };
    if (a.type === "ziyaret" && !cur.visit) cur.visit = a;
    latest.set(a.businessId, cur);
  }

  const out: MessageTask[] = [];
  for (const [businessId, { visit, lastAt }] of latest) {
    const b = businesses.get(businessId);
    if (!b || !visit || !visit.visitResult || !FOLLOW_UP_VISITS.has(visit.visitResult)) continue;
    if (visit.at !== lastAt || upcoming.has(businessId)) continue;
    if (b.salesStage === "musteri_oldu" || b.salesStage === "olumsuz" || b.callStatus === "ilgilenmiyor" || b.callStatus === "iletisim_kurma") continue;
    const days = daysBetween(toDateStr(new Date(visit.at)), today);
    const kind: MessageKind | undefined = days >= 3 && days < 14 ? "takip3" : days >= 14 && days <= 30 ? "takip14" : undefined;
    if (!kind || sentAfter(businessId, kind, visit.at)) continue;
    const f = FOLLOW_UPS[kind === "takip3" ? 0 : 1];
    out.push({ kind, business: b, why: `${days} gün önce görüştün`, text: f.text });
  }

  const tomorrow = addDays(today, 1);
  const since = `${addDays(today, -3)}T00:00:00Z`;
  for (const a of appointments) {
    if (a.status !== "planlandi" || toDateStr(new Date(a.startsAt)) !== tomorrow) continue;
    const b = businesses.get(a.businessId);
    if (!b || sentAfter(a.businessId, "teyit", since)) continue;
    out.push({ kind: "teyit", business: b, why: "Yarın randevu", appointment: a });
  }
  return out;
}
