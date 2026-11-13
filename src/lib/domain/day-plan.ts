// Bugün ekranının planı: hafta şeridi, görev etiketleri, gönderilecek mesajlar ve bugün yapılanlar. Saf fonksiyonlar.

import { isNewCandidate } from "./rules";
import { FILE_FOLLOW_UP, FOLLOW_UPS } from "./sales-playbook";
import { addDays, toDateStr } from "./time";
import type { Activity, Appointment, Business, CallTask, DateStr, Settings } from "./types";

/** Gönderilen mesajlar bu önekle not olarak kaydedilir; listeden düşmesi buna bakar. */
export const SENT_PREFIX = "Mesaj gönderildi: ";
export const SENT_LABELS = {
  takip3: "3. gün takip",
  takip14: "2. hafta takip",
  teyit: "randevu teyidi",
  dosya2: "dosya takibi",
  dosya7: "dosya son mesaj",
} as const;

/** Mesaj listesindeki kısa adlar. */
export const MESSAGE_TITLES: Record<MessageKind, string> = {
  takip3: "3. gün takip",
  takip14: "2. hafta takip",
  teyit: "Randevu teyidi",
  dosya2: "Dosya takibi",
  dosya7: "Dosya: son mesaj",
};
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

/** Tanıtım WhatsApp'tan gönderilirken arama notuna bu yazılır (send-whatsapp.tsx). */
export const FILE_SENT_MARK = "WhatsApp'tan gönderildi";

/**
 * Dosya gönderilmiş ve dönüş olmamış klinikler: son "bilgi istedi" gönderiminden sonra yalnızca
 * "açmadı" aramaları var (görüşme, ziyaret, ilgilenmiyor yok). Değer: gönderim zamanı.
 */
export function awaitingFile(history: Activity[]): Map<string, string> {
  const byBiz = new Map<string, Activity[]>();
  for (const a of history) {
    if (a.voidedAt || (a.type !== "arama" && a.type !== "ziyaret")) continue;
    const list = byBiz.get(a.businessId) ?? [];
    list.push(a);
    byBiz.set(a.businessId, list);
  }
  const out = new Map<string, string>();
  for (const [id, acts] of byBiz) {
    const sorted = acts.sort((x, y) => y.at.localeCompare(x.at));
    for (const a of sorted) {
      if (a.type === "arama" && a.callResult === "tekrar_aranacak" && a.note?.includes(FILE_SENT_MARK)) {
        out.set(id, a.at);
        break;
      }
      if (!(a.type === "arama" && a.callResult === "ulasilamadi")) break;
    }
  }
  return out;
}

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

  // Dosya gönderildi, dönüş yok: 2. gün hatırlatma, 7. gün son mesaj (sonra 1 ay ertelenir).
  for (const [businessId, sentAt] of awaitingFile(history)) {
    const b = businesses.get(businessId);
    if (!b || upcoming.has(businessId)) continue;
    if (b.salesStage === "musteri_oldu" || b.salesStage === "olumsuz" || b.callStatus === "ilgilenmiyor" || b.callStatus === "iletisim_kurma") continue;
    const days = daysBetween(toDateStr(new Date(sentAt)), today);
    const kind: MessageKind | undefined = days >= 7 && days <= 30 ? "dosya7" : days >= 2 && days < 7 ? "dosya2" : undefined;
    if (!kind || sentAfter(businessId, kind, sentAt)) continue;
    out.push({
      kind,
      business: b,
      why: `${days} gün önce dosya gönderdin, dönüş yok`,
      text: kind === "dosya2" ? FILE_FOLLOW_UP.day2 : FILE_FOLLOW_UP.day7,
    });
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

const weekday = (d: DateStr) => new Date(`${d}T12:00:00Z`).getUTCDay();

/** Plan ufku: bugünden, en az 5 gün ilerideki ilk cumartesiye kadar (cuma → gelecek haftanın cumartesisi). */
export function horizonDays(today: DateStr): DateStr[] {
  let end = addDays(today, 5);
  while (weekday(end) !== 6) end = addDays(end, 1);
  return weekDays(today, daysBetween(today, end) + 1);
}

/** Planlanacak iş günleri: plan ufku, pazarlar hariç (klinikler çoğunlukla kapalı). */
export function planningDays(today: DateStr): DateStr[] {
  return horizonDays(today).filter((d) => weekday(d) !== 0);
}

/** Listeye henüz girmemiş, aranabilir klinik sayısı (kaç günlük iş kaldığını göstermek için). */
export function candidatePoolSize(
  businesses: Business[],
  settings: Pick<Settings, "categories" | "districts">,
  calledIds: ReadonlySet<string>,
  openTaskIds: ReadonlySet<string>,
): number {
  const ctx = { settings, businessIdsWithOpenTask: openTaskIds, businessIdsWithCallHistory: calledIds };
  return businesses.filter((b) => !b.nextActionDate && isNewCandidate(b, ctx)).length;
}

const isSunday = (d: DateStr) => new Date(`${d}T12:00:00Z`).getUTCDay() === 0;

/** start dahil, pazar değilse kendisi, pazarsa ertesi gün. */
export function workingDayFrom(d: DateStr): DateStr {
  return isSunday(d) ? addDays(d, 1) : d;
}

export type Repack = {
  moves: { id: string; dueDate: DateStr }[];
  /** Her güne düşen yeni klinik sayısı (günlük liste kaydı için). */
  perDay: Map<DateStr, number>;
  /** Tarihi start'a çekilen takiplerin işletmeleri. */
  followUpBusinessIds: string[];
};

/**
 * "Planı yarından başlat": açık görevleri start gününden itibaren yeniden dağıtır.
 * - Yeni klinikler (günlük liste) en eski önce, her iş gününe `target` kadar (pazar atlanır).
 * - Günü geçmiş ya da start'tan önceki takipler start'a gelir; ileri tarihli takipler (müşterinin verdiği gün) yerinde kalır.
 */
export function repackFrom(
  tasks: Pick<CallTask, "id" | "kind" | "dueDate" | "createdAt" | "businessId">[],
  start: DateStr,
  target: number,
): Repack {
  const moves: Repack["moves"] = [];
  const perDay = new Map<DateStr, number>();
  const followUpBusinessIds: string[] = [];
  const first = workingDayFrom(start);

  for (const t of tasks) {
    if (t.kind === "takip" && t.dueDate < first) {
      moves.push({ id: t.id, dueDate: first });
      followUpBusinessIds.push(t.businessId);
    }
  }
  const fresh = tasks
    .filter((t) => t.kind === "yeni")
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
  let day = first;
  let n = 0;
  for (const t of fresh) {
    if (n >= target) {
      day = workingDayFrom(addDays(day, 1));
      n = 0;
    }
    if (t.dueDate !== day) moves.push({ id: t.id, dueDate: day });
    perDay.set(day, (perDay.get(day) ?? 0) + 1);
    n++;
  }
  return { moves, perDay, followUpBusinessIds };
}
