// Supabase (PostgreSQL) deposu. Tarayıcıda oturum açmış kullanıcıyla (RLS), zamanlanmış işlerde secret key ile çalışır.
// Kurallar src/lib/domain içinde hesaplanır; çok adımlı değişiklikler veritabanı fonksiyonlarıyla tek işlemde uygulanır.

import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizePhone, normalizeWebsite } from "@/lib/domain/contact-info";
import { decideImport } from "@/lib/domain/places";
import {
  dataIssues,
  decideCallOutcome,
  recomputeFailedStreak,
  RuleError,
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
  ImportResult,
  PlaceInput,
  SalesStage,
  ScanRun,
  Settings,
} from "@/lib/domain/types";
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
  Integrations,
  TaskView,
} from "./repository";

type Row = Record<string, unknown>;
const str = (v: unknown) => (v === null || v === undefined ? undefined : String(v));

// ---------- satır ↔ alan modeli ----------

export function toBusiness(r: Row): Business {
  return {
    id: String(r.id),
    name: String(r.name),
    categories: (r.categories as Business["categories"]) ?? [],
    phone: str(r.phone),
    email: str(r.email),
    website: str(r.website),
    district: str(r.district),
    address: str(r.address),
    mapsUrl: str(r.maps_url),
    source: r.source as Business["source"],
    sourceId: str(r.source_id),
    foundAt: String(r.found_at),
    verifiedAt: str(r.verified_at),
    contacts: (r.contacts as Business["contacts"]) ?? [],
    callStatus: r.call_status as Business["callStatus"],
    salesStage: r.sales_stage as Business["salesStage"],
    failedStreak: Number(r.failed_streak ?? 0),
    reviewReason: str(r.review_reason),
    nextActionDate: str(r.next_action_date),
    nextActionTime: str(r.next_action_time),
  };
}

function toTask(r: Row): CallTask {
  return {
    id: String(r.id),
    businessId: String(r.business_id),
    kind: r.kind as CallTask["kind"],
    reason: r.reason as CallTask["reason"],
    dueDate: String(r.due_date),
    dueTime: str(r.due_time),
    status: r.status as CallTask["status"],
    createdAt: String(r.created_at),
    closedAt: str(r.closed_at),
  };
}

function toActivity(r: Row): Activity {
  return {
    id: String(r.id),
    businessId: String(r.business_id),
    at: String(r.at),
    type: r.type as Activity["type"],
    callResult: str(r.call_result) as Activity["callResult"],
    stage: str(r.stage) as Activity["stage"],
    note: str(r.note),
    voidedAt: str(r.voided_at),
  };
}

export function toAppointment(r: Row): Appointment {
  const calendarStatus = str(r.calendar_status) as CalendarSync["status"] | undefined;
  return {
    id: String(r.id),
    businessId: String(r.business_id),
    startsAt: String(r.starts_at),
    contactName: str(r.contact_name),
    meetingType: r.meeting_type as Appointment["meetingType"],
    location: str(r.location),
    note: str(r.note),
    status: r.status as Appointment["status"],
    reminderMinutes: Number(r.reminder_minutes),
    outcome: str(r.outcome),
    calendar: r.calendar_dirty
      ? { status: "bekliyor", at: "" }
      : calendarStatus
        ? { status: calendarStatus, at: String(r.calendar_synced_at ?? ""), error: str(r.calendar_error) }
        : undefined,
  };
}

function toRun(r: Row): DailyRun {
  return {
    date: String(r.date),
    startedAt: String(r.started_at),
    finishedAt: str(r.finished_at),
    target: Number(r.target),
    selected: Number(r.selected),
    shortfallReason: str(r.shortfall_reason),
    error: str(r.error),
    trigger: r.trigger as DailyRun["trigger"],
  };
}

function toScan(r: Row): ScanRun {
  return {
    id: String(r.id),
    startedAt: String(r.started_at),
    finishedAt: str(r.finished_at),
    status: r.status as ScanRun["status"],
    limit: Number(r.limit),
    queries: (r.queries as string[]) ?? [],
    found: Number(r.found),
    added: Number(r.added),
    updated: Number(r.updated),
    flagged: Number(r.flagged),
    skipped: Number(r.skipped),
    overLimit: Number(r.over_limit),
    note: str(r.note),
    error: str(r.error),
  };
}

function businessColumns(input: BusinessInput) {
  const issues = dataIssues(input);
  return {
    name: input.name.trim(),
    categories: input.categories,
    phone: input.phone?.trim() || null,
    email: input.email?.trim() || null,
    website: input.website?.trim() || null,
    district: input.district || null,
    address: input.address?.trim() || null,
    contacts: input.contacts.map((c) => ({ id: crypto.randomUUID(), name: c.name.trim(), role: c.role?.trim() || undefined })),
    review_reason: issues.length ? issues.join(", ") : null,
  };
}

const startOfDayUtc = (date: string) => istanbulToUtc(date, "00:00").toISOString();

export class SupabaseRepository implements CrmRepository {
  readonly mode = "yerel" as const;

  constructor(private readonly db: SupabaseClient) {}

  private async q<T>(p: PromiseLike<{ data: T | null; error: { message: string } | null }>): Promise<T> {
    const { data, error } = await p;
    if (error) throw new Error(`Veritabanı hatası: ${error.message}`);
    return data as T;
  }

  // ---------- okuma ----------

  async getHome(): Promise<HomeData> {
    const today = toDateStr(new Date());
    const dayStart = startOfDayUtc(today);
    const dayEnd = startOfDayUtc(addDays(today, 1));

    const [openRows, newTotalRes, apptRows, callsRes, customersRes, runRows] = await Promise.all([
      this.q(this.db.from("call_tasks").select("*, business:businesses(*)").eq("status", "acik").lte("due_date", today)),
      this.db.from("call_tasks").select("id", { count: "exact", head: true }).eq("kind", "yeni").eq("due_date", today).neq("status", "iptal"),
      this.q(this.db.from("appointments").select("*, business:businesses(*)").eq("status", "planlandi").gte("starts_at", dayStart).lt("starts_at", dayEnd).order("starts_at")),
      this.db.from("activities").select("id", { count: "exact", head: true }).eq("type", "arama").is("voided_at", null).gte("at", dayStart),
      this.db.from("businesses").select("id", { count: "exact", head: true }).eq("sales_stage", "musteri_oldu"),
      this.q(this.db.from("daily_runs").select("*").eq("date", today)),
    ]);

    const tasks = (openRows as Row[]).map((r) => ({ task: toTask(r), business: toBusiness(r.business as Row) }));
    const lastCalls = await this.lastCalls(tasks.map((t) => t.business.id));
    const views: TaskView[] = tasks.map((t) => ({ ...t, lastCall: lastCalls.get(t.business.id) }));

    const byDue = (a: TaskView, b: TaskView) =>
      a.task.dueDate.localeCompare(b.task.dueDate) || (a.task.dueTime ?? "99:99").localeCompare(b.task.dueTime ?? "99:99");
    const yeni = views.filter((v) => v.task.dueDate === today && v.task.kind === "yeni");
    const gecikenler = views.filter((v) => v.task.dueDate < today).sort(byDue);
    const dundenKalanlar = views.filter((v) => v.task.dueDate === today && v.task.kind === "takip" && v.task.reason === "ulasilamadi");
    const planlananlar = views.filter((v) => v.task.dueDate === today && v.task.kind === "takip" && v.task.reason !== "ulasilamadi").sort(byDue);
    const appointmentsToday = (apptRows as Row[]).map((r) => ({ appointment: toAppointment(r), business: toBusiness(r.business as Row) }));

    return {
      today,
      run: (runRows as Row[])[0] ? toRun((runRows as Row[])[0]) : undefined,
      newTasks: yeni,
      dundenKalanlar,
      gecikenler,
      planlananlar,
      appointmentsToday,
      counts: {
        newRemaining: yeni.length,
        newTotal: newTotalRes.count ?? 0,
        callsToday: callsRes.count ?? 0,
        openFollowUps: dundenKalanlar.length + gecikenler.length + planlananlar.length,
        appointmentsToday: appointmentsToday.length,
        customers: customersRes.count ?? 0,
      },
    };
  }

  private async lastCalls(businessIds: string[]): Promise<Map<string, Activity>> {
    const map = new Map<string, Activity>();
    if (!businessIds.length) return map;
    const rows = await this.q(
      this.db.from("activities").select("*").in("business_id", businessIds).eq("type", "arama").is("voided_at", null).order("at", { ascending: false }),
    );
    for (const r of rows as Row[]) {
      const a = toActivity(r);
      if (!map.has(a.businessId)) map.set(a.businessId, a);
    }
    return map;
  }

  async getBusiness(id: string): Promise<BusinessDetail | undefined> {
    const rows = await this.q(this.db.from("businesses").select("*").eq("id", id));
    const row = (rows as Row[])[0];
    if (!row) return undefined;
    const [tasks, activities, appointments] = await Promise.all([
      this.q(this.db.from("call_tasks").select("*").eq("business_id", id).eq("status", "acik")),
      this.q(this.db.from("activities").select("*").eq("business_id", id).order("at", { ascending: false })),
      this.q(this.db.from("appointments").select("*").eq("business_id", id).order("starts_at", { ascending: false })),
    ]);
    return {
      business: toBusiness(row),
      openTask: (tasks as Row[])[0] ? toTask((tasks as Row[])[0]) : undefined,
      activities: (activities as Row[]).map(toActivity),
      appointments: (appointments as Row[]).map(toAppointment),
    };
  }

  async listBusinesses(f: BusinessFilters): Promise<Business[]> {
    let query = this.db.from("businesses").select("*");
    if (f.category) query = query.contains("categories", [f.category]);
    if (f.district) query = query.eq("district", f.district);
    if (f.callStatus) query = query.eq("call_status", f.callStatus);
    if (f.salesStage) query = query.eq("sales_stage", f.salesStage);
    if (f.source) query = query.eq("source", f.source);
    if (f.needsReview) query = query.not("review_reason", "is", null);
    const rows = ((await this.q(query.limit(5000))) as Row[]).map(toBusiness);
    const q = f.q ? f.q.trim().toLocaleLowerCase("tr-TR") : "";
    const qDigits = f.q?.replace(/\D/g, "") ?? "";
    return rows
      .filter((b) => {
        if (!q) return true;
        const hay = [b.name, b.address, b.district, b.email, b.website, ...b.contacts.map((c) => c.name)].join(" ").toLocaleLowerCase("tr-TR");
        const phoneHit = qDigits.length >= 4 && (b.phone ?? "").replace(/\D/g, "").includes(qDigits);
        return hay.includes(q) || phoneHit;
      })
      .sort((a, b) => a.name.localeCompare(b.name, "tr"));
  }

  async listDistricts(): Promise<string[]> {
    const rows = await this.q(this.db.from("businesses").select("district").not("district", "is", null));
    return [...new Set((rows as Row[]).map((r) => String(r.district)))].sort((a, b) => a.localeCompare(b, "tr"));
  }

  // ---------- arama ve satış ----------

  async recordCall(businessId: string, input: CallOutcomeInput): Promise<void> {
    const detail = await this.getBusiness(businessId);
    if (!detail) throw new RuleError("İşletme bulunamadı.");
    const outcome = decideCallOutcome(detail.business, input, toDateStr(new Date()));
    await this.q(
      this.db.rpc("apply_call_outcome", {
        p_business_id: businessId,
        p_patch: outcome.patch,
        p_activities: outcome.activities,
        p_next_task: outcome.nextTask ?? null,
      }),
    );
  }

  async setSalesStage(businessId: string, stage: SalesStage, note?: string): Promise<void> {
    await this.q(this.db.from("businesses").update({ sales_stage: stage }).eq("id", businessId));
    await this.q(this.db.from("activities").insert({ business_id: businessId, type: "asama", stage, note: note ?? null }));
  }

  async addNote(businessId: string, note: string): Promise<void> {
    await this.q(this.db.from("activities").insert({ business_id: businessId, type: "not", note }));
  }

  async voidActivity(businessId: string, activityId: string): Promise<void> {
    await this.q(this.db.from("activities").update({ voided_at: new Date().toISOString() }).eq("id", activityId).eq("business_id", businessId).is("voided_at", null));
    const rows = await this.q(this.db.from("activities").select("*").eq("business_id", businessId));
    const streak = recomputeFailedStreak((rows as Row[]).map(toActivity));
    await this.q(this.db.from("businesses").update({ failed_streak: streak }).eq("id", businessId));
    await this.q(
      this.db.from("activities").insert({
        business_id: businessId,
        type: "duzeltme",
        note: "Bir kayıt hatalı olarak işaretlendi. Durum gerekirse elle düzeltilmeli.",
      }),
    );
  }

  // ---------- işletme ----------

  private async assertNoDuplicate(input: BusinessInput, selfId?: string) {
    const phone = normalizePhone(input.phone);
    const site = normalizeWebsite(input.website);
    if (!phone && !site) return;
    const rows = await this.q(this.db.from("businesses").select("id, name, phone, website"));
    for (const r of rows as Row[]) {
      if (r.id === selfId) continue;
      if (phone && normalizePhone(str(r.phone)) === phone) throw new RuleError(`Bu telefon zaten kayıtlı: ${r.name}`);
      if (site && normalizeWebsite(str(r.website)) === site) throw new RuleError(`Bu web sitesi zaten kayıtlı: ${r.name}`);
    }
  }

  async createBusiness(input: BusinessInput): Promise<string> {
    await this.assertNoDuplicate(input);
    const now = new Date().toISOString();
    const rows = await this.q(
      this.db.from("businesses").insert({ ...businessColumns(input), source: "manuel", found_at: now, verified_at: now, user_edited: true }).select("id"),
    );
    const id = String((rows as Row[])[0].id);
    await this.q(this.db.from("activities").insert({ business_id: id, type: "sistem", note: "Manuel olarak eklendi." }));
    return id;
  }

  async updateBusiness(id: string, input: BusinessInput): Promise<void> {
    await this.assertNoDuplicate(input, id);
    await this.q(this.db.from("businesses").update({ ...businessColumns(input), verified_at: new Date().toISOString(), user_edited: true }).eq("id", id));
    await this.q(this.db.from("activities").insert({ business_id: id, type: "duzeltme", note: "İşletme bilgileri düzenlendi." }));
  }

  // ---------- randevu ----------

  async listAppointments(): Promise<AppointmentView[]> {
    const rows = await this.q(this.db.from("appointments").select("*, business:businesses(*)").order("starts_at"));
    return (rows as Row[]).map((r) => ({ appointment: toAppointment(r), business: toBusiness(r.business as Row) }));
  }

  async getAppointment(id: string): Promise<AppointmentView | undefined> {
    const rows = await this.q(this.db.from("appointments").select("*, business:businesses(*)").eq("id", id));
    const r = (rows as Row[])[0];
    return r && { appointment: toAppointment(r), business: toBusiness(r.business as Row) };
  }

  private appointmentColumns(input: AppointmentInput) {
    return {
      starts_at: input.startsAt,
      contact_name: input.contactName ?? null,
      meeting_type: input.meetingType,
      location: input.location ?? null,
      note: input.note ?? null,
      reminder_minutes: input.reminderMinutes,
    };
  }

  async createAppointment(businessId: string, input: AppointmentInput): Promise<string> {
    const rows = await this.q(this.db.from("appointments").insert({ business_id: businessId, ...this.appointmentColumns(input) }).select("id"));
    const detail = await this.getBusiness(businessId);
    if (detail && (detail.business.salesStage === "yeni_aday" || detail.business.salesStage === "iletisim_kuruldu")) {
      await this.setSalesStage(businessId, "randevu_alindi");
    }
    await this.q(this.db.from("activities").insert({ business_id: businessId, type: "randevu", note: describeAppointment(input) }));
    return String((rows as Row[])[0].id);
  }

  async setCalendarSync(id: string, sync: CalendarSync): Promise<void> {
    await this.q(
      this.db.from("appointments").update({ calendar_status: sync.status, calendar_error: sync.error ?? null, calendar_synced_at: sync.at, calendar_dirty: false }).eq("id", id),
    );
  }

  async queueCalendarSync(id: string): Promise<void> {
    await this.q(this.db.from("appointments").update({ calendar_dirty: true }).eq("id", id));
  }

  async updateAppointment(id: string, input: AppointmentInput): Promise<void> {
    const view = await this.getAppointment(id);
    if (!view) throw new RuleError("Randevu bulunamadı.");
    if (view.appointment.status !== "planlandi") throw new RuleError("Yalnızca planlanmış randevu değiştirilebilir.");
    await this.q(this.db.from("appointments").update(this.appointmentColumns(input)).eq("id", id));
    await this.q(this.db.from("activities").insert({ business_id: view.business.id, type: "randevu", note: `Randevu değiştirildi: ${describeAppointment(input)}` }));
  }

  async cancelAppointment(id: string): Promise<void> {
    const rows = await this.q(this.db.from("appointments").update({ status: "iptal" }).eq("id", id).eq("status", "planlandi").select("business_id"));
    const r = (rows as Row[])[0];
    if (r) await this.q(this.db.from("activities").insert({ business_id: r.business_id, type: "randevu", note: "Randevu iptal edildi." }));
  }

  async completeAppointment(id: string, outcome: string): Promise<void> {
    const rows = await this.q(this.db.from("appointments").update({ status: "yapildi", outcome }).eq("id", id).select("business_id"));
    const r = (rows as Row[])[0];
    if (!r) throw new RuleError("Randevu bulunamadı.");
    const businessId = String(r.business_id);
    const detail = await this.getBusiness(businessId);
    if (detail?.business.salesStage === "randevu_alindi") await this.setSalesStage(businessId, "gorusme_yapildi");
    await this.q(this.db.from("activities").insert({ business_id: businessId, type: "randevu", note: `Görüşme yapıldı: ${outcome}` }));
  }

  // ---------- ayarlar ve otomasyon ----------

  async getIntegrations(): Promise<Integrations> {
    const rows = await this.q(this.db.from("job_state").select("value, updated_at").eq("key", "integrations"));
    const r = (rows as Row[])[0];
    const v = (r?.value ?? {}) as Partial<Integrations>;
    return { scanner: !!v.scanner, calendar: !!v.calendar, notifications: !!v.notifications, lastHeartbeat: str(r?.updated_at) };
  }

  async getSettings(): Promise<Settings> {
    const [rows, integrations] = await Promise.all([this.q(this.db.from("settings").select("*").eq("id", 1)), this.getIntegrations()]);
    const r = (rows as Row[])[0] ?? {};
    return {
      dailyTarget: Number(r.daily_target ?? 20),
      categories: (r.categories as Settings["categories"]) ?? ["estetik", "dis", "sac_sagligi", "sac_ekim"],
      districts: (r.districts as string[]) ?? [],
      reminderMinutes: Number(r.reminder_minutes ?? 30),
      scanLimit: Number(r.scan_limit ?? 20),
      notificationsConfigured: integrations.notifications,
      calendarConfigured: integrations.calendar,
      scannerConfigured: integrations.scanner,
    };
  }

  async updateSettings(input: EditableSettings): Promise<void> {
    await this.q(
      this.db.from("settings").update({
        daily_target: input.dailyTarget,
        categories: input.categories,
        districts: input.districts,
        reminder_minutes: input.reminderMinutes,
        scan_limit: input.scanLimit,
      }).eq("id", 1),
    );
  }

  async listRuns(limit: number): Promise<DailyRun[]> {
    const rows = await this.q(this.db.from("daily_runs").select("*").order("date", { ascending: false }).limit(limit));
    return (rows as Row[]).map(toRun);
  }

  async runDailyList(trigger: DailyRun["trigger"]): Promise<DailyRunResult> {
    // Seçim veritabanında yapılır (run_daily_list); tick, GitHub işi ve arayüz aynı kuralı kullanır.
    const res = (await this.q(this.db.rpc("run_daily_list", { p_trigger: trigger }))) as { created: boolean; added: number; run: Row };
    return { created: res.created, added: res.added, run: toRun(res.run) };
  }

  async requestScan(): Promise<{ queued: boolean; message: string }> {
    const { error } = await this.db.from("scan_requests").insert({});
    if (error?.code === "23505") return { queued: false, message: "Zaten bekleyen bir tarama isteği var." };
    if (error) throw new Error(`Veritabanı hatası: ${error.message}`);
    return { queued: true, message: "Tarama isteği alındı. Birkaç dakika içinde başlar; bu sayfa ilerlemeyi gösterir." };
  }

  // ---------- tarama (zamanlanmış işler) ----------

  async importPlaces(places: PlaceInput[], maxNew: number): Promise<ImportResult> {
    const result: ImportResult = { added: 0, updated: 0, flagged: 0, skipped: 0, overLimit: 0 };
    const existing = ((await this.q(this.db.from("businesses").select("*"))) as Row[]).map((r) => ({ b: toBusiness(r), userEdited: !!r.user_edited }));
    const now = new Date().toISOString();
    for (const place of places) {
      const decision = decideImport(existing.map((e) => e.b), place);
      if (decision.kind === "update") {
        // Yalnızca iletişim bilgileri tazelenir; durum, notlar ve geçmiş korunur. Kullanıcı düzenlediyse dokunulmaz.
        const cur = existing.find((e) => e.b.id === decision.businessId)!;
        if (!cur.userEdited) {
          await this.q(
            this.db.from("businesses").update({
              name: place.name,
              phone: place.phone ?? cur.b.phone ?? null,
              website: place.website ?? cur.b.website ?? null,
              email: place.email ?? cur.b.email ?? null,
              address: place.address ?? cur.b.address ?? null,
              district: place.district ?? cur.b.district ?? null,
              maps_url: place.mapsUrl ?? cur.b.mapsUrl ?? null,
              categories: place.categories.length ? place.categories : cur.b.categories,
              verified_at: now,
            }).eq("id", cur.b.id),
          );
        } else {
          await this.q(this.db.from("businesses").update({ verified_at: now }).eq("id", cur.b.id));
        }
        result.updated++;
        continue;
      }
      if (result.added >= maxNew) {
        result.overLimit++;
        continue;
      }
      const reviewReason = [decision.reviewReason, ...dataIssues(place)].filter(Boolean).join(", ") || null;
      const { data, error } = await this.db
        .from("businesses")
        .insert({
          name: place.name,
          categories: place.categories,
          phone: place.phone ?? null,
          email: place.email ?? null,
          website: place.website ?? null,
          district: place.district ?? null,
          address: place.address ?? null,
          maps_url: place.mapsUrl ?? null,
          source: place.source,
          source_id: place.sourceId,
          found_at: now,
          verified_at: now,
          review_reason: reviewReason,
        })
        .select("*");
      if (error?.code === "23505") {
        result.updated++; // aynı kaynak kimliği arada eklenmiş
        continue;
      }
      if (error) throw new Error(`Veritabanı hatası: ${error.message}`);
      existing.push({ b: toBusiness((data as Row[])[0]), userEdited: false });
      result.added++;
      if (reviewReason) result.flagged++;
    }
    return result;
  }

  async saveScan(scan: ScanRun): Promise<void> {
    await this.q(
      this.db.from("scans").upsert({
        id: scan.id,
        started_at: scan.startedAt,
        finished_at: scan.finishedAt ?? null,
        status: scan.status,
        limit: scan.limit,
        queries: scan.queries,
        found: scan.found,
        added: scan.added,
        updated: scan.updated,
        flagged: scan.flagged,
        skipped: scan.skipped,
        over_limit: scan.overLimit,
        note: scan.note ?? null,
        error: scan.error ?? null,
      }),
    );
  }

  async listScans(limit: number): Promise<ScanRun[]> {
    const rows = await this.q(this.db.from("scans").select("*").order("started_at", { ascending: false }).limit(limit));
    return (rows as Row[]).map(toScan);
  }

  async getScanCursor(): Promise<number> {
    const rows = await this.q(this.db.from("job_state").select("value").eq("key", "scan_cursor"));
    return Number((rows as Row[])[0]?.value ?? 0);
  }

  async setScanCursor(cursor: number): Promise<void> {
    await this.q(this.db.from("job_state").upsert({ key: "scan_cursor", value: cursor, updated_at: new Date().toISOString() }));
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
