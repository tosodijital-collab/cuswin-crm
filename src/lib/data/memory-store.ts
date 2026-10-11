// Bellek içi depo. "demo" modunda uydurma kayıtlarla başlar ve kalıcı değildir.
// "yerel" modunda boş başlar, gerçek taranan kayıtları yerel bir JSON dosyasına yazar (yalnızca yerel test için;
// kalıcı veritabanı PostgreSQL aşamasında gelecek).

import "server-only";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { normalizePhone, normalizeWebsite } from "@/lib/domain/contact-info";
import { decideImport } from "@/lib/domain/places";
import { isCalendarConfigured } from "@/lib/integrations/google-calendar";
import { scraperBin } from "@/lib/integrations/maps-scraper";
import {
  dataIssues,
  decideCallOutcome,
  groupOpenTasks,
  recomputeFailedStreak,
  RuleError,
  selectDailyCandidates,
  type CallOutcomeInput,
} from "@/lib/domain/rules";
import { addDays, istanbulToUtc, toDateStr } from "@/lib/domain/time";
import type {
  Activity,
  Appointment,
  Business,
  CalendarSync,
  CallTask,
  DailyRun,
  DateStr,
  ImportResult,
  PlaceInput,
  SalesStage,
  ScanRun,
  Settings,
} from "@/lib/domain/types";
import { buildDemoBusinesses } from "./demo-seed";
import type {
  AppointmentInput,
  AppointmentView,
  BusinessDetail,
  BusinessFilters,
  BusinessInput,
  CrmRepository,
  DailyRunResult,
  EditableSettings,
  HomeData,
  TaskView,
} from "./repository";

type State = {
  businesses: Map<string, Business>;
  tasks: CallTask[];
  activities: Activity[];
  appointments: Appointment[];
  runs: DailyRun[];
  settings: EditableSettings;
  scans: ScanRun[];
  scanCursor: number;
};

const DEFAULT_SETTINGS: EditableSettings = {
  dailyTarget: 20,
  categories: ["estetik", "dis", "sac_sagligi", "sac_ekim"],
  districts: [],
  reminderMinutes: 30,
  scanLimit: 20,
};

const id = () => crypto.randomUUID();
const nowIso = () => new Date().toISOString();
const today = () => toDateStr(new Date());

function trLower(s: string) {
  return s.toLocaleLowerCase("tr-TR");
}

class MemoryRepository implements CrmRepository {
  private s: State;

  constructor(
    readonly mode: "demo" | "yerel",
    private readonly file?: string,
  ) {
    this.s = mode === "demo" ? seed() : load(file);
  }

  /** Yerel modda durumu dosyaya atomik olarak yazar. */
  save() {
    if (this.mode !== "yerel" || !this.file) return;
    mkdirSync(path.dirname(this.file), { recursive: true });
    const tmp = `${this.file}.tmp`;
    writeFileSync(tmp, JSON.stringify({ ...this.s, businesses: [...this.s.businesses.values()] }), "utf8");
    renameSync(tmp, this.file);
  }

  // ---------- okuma ----------

  async getHome(): Promise<HomeData> {
    const t = today();
    const open = this.s.tasks.filter((x) => x.status === "acik");
    const groups = groupOpenTasks(open, t);
    const view = (task: CallTask): TaskView => ({
      task,
      business: this.mustBusiness(task.businessId),
      lastCall: this.lastCall(task.businessId),
    });
    const todaysNew = this.s.tasks.filter((x) => x.kind === "yeni" && x.dueDate === t && x.status !== "iptal");
    const appointmentsToday = this.s.appointments
      .filter((a) => a.status === "planlandi" && toDateStr(new Date(a.startsAt)) === t)
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
      .map((appointment) => ({ appointment, business: this.mustBusiness(appointment.businessId) }));

    return {
      today: t,
      run: this.s.runs.find((r) => r.date === t),
      newTasks: groups.yeni.map(view),
      dundenKalanlar: groups.dundenKalanlar.map(view),
      gecikenler: groups.gecikenler.map(view),
      planlananlar: groups.planlananlar.map(view),
      appointmentsToday,
      counts: {
        newRemaining: groups.yeni.length,
        newTotal: todaysNew.length,
        callsToday: this.s.activities.filter(
          (a) => a.type === "arama" && !a.voidedAt && toDateStr(new Date(a.at)) === t,
        ).length,
        openFollowUps: groups.dundenKalanlar.length + groups.gecikenler.length + groups.planlananlar.length,
        appointmentsToday: appointmentsToday.length,
        customers: [...this.s.businesses.values()].filter((b) => b.salesStage === "musteri_oldu").length,
      },
    };
  }

  async getBusiness(businessId: string): Promise<BusinessDetail | undefined> {
    const business = this.s.businesses.get(businessId);
    if (!business) return undefined;
    return {
      business,
      openTask: this.openTask(businessId),
      activities: this.s.activities
        .filter((a) => a.businessId === businessId)
        .sort((a, b) => b.at.localeCompare(a.at)),
      appointments: this.s.appointments
        .filter((a) => a.businessId === businessId)
        .sort((a, b) => b.startsAt.localeCompare(a.startsAt)),
    };
  }

  async listBusinesses(f: BusinessFilters): Promise<Business[]> {
    const q = f.q ? trLower(f.q.trim()) : "";
    const qDigits = f.q?.replace(/\D/g, "") ?? "";
    return [...this.s.businesses.values()]
      .filter((b) => {
        if (q) {
          const hay = trLower([b.name, b.address, b.district, b.email, b.website, ...b.contacts.map((c) => c.name)].join(" "));
          const phoneHit = qDigits.length >= 4 && (b.phone ?? "").replace(/\D/g, "").includes(qDigits);
          if (!hay.includes(q) && !phoneHit) return false;
        }
        if (f.category && !b.categories.includes(f.category)) return false;
        if (f.district && b.district !== f.district) return false;
        if (f.callStatus && b.callStatus !== f.callStatus) return false;
        if (f.salesStage && b.salesStage !== f.salesStage) return false;
        if (f.source && b.source !== f.source) return false;
        if (f.needsReview && !b.reviewReason) return false;
        return true;
      })
      .sort((a, b) => a.name.localeCompare(b.name, "tr"));
  }

  async listDistricts(): Promise<string[]> {
    const set = new Set<string>();
    for (const b of this.s.businesses.values()) if (b.district) set.add(b.district);
    return [...set].sort((a, b) => a.localeCompare(b, "tr"));
  }

  // ---------- arama ve satış ----------

  async recordCall(businessId: string, input: CallOutcomeInput): Promise<void> {
    const b = this.mustBusiness(businessId);
    const t = today();
    const outcome = decideCallOutcome(b, input, t);
    const at = nowIso();

    this.closeOpenTask(businessId, at);
    Object.assign(b, outcome.patch);
    for (const a of outcome.activities) this.s.activities.push({ ...a, id: id(), businessId, at });
    if (outcome.nextTask) {
      this.s.tasks.push({ id: id(), businessId, kind: "takip", status: "acik", createdAt: at, ...outcome.nextTask });
    }
  }

  async setSalesStage(businessId: string, stage: SalesStage, note?: string): Promise<void> {
    const b = this.mustBusiness(businessId);
    if (b.salesStage === stage && !note) return;
    b.salesStage = stage;
    this.s.activities.push({ id: id(), businessId, at: nowIso(), type: "asama", stage, note });
  }

  async addNote(businessId: string, note: string): Promise<void> {
    this.mustBusiness(businessId);
    this.s.activities.push({ id: id(), businessId, at: nowIso(), type: "not", note });
  }

  async voidActivity(businessId: string, activityId: string): Promise<void> {
    const b = this.mustBusiness(businessId);
    const a = this.s.activities.find((x) => x.id === activityId && x.businessId === businessId);
    if (!a || a.voidedAt) return;
    a.voidedAt = nowIso();
    b.failedStreak = recomputeFailedStreak(this.s.activities.filter((x) => x.businessId === businessId));
    this.s.activities.push({
      id: id(),
      businessId,
      at: nowIso(),
      type: "duzeltme",
      note: "Bir kayıt hatalı olarak işaretlendi. Durum gerekirse elle düzeltilmeli.",
    });
  }

  // ---------- işletme ----------

  async createBusiness(input: BusinessInput): Promise<string> {
    this.assertNoDuplicate(input);
    const newId = id();
    const at = nowIso();
    this.s.businesses.set(newId, {
      id: newId,
      ...this.cleanInput(input),
      source: "manuel",
      foundAt: at,
      verifiedAt: at,
      callStatus: "aranacak",
      salesStage: "yeni_aday",
      failedStreak: 0,
    });
    this.s.activities.push({ id: id(), businessId: newId, at, type: "sistem", note: "Manuel olarak eklendi." });
    return newId;
  }

  async updateBusiness(businessId: string, input: BusinessInput): Promise<void> {
    const b = this.mustBusiness(businessId);
    this.assertNoDuplicate(input, businessId);
    Object.assign(b, this.cleanInput(input), { verifiedAt: nowIso() });
    this.s.activities.push({ id: id(), businessId, at: nowIso(), type: "duzeltme", note: "İşletme bilgileri düzenlendi." });
  }

  // ---------- randevu ----------

  async listAppointments(): Promise<AppointmentView[]> {
    return this.s.appointments
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
      .map((appointment) => ({ appointment, business: this.mustBusiness(appointment.businessId) }));
  }

  async getAppointment(appointmentId: string): Promise<AppointmentView | undefined> {
    const appointment = this.s.appointments.find((a) => a.id === appointmentId);
    return appointment && { appointment, business: this.mustBusiness(appointment.businessId) };
  }

  async setCalendarSync(appointmentId: string, sync: CalendarSync): Promise<void> {
    this.mustAppointment(appointmentId).calendar = sync;
  }

  async createAppointment(businessId: string, input: AppointmentInput): Promise<string> {
    const b = this.mustBusiness(businessId);
    const appointmentId = id();
    this.s.appointments.push({ id: appointmentId, businessId, status: "planlandi", ...input });
    if (b.salesStage === "yeni_aday" || b.salesStage === "iletisim_kuruldu") {
      b.salesStage = "randevu_alindi";
      this.s.activities.push({ id: id(), businessId, at: nowIso(), type: "asama", stage: "randevu_alindi" });
    }
    this.s.activities.push({ id: id(), businessId, at: nowIso(), type: "randevu", note: describeAppointment(input) });
    return appointmentId;
  }

  async updateAppointment(appointmentId: string, input: AppointmentInput): Promise<void> {
    const a = this.mustAppointment(appointmentId);
    if (a.status !== "planlandi") throw new RuleError("Yalnızca planlanmış randevu değiştirilebilir.");
    Object.assign(a, input);
    this.s.activities.push({
      id: id(),
      businessId: a.businessId,
      at: nowIso(),
      type: "randevu",
      note: `Randevu değiştirildi: ${describeAppointment(input)}`,
    });
  }

  async cancelAppointment(appointmentId: string): Promise<void> {
    const a = this.mustAppointment(appointmentId);
    if (a.status !== "planlandi") return;
    a.status = "iptal";
    this.s.activities.push({ id: id(), businessId: a.businessId, at: nowIso(), type: "randevu", note: "Randevu iptal edildi." });
  }

  async completeAppointment(appointmentId: string, outcome: string): Promise<void> {
    const a = this.mustAppointment(appointmentId);
    a.status = "yapildi";
    a.outcome = outcome;
    const b = this.mustBusiness(a.businessId);
    if (b.salesStage === "randevu_alindi") {
      b.salesStage = "gorusme_yapildi";
      this.s.activities.push({ id: id(), businessId: b.id, at: nowIso(), type: "asama", stage: "gorusme_yapildi" });
    }
    this.s.activities.push({ id: id(), businessId: b.id, at: nowIso(), type: "randevu", note: `Görüşme yapıldı: ${outcome}` });
  }

  // ---------- ayarlar ve otomasyon ----------

  async getSettings(): Promise<Settings> {
    return {
      ...DEFAULT_SETTINGS,
      ...this.s.settings,
      notificationsConfigured: Boolean(process.env.NTFY_URL && process.env.NTFY_TOPIC),
      calendarConfigured: isCalendarConfigured(),
      scannerConfigured: Boolean(scraperBin()),
    };
  }

  async updateSettings(input: EditableSettings): Promise<void> {
    Object.assign(this.s.settings, input);
  }

  async listRuns(limit: number): Promise<DailyRun[]> {
    return [...this.s.runs].sort((a, b) => b.date.localeCompare(a.date)).slice(0, limit);
  }

  async runDailyList(trigger: DailyRun["trigger"]): Promise<DailyRunResult> {
    const t = today();
    const existing = this.s.runs.find((r) => r.date === t);
    if (!existing) {
      const run = createDailyList(this.s, t, trigger);
      return { run, created: true, added: run.selected };
    }
    // Aynı gün yeni liste açılmaz; yalnızca hedefin altında kalmış gün, yeni adaylar geldiyse tamamlanır.
    if (existing.selected >= existing.target) return { run: existing, created: false, added: 0 };
    const added = topUpDailyList(this.s, existing);
    return { run: existing, created: false, added };
  }

  // ---------- tarama ----------

  async importPlaces(places: PlaceInput[], maxNew: number): Promise<ImportResult> {
    const result: ImportResult = { added: 0, updated: 0, flagged: 0, skipped: 0, overLimit: 0 };
    const at = nowIso();
    for (const place of places) {
      const existing = [...this.s.businesses.values()];
      const decision = decideImport(existing, place);
      if (decision.kind === "update") {
        // Yalnızca iletişim bilgileri tazelenir; durum, notlar ve geçmiş korunur.
        const b = this.mustBusiness(decision.businessId);
        Object.assign(b, {
          name: place.name,
          phone: place.phone ?? b.phone,
          website: place.website ?? b.website,
          email: place.email ?? b.email,
          address: place.address ?? b.address,
          district: place.district ?? b.district,
          mapsUrl: place.mapsUrl ?? b.mapsUrl,
          // Kategoriyi kullanıcı elle düzenlemediyse kaynaktan tazele.
          categories: this.editedByUser(b.id) || !place.categories.length ? b.categories : place.categories,
          verifiedAt: at,
        });
        result.updated++;
        continue;
      }
      if (result.added >= maxNew) {
        result.overLimit++;
        continue;
      }
      const issues = dataIssues(place);
      const reviewReason = [decision.reviewReason, ...issues].filter(Boolean).join(", ") || undefined;
      const newId = id();
      this.s.businesses.set(newId, {
        id: newId,
        ...place,
        contacts: [],
        foundAt: at,
        verifiedAt: at,
        callStatus: "aranacak",
        salesStage: "yeni_aday",
        failedStreak: 0,
        reviewReason,
      });
      result.added++;
      if (reviewReason) result.flagged++;
    }
    return result;
  }

  async saveScan(scan: ScanRun): Promise<void> {
    const i = this.s.scans.findIndex((x) => x.id === scan.id);
    if (i >= 0) this.s.scans[i] = { ...scan };
    else this.s.scans.push({ ...scan });
  }

  async listScans(limit: number): Promise<ScanRun[]> {
    return [...this.s.scans].sort((a, b) => b.startedAt.localeCompare(a.startedAt)).slice(0, limit);
  }

  async getScanCursor(): Promise<number> {
    return this.s.scanCursor;
  }

  async setScanCursor(cursor: number): Promise<void> {
    this.s.scanCursor = cursor;
  }

  // ---------- yardımcılar ----------

  private mustBusiness(businessId: string): Business {
    const b = this.s.businesses.get(businessId);
    if (!b) throw new RuleError("İşletme bulunamadı.");
    return b;
  }

  private editedByUser(businessId: string) {
    return this.s.activities.some((a) => a.businessId === businessId && a.type === "duzeltme" && a.note === "İşletme bilgileri düzenlendi.");
  }

  private mustAppointment(appointmentId: string): Appointment {
    const a = this.s.appointments.find((x) => x.id === appointmentId);
    if (!a) throw new RuleError("Randevu bulunamadı.");
    return a;
  }

  private openTask(businessId: string) {
    return this.s.tasks.find((x) => x.businessId === businessId && x.status === "acik");
  }

  private closeOpenTask(businessId: string, at: string) {
    for (const x of this.s.tasks) {
      if (x.businessId === businessId && x.status === "acik") {
        x.status = "tamamlandi";
        x.closedAt = at;
      }
    }
  }

  private lastCall(businessId: string) {
    return this.s.activities
      .filter((a) => a.businessId === businessId && a.type === "arama" && !a.voidedAt)
      .sort((a, b) => b.at.localeCompare(a.at))[0];
  }

  private cleanInput(input: BusinessInput) {
    const issues = dataIssues(input);
    return {
      name: input.name.trim(),
      categories: input.categories,
      phone: input.phone?.trim() || undefined,
      email: input.email?.trim() || undefined,
      website: input.website?.trim() || undefined,
      district: input.district || undefined,
      address: input.address?.trim() || undefined,
      contacts: input.contacts.map((c) => ({ id: id(), name: c.name.trim(), role: c.role?.trim() || undefined })),
      reviewReason: issues.length ? issues.join(", ") : undefined,
    };
  }

  /** Telefon veya web sitesi başka bir kayıtla aynıysa kaydı engelle (isim benzerliği tek başına yeterli değil). */
  private assertNoDuplicate(input: BusinessInput, selfId?: string) {
    const phone = normalizePhone(input.phone);
    const site = normalizeWebsite(input.website);
    for (const b of this.s.businesses.values()) {
      if (b.id === selfId) continue;
      if (phone && normalizePhone(b.phone) === phone) {
        throw new RuleError(`Bu telefon zaten kayıtlı: ${b.name}`);
      }
      if (site && normalizeWebsite(b.website) === site) {
        throw new RuleError(`Bu web sitesi zaten kayıtlı: ${b.name}`);
      }
    }
  }
}

function describeAppointment(input: AppointmentInput) {
  const when = new Intl.DateTimeFormat("tr-TR", {
    timeZone: "Europe/Istanbul",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(input.startsAt));
  return [when, input.contactName].filter(Boolean).join(", ");
}

function pickCandidates(s: State, target: number) {
  const open = new Set(s.tasks.filter((x) => x.status === "acik").map((x) => x.businessId));
  const listedEver = new Set(s.tasks.filter((x) => x.kind === "yeni").map((x) => x.businessId));
  const called = new Set(s.activities.filter((a) => a.type === "arama").map((a) => a.businessId));
  return selectDailyCandidates([...s.businesses.values()], {
    settings: s.settings,
    businessIdsWithOpenTask: open,
    // Daha önce bir günlük listeye girmiş işletme tekrar "yeni aday" sayılmaz.
    businessIdsWithCallHistory: new Set([...called, ...listedEver]),
  }, target);
}

/** Hedefin altında kalmış güne, gelen yeni adaylarla eksik kadar ekler. Kopya oluşmaz. */
function topUpDailyList(s: State, run: DailyRun): number {
  const { selected, shortfallReason } = pickCandidates(s, run.target - run.selected);
  const at = nowIso();
  for (const b of selected) {
    s.tasks.push({ id: id(), businessId: b.id, kind: "yeni", reason: "gunluk_liste", dueDate: run.date, status: "acik", createdAt: at });
  }
  run.selected += selected.length;
  run.finishedAt = at;
  run.shortfallReason = run.selected >= run.target ? undefined : shortfallReason?.replace(/Uygun yeni aday sayısı \d+/, `Listede ${run.selected} işletme var`);
  return selected.length;
}

function createDailyList(s: State, date: DateStr, trigger: DailyRun["trigger"], at = new Date()): DailyRun {
  const { selected, shortfallReason } = pickCandidates(s, s.settings.dailyTarget);
  const startedAt = at.toISOString();
  for (const b of selected) {
    s.tasks.push({ id: id(), businessId: b.id, kind: "yeni", reason: "gunluk_liste", dueDate: date, status: "acik", createdAt: startedAt });
  }
  const run: DailyRun = {
    date,
    startedAt,
    finishedAt: startedAt,
    target: s.settings.dailyTarget,
    selected: selected.length,
    shortfallReason,
    trigger,
  };
  s.runs.push(run);
  return run;
}

/** Demo geçmişi: bugüne göre dünden kalanlar, gecikenler, planlananlar ve randevular üretir. */
function seed(): State {
  const t = today();
  const businesses = buildDemoBusinesses(t);
  for (const b of businesses) {
    const issues = dataIssues(b);
    if (!b.reviewReason && issues.length) b.reviewReason = issues.join(", ");
  }
  const s: State = {
    businesses: new Map(businesses.map((b) => [b.id, b])),
    tasks: [],
    activities: [],
    appointments: [],
    runs: [],
    settings: { ...DEFAULT_SETTINGS },
    scans: [],
    scanCursor: 0,
  };
  const at = (date: DateStr, time: string) => istanbulToUtc(date, time).toISOString();
  const b = (n: number) => s.businesses.get(`demo-${String(n).padStart(2, "0")}`)!;
  const call = (n: number, date: DateStr, time: string, result: Activity["callResult"], note?: string) =>
    s.activities.push({ id: id(), businessId: b(n).id, at: at(date, time), type: "arama", callResult: result, note });
  const task = (n: number, kind: CallTask["kind"], reason: CallTask["reason"], dueDate: DateStr, dueTime?: string) =>
    s.tasks.push({ id: id(), businessId: b(n).id, kind, reason, dueDate, dueTime, status: "acik", createdAt: at(addDays(dueDate, -1), "09:00") });
  const y = addDays(t, -1);
  const d2 = addDays(t, -2);
  const d5 = addDays(t, -5);

  // 2 gün önceki listeden hiç aranmamış iki kayıt → gecikenler
  s.runs.push({ date: d2, startedAt: at(d2, "08:30"), finishedAt: at(d2, "08:31"), target: 20, selected: 20, trigger: "zamanlanmis" });
  task(27, "yeni", "gunluk_liste", d2);
  task(28, "yeni", "gunluk_liste", d2);

  // Dün ulaşılamayanlar → dünden kalanlar (biri 2. kez)
  s.runs.push({ date: y, startedAt: at(y, "08:30"), finishedAt: at(y, "08:31"), target: 20, selected: 20, trigger: "zamanlanmis" });
  call(29, y, "10:12", "ulasilamadi");
  Object.assign(b(29), { callStatus: "ulasilamadi", failedStreak: 1, nextActionDate: t });
  task(29, "takip", "ulasilamadi", t);
  call(30, d2, "11:40", "ulasilamadi");
  call(30, y, "14:05", "ulasilamadi", "Sekreter doktorun ameliyatta olduğunu söyledi, sonra hat meşguldü.");
  Object.assign(b(30), { callStatus: "ulasilamadi", failedStreak: 2, nextActionDate: t });
  task(30, "takip", "ulasilamadi", t);

  // Bugüne planlanan geri aramalar
  call(31, d5, "15:20", "tekrar_aranacak", "Dr. Bey bugün müsait, öğleden sonra aranmak istedi.");
  Object.assign(b(31), { callStatus: "tekrar_aranacak", salesStage: "iletisim_kuruldu", nextActionDate: t, nextActionTime: "14:00" });
  b(31).contacts = [
    { id: id(), name: "Dr. Demo Kaya", role: "Klinik sahibi" },
    { id: id(), name: "Dr. Demo Arslan", role: "Diş hekimi" },
  ];
  task(31, "takip", "planlandi", t, "14:00");
  call(32, y, "16:45", "gorusuldu", "Teklif istendi, fiyatları görmek istiyor.");
  Object.assign(b(32), { callStatus: "gorusuldu", salesStage: "teklif_gonderildi", nextActionDate: t, nextActionTime: "11:00" });
  task(32, "takip", "planlandi", t, "11:00");

  // İleri tarihli planlı arama (bugünkü listede görünmez)
  call(33, y, "12:10", "tekrar_aranacak", "Cuma günü aranmak istiyor.");
  const friday = nextWeekday(t, 5);
  Object.assign(b(33), { callStatus: "tekrar_aranacak", salesStage: "iletisim_kuruldu", nextActionDate: friday });
  task(33, "takip", "planlandi", friday);

  // Sonuçlanmış kayıtlar
  call(34, d5, "10:00", "gorusuldu", "Sözleşme imzalandı.");
  Object.assign(b(34), { callStatus: "gorusuldu", salesStage: "musteri_oldu" });
  call(35, d5, "13:30", "ilgilenmiyor", "Mevcut sistemlerinden memnunlar.");
  Object.assign(b(35), { callStatus: "ilgilenmiyor", salesStage: "olumsuz" });
  call(36, d5, "09:50", "iletisim_kurma", "Tekrar aranmak istemediğini açıkça belirtti.");
  Object.assign(b(36), { callStatus: "iletisim_kurma", salesStage: "olumsuz" });

  // Randevular: bugün iki, yarın bir, dün sonuç bekleyen bir
  const appt = (n: number, date: DateStr, time: string, a: Partial<Appointment>) => {
    s.appointments.push({ id: id(), businessId: b(n).id, startsAt: at(date, time), meetingType: "yuz_yuze", status: "planlandi", reminderMinutes: 30, ...a });
    Object.assign(b(n), { callStatus: "gorusuldu", salesStage: "randevu_alindi" });
    call(n, d5, "11:15", "gorusuldu", "Tanıtım randevusu alındı.");
  };
  appt(37, t, "10:30", { contactName: "Dr. Demo Yıldız", meetingType: "yuz_yuze", location: "Demo Cad. No:37, Yenimahalle" });
  appt(38, t, "16:00", { contactName: "Demo Klinik Müdürü", meetingType: "cevrimici", location: "https://meet.example/demo" });
  appt(32, addDays(t, 1), "11:00", { contactName: "Dr. Demo Şahin", meetingType: "telefon", reminderMinutes: 15 });
  appt(31, y, "15:00", { contactName: "Dr. Demo Kaya", meetingType: "yuz_yuze", location: "Klinik" });
  b(32).salesStage = "teklif_gonderildi";
  b(31).salesStage = "randevu_alindi";

  // Bugünün listesi: gerçek seçim kuralıyla
  const notAfterNow = (d: Date) => new Date(Math.min(d.getTime(), Date.now()));
  createDailyList(s, t, "zamanlanmis", notAfterNow(istanbulToUtc(t, "08:30")));
  // Bugün iki kayıt aranmış gibi
  const todays = s.tasks.filter((x) => x.kind === "yeni" && x.dueDate === t);
  for (const [i, x] of todays.slice(0, 2).entries()) {
    x.status = "tamamlandi";
    x.closedAt = notAfterNow(istanbulToUtc(t, `09:1${i}`)).toISOString();
    s.activities.push({ id: id(), businessId: x.businessId, at: x.closedAt, type: "arama", callResult: "ulasilamadi" });
    const biz = s.businesses.get(x.businessId)!;
    Object.assign(biz, { callStatus: "ulasilamadi", failedStreak: 1, nextActionDate: addDays(t, 1) });
    s.tasks.push({ id: id(), businessId: biz.id, kind: "takip", reason: "ulasilamadi", dueDate: addDays(t, 1), status: "acik", createdAt: x.closedAt });
  }
  return s;
}

/** Bugünden sonraki ilk verilen gün (1=Pazartesi … 5=Cuma). */
function nextWeekday(from: DateStr, weekday: number): DateStr {
  for (let i = 1; i <= 7; i++) {
    const d = addDays(from, i);
    const wd = new Date(`${d}T12:00:00Z`).getUTCDay();
    if (wd === weekday) return d;
  }
  return addDays(from, 7);
}

function emptyState(): State {
  return { businesses: new Map(), tasks: [], activities: [], appointments: [], runs: [], settings: { ...DEFAULT_SETTINGS }, scans: [], scanCursor: 0 };
}

function load(file?: string): State {
  if (!file || !existsSync(file)) return emptyState();
  const raw = JSON.parse(readFileSync(file, "utf8")) as Omit<State, "businesses"> & { businesses: Business[] };
  return {
    ...emptyState(),
    ...raw,
    settings: { ...DEFAULT_SETTINGS, ...raw.settings },
    businesses: new Map(raw.businesses.map((b) => [b.id, b])),
  };
}

const MUTATING = new Set<PropertyKey>([
  "recordCall", "setSalesStage", "addNote", "voidActivity", "createBusiness", "updateBusiness",
  "createAppointment", "setCalendarSync", "updateAppointment", "cancelAppointment", "completeAppointment",
  "updateSettings", "runDailyList", "importPlaces", "saveScan", "setScanCursor",
]);

/** Değişiklik yapan her çağrıdan sonra yerel dosyaya yazar. */
function withPersistence(repo: MemoryRepository): MemoryRepository {
  return new Proxy(repo, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (typeof value !== "function") return value;
      if (!MUTATING.has(prop)) return value.bind(target);
      return async (...args: unknown[]) => {
        const out = await value.apply(target, args);
        target.save();
        return out;
      };
    },
  });
}

const globalForRepo = globalThis as unknown as { __cuswinRepo?: MemoryRepository };

export function getMemoryRepository(): MemoryRepository {
  if (!globalForRepo.__cuswinRepo) {
    const mode = process.env.DATA_MODE === "yerel" ? "yerel" : "demo";
    const file = path.resolve(/*turbopackIgnore: true*/ process.env.DATA_FILE ?? ".data/yerel.json");
    globalForRepo.__cuswinRepo = withPersistence(new MemoryRepository(mode, mode === "yerel" ? file : undefined));
  }
  return globalForRepo.__cuswinRepo;
}
