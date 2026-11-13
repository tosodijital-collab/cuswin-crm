// Takip ve günlük liste kuralları. Saf fonksiyonlar: depo (demo ya da PostgreSQL) sonucu uygular.

import { normalizePhone } from "./contact-info";
import { addDays } from "./time";
import type {
  Activity,
  Business,
  CallStatus,
  CallTask,
  DateStr,
  Pause,
  SalesStage,
  Settings,
  TaskReason,
  TimeStr,
  VisitResult,
} from "./types";

export const MAX_FAILED_STREAK = 3;

/** Bu durumlardaki işletmeler hiçbir otomatik listeye girmez. */
export const CLOSED_CALL_STATUSES: ReadonlySet<CallStatus> = new Set([
  "ilgilenmiyor",
  "iletisim_kurma",
  "beklemede",
]);

export type CallOutcomeInput = {
  result: CallStatus;
  note?: string;
  stage?: SalesStage;
  nextDate?: DateStr;
  nextTime?: TimeStr;
};

export type NewTask = { reason: TaskReason; dueDate: DateStr; dueTime?: TimeStr };

export type CallOutcome = {
  patch: Partial<Business>;
  /** Mevcut açık görev her durumda kapatılır; doluysa yerine bu açılır. */
  nextTask?: NewTask;
  activities: Omit<Activity, "id" | "businessId" | "at">[];
};

export class RuleError extends Error {}

/** Arama sonucuna göre işletmenin yeni durumu, açılacak görev ve geçmiş kayıtları. */
export function decideCallOutcome(
  business: Business,
  input: CallOutcomeInput,
  today: DateStr,
): CallOutcome {
  const { result, note, stage, nextDate, nextTime } = input;

  if (nextDate && nextDate < today) {
    throw new RuleError("Sonraki arama tarihi geçmişte olamaz.");
  }
  if (result === "tekrar_aranacak" && !nextDate) {
    throw new RuleError("Tekrar aranacak için tarih seçin.");
  }

  const activities: CallOutcome["activities"] = [{ type: "arama", callResult: result, note }];
  const patch: Partial<Business> = { callStatus: result };
  let nextTask: NewTask | undefined;

  const newStage = stage ?? autoStage(business.salesStage, result);
  if (newStage !== business.salesStage) {
    patch.salesStage = newStage;
    activities.push({ type: "asama", stage: newStage });
  }

  switch (result) {
    case "ulasilamadi": {
      const streak = business.failedStreak + 1;
      patch.failedStreak = streak;
      if (streak >= MAX_FAILED_STREAK) {
        patch.callStatus = "beklemede";
        activities.push({
          type: "sistem",
          note: `${MAX_FAILED_STREAK} ardışık denemede ulaşılamadı, beklemeye alındı.`,
        });
      } else {
        nextTask = { reason: "ulasilamadi", dueDate: nextDate ?? addDays(today, 1), dueTime: nextTime };
      }
      break;
    }
    case "aranacak":
      // Manuel yeniden açma: sayaç sıfırlanır, belirtilen güne (yoksa bugüne) görev açılır.
      patch.failedStreak = 0;
      nextTask = { reason: "planlandi", dueDate: nextDate ?? today, dueTime: nextTime };
      break;
    case "tekrar_aranacak":
    case "gorusuldu":
      patch.failedStreak = 0;
      if (nextDate) nextTask = { reason: "planlandi", dueDate: nextDate, dueTime: nextTime };
      break;
    case "ilgilenmiyor":
    case "iletisim_kurma":
      patch.failedStreak = 0;
      break;
    case "beklemede":
      break;
  }

  patch.nextActionDate = nextTask?.dueDate;
  patch.nextActionTime = nextTask?.dueTime;
  return { patch, nextTask, activities };
}

export type VisitOutcomeInput = {
  result: VisitResult;
  note?: string;
  stage?: SalesStage;
  /** Doluysa bu güne "tekrar ara" görevi açılır (açık görev varsa onun yerine). */
  nextDate?: DateStr;
  nextTime?: TimeStr;
};

export type VisitOutcome = {
  patch: Partial<Business>;
  nextTask?: NewTask;
  activities: Omit<Activity, "id" | "businessId" | "at">[];
  /** Ziyaret bir randevuya bağlıysa randevu "yapıldı" sayılır mı (kapalıysa sayılmaz). */
  completesAppointment: boolean;
};

const STAGE_ORDER: SalesStage[] = [
  "yeni_aday",
  "iletisim_kuruldu",
  "randevu_alindi",
  "gorusme_yapildi",
  "teklif_gonderildi",
  "musteri_oldu",
];

/** Aşamayı yalnızca ileri taşır (ör. teklif gönderilmiş kliniği "görüşme yapıldı"ya geri çekmez). */
function advanceTo(current: SalesStage, target: SalesStage): SalesStage {
  if (current === "olumsuz") return current;
  return STAGE_ORDER.indexOf(target) > STAGE_ORDER.indexOf(current) ? target : current;
}

/**
 * Saha ziyareti sonucu. Arama kurallarından bağımsızdır: ulaşılamama sayacını artırmaz, arama sayılmaz.
 * Açık arama görevine yalnızca "tekrar ara" tarihi verildiğinde dokunulur.
 */
export function decideVisitOutcome(business: Business, input: VisitOutcomeInput, today: DateStr): VisitOutcome {
  const { result, note, stage, nextDate, nextTime } = input;
  if (nextDate && nextDate < today) throw new RuleError("Tekrar arama tarihi geçmişte olamaz.");

  const activities: VisitOutcome["activities"] = [{ type: "ziyaret", visitResult: result, note }];
  const patch: Partial<Business> = {};
  let target = business.salesStage;

  switch (result) {
    case "demo_yapildi":
    case "doktorla_gorusuldu":
      target = advanceTo(target, "gorusme_yapildi");
      patch.callStatus = "gorusuldu";
      patch.failedStreak = 0;
      break;
    case "sekreterle_gorusuldu":
      target = advanceTo(target, "iletisim_kuruldu");
      if (business.callStatus === "aranacak" || business.callStatus === "beklemede") patch.callStatus = "gorusuldu";
      break;
    case "kapali":
      break;
    case "ilgilenmiyor":
      patch.callStatus = "ilgilenmiyor";
      break;
  }

  const newStage = stage ?? target;
  if (newStage !== business.salesStage) {
    patch.salesStage = newStage;
    activities.push({ type: "asama", stage: newStage });
  }

  let nextTask: NewTask | undefined;
  if (nextDate) {
    nextTask = { reason: "planlandi", dueDate: nextDate, dueTime: nextTime };
    patch.nextActionDate = nextDate;
    patch.nextActionTime = nextTime;
  }
  return { patch, nextTask, activities, completesAppointment: result !== "kapali" };
}

const VISIT_SUMMARY: Record<VisitResult, string> = {
  demo_yapildi: "Ziyaret: doktorla görüşüldü, demo yapıldı",
  doktorla_gorusuldu: "Ziyaret: doktorla görüşüldü",
  sekreterle_gorusuldu: "Ziyaret: sekreterle görüşüldü",
  kapali: "Ziyaret: kapalıydı",
  ilgilenmiyor: "Ziyaret: ilgilenmiyor",
};

/**
 * Satış kiti: "her görüşmenin sonunda tarih koy". Ziyaret sonrası önerilen tekrar arama günü:
 * görüşme ya da sekreter → 3 gün sonra ("düşüneyim" takibi), kapalı → ertesi gün randevu için ara.
 */
export function suggestedFollowUp(result: VisitResult, today: DateStr): DateStr | undefined {
  if (result === "ilgilenmiyor") return undefined;
  return addDays(today, result === "kapali" ? 1 : 3);
}

/** Randevu sonucuna yazılan kısa metin. */
export function visitSummary(input: Pick<VisitOutcomeInput, "result" | "note">): string {
  return [VISIT_SUMMARY[input.result], input.note].filter(Boolean).join(". ");
}

/** Kullanıcı aşama seçmediyse yalnızca bariz ilerlemeyi uygula. */
function autoStage(current: SalesStage, result: CallStatus): SalesStage {
  if (current === "yeni_aday" && (result === "gorusuldu" || result === "tekrar_aranacak")) {
    return "iletisim_kuruldu";
  }
  return current;
}

/** Hatalı kayıt geri alındığında ardışık başarısızlık sayısını geçmişten yeniden hesaplar. */
export function recomputeFailedStreak(activities: Activity[]): number {
  const calls = activities
    .filter((a) => a.type === "arama" && !a.voidedAt && a.callResult)
    .sort((a, b) => b.at.localeCompare(a.at));
  let streak = 0;
  for (const a of calls) {
    if (a.callResult === "ulasilamadi") streak++;
    else if (a.callResult !== "beklemede") break;
  }
  return streak;
}

/** Günlük hedefe girmesini engelleyen veri eksikleri. Boş dizi: kayıt aranabilir. */
export function dataIssues(b: Pick<Business, "phone" | "categories">): string[] {
  const issues: string[] = [];
  if (!normalizePhone(b.phone)) issues.push("Geçerli telefon yok");
  if (b.categories.length === 0) issues.push("Kategori belirsiz");
  return issues;
}

export type CandidateContext = {
  settings: Pick<Settings, "categories" | "districts">;
  businessIdsWithOpenTask: ReadonlySet<string>;
  businessIdsWithCallHistory: ReadonlySet<string>;
};

/** Hiç aranmamış, kapatılmamış, eksiksiz ve tercihlere uyan işletme yeni aday olabilir. */
export function isNewCandidate(b: Business, ctx: CandidateContext): boolean {
  if (b.reviewReason) return false;
  if (dataIssues(b).length > 0) return false;
  if (b.callStatus !== "aranacak" || b.salesStage !== "yeni_aday") return false;
  if (ctx.businessIdsWithOpenTask.has(b.id)) return false;
  if (ctx.businessIdsWithCallHistory.has(b.id)) return false;
  if (!b.categories.some((c) => ctx.settings.categories.includes(c))) return false;
  if (ctx.settings.districts.length > 0 && (!b.district || !ctx.settings.districts.includes(b.district))) {
    return false;
  }
  return true;
}

export type DailySelection = { selected: Business[]; shortfallReason?: string };

/** Deterministik seçim: en eski bulunan önce, eşitlikte id. Aynı girdi her zaman aynı listeyi verir. */
export function selectDailyCandidates(
  businesses: Business[],
  ctx: CandidateContext,
  target: number,
): DailySelection {
  const pool = businesses
    .filter((b) => isNewCandidate(b, ctx))
    .sort((a, b) => a.foundAt.localeCompare(b.foundAt) || a.id.localeCompare(b.id));
  const selected = pool.slice(0, target);
  if (selected.length >= target) return { selected };

  const reviewCount = businesses.filter((b) => b.callStatus === "aranacak" && (b.reviewReason || dataIssues(b).length)).length;
  const parts = [`Uygun yeni aday sayısı ${selected.length}, hedef ${target}.`];
  parts.push("Tercih edilen kategori ve ilçelerde aranmamış, telefonu olan başka işletme yok.");
  if (reviewCount > 0) parts.push(`${reviewCount} kayıt eksik bilgi nedeniyle kontrol bekliyor.`);
  return { selected, shortfallReason: parts.join(" ") };
}

export type FollowUpGroups<T extends Pick<CallTask, "kind" | "reason" | "dueDate">> = {
  yeni: T[];
  dundenKalanlar: T[];
  gecikenler: T[];
  planlananlar: T[];
};

/** Açık görevleri ana ekran bölümlerine ayırır. Günü geçmiş hiçbir görev kaybolmaz. */
export function groupOpenTasks<T extends Pick<CallTask, "kind" | "reason" | "dueDate" | "dueTime">>(
  tasks: T[],
  today: DateStr,
): FollowUpGroups<T> {
  const groups: FollowUpGroups<T> = { yeni: [], dundenKalanlar: [], gecikenler: [], planlananlar: [] };
  for (const t of tasks) {
    if (t.dueDate > today) continue;
    if (t.dueDate < today) groups.gecikenler.push(t);
    else if (t.kind === "yeni") groups.yeni.push(t);
    else if (t.reason === "ulasilamadi") groups.dundenKalanlar.push(t);
    else groups.planlananlar.push(t);
  }
  const byDue = (a: T, b: T) =>
    a.dueDate.localeCompare(b.dueDate) || (a.dueTime ?? "99:99").localeCompare(b.dueTime ?? "99:99");
  groups.gecikenler.sort(byDue);
  groups.planlananlar.sort(byDue);
  return groups;
}

/** Ara verme o güne denk geliyor mu? */
export function isPausedOn(pause: Pause | undefined, date: DateStr): boolean {
  if (!pause) return false;
  if (pause.forever) return true;
  return Boolean(pause.from && pause.until && pause.from <= date && date <= pause.until);
}

export type UndoCall = {
  /** Geçersiz sayılacak kayıtlar: son arama ve aynı anda yazılan aşama değişikliği. */
  voidIds: string[];
  /** Geri alınan aramanın zamanı (görevleri eşlemek için). */
  at: string;
  callResult?: CallStatus;
  patch: Pick<Business, "callStatus" | "failedStreak"> & Partial<Pick<Business, "salesStage">>;
};

const VISIT_CALL_STATUS: Partial<Record<VisitResult, CallStatus>> = {
  demo_yapildi: "gorusuldu",
  doktorla_gorusuldu: "gorusuldu",
  sekreterle_gorusuldu: "gorusuldu",
  ilgilenmiyor: "ilgilenmiyor",
};

/**
 * "Yanlış sonuç girdim": son aramayı (ve onunla aynı anda yazılan aşama değişikliğini) geçersiz sayar,
 * işletmenin durumunu ve aşamasını o aramadan önceki haline döndürür. Geçmiş silinmez.
 */
export function decideUndoLastCall(activities: Activity[]): UndoCall {
  const live = activities.filter((a) => !a.voidedAt).sort((a, b) => b.at.localeCompare(a.at));
  const last = live.find((a) => a.type === "arama");
  if (!last) throw new RuleError("Geri alınacak arama sonucu yok.");
  const t0 = Date.parse(last.at);
  const batch = live.filter((a) => a.type === "asama" && Math.abs(Date.parse(a.at) - t0) < 5_000);
  const voidIds = [last.id, ...batch.map((a) => a.id)];
  const rest = live.filter((a) => !voidIds.includes(a.id));
  const before = rest.filter((a) => Date.parse(a.at) < t0);

  let callStatus: CallStatus = "aranacak";
  for (const a of before) {
    if (a.type === "arama" && a.callResult) {
      callStatus = a.callResult;
      break;
    }
    const fromVisit = a.type === "ziyaret" && a.visitResult ? VISIT_CALL_STATUS[a.visitResult] : undefined;
    if (fromVisit) {
      callStatus = fromVisit;
      break;
    }
  }
  const patch: UndoCall["patch"] = { callStatus, failedStreak: recomputeFailedStreak(rest) };
  if (batch.length) patch.salesStage = before.find((a) => a.type === "asama" && a.stage)?.stage ?? "yeni_aday";
  return { voidIds, at: last.at, callResult: last.callResult, patch };
}

/** Geri alma geçmişte görünsün. */
export function undoNote(result: CallStatus | undefined): string {
  const labels: Partial<Record<CallStatus, string>> = {
    ulasilamadi: "Ulaşılamadı",
    tekrar_aranacak: "Tekrar aranacak",
    gorusuldu: "Görüşüldü",
    ilgilenmiyor: "İlgilenmiyor",
    iletisim_kurma: "Tekrar iletişim kurma",
    beklemede: "Beklemeye alındı",
  };
  return `Yanlış girilen sonuç geri alındı${result && labels[result] ? ` (${labels[result]})` : ""}. Klinik tekrar aranacaklarda.`;
}
