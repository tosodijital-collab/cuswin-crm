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
