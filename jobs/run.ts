// Zamanlanmış işler (GitHub Actions). Kullanım: tsx jobs/run.ts daily | frequent
//   daily    — her sabah: Google Maps taraması + günün arama listesi
//   frequent — birkaç dakikada bir: kaçırılan liste telafisi, "şimdi tara" istekleri, hatırlatmalar, takvim eşitleme
// Tüm adımlar tekrar çalıştırılmaya dayanıklıdır (veritabanı kısıtları ve "claim" güncellemeleri).

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { SupabaseRepository, toAppointment, toBusiness } from "@/lib/data/supabase-repository";
import { formatPhone } from "@/lib/domain/contact-info";
import { MEETING_TYPE_LABELS } from "@/lib/domain/labels";
import { formatTime, toDateStr, toTimeStr } from "@/lib/domain/time";
import { isCalendarConfigured, syncAppointmentToCalendar } from "./google-calendar";
import { isScraperConfigured } from "./maps-scraper";
import { isNotifyConfigured, sendNotification } from "./notify";
import { runScan } from "./scan";

const DAILY_LIST_HOUR = "08:00"; // bu saatten sonra liste yoksa telafi edilir
const MAX_REMINDER_ATTEMPTS = 5;
const STALE_REMINDER_MS = 2 * 60 * 60_000;
const CLAIM_TIMEOUT_MS = 10 * 60_000;

function env(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`${name} tanımlı değil.`);
  return v;
}

function log(msg: string) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

const db: SupabaseClient = createClient(env("SUPABASE_URL"), env("SUPABASE_SECRET_KEY"), {
  auth: { persistSession: false, autoRefreshToken: false },
});
const repo = new SupabaseRepository(db);
const appUrl = process.env.APP_URL?.replace(/\/$/, "");

async function must<T>(p: PromiseLike<{ data: T | null; error: { message: string } | null }>): Promise<T> {
  const { data, error } = await p;
  if (error) throw new Error(error.message);
  return data as T;
}

async function heartbeat() {
  await must(
    db.from("job_state").upsert({
      key: "integrations",
      value: { scanner: isScraperConfigured(), calendar: isCalendarConfigured(), notifications: isNotifyConfigured() },
      updated_at: new Date().toISOString(),
    }),
  );
}

async function scanAndList(trigger: "zamanlanmis" | "manuel") {
  if (!isScraperConfigured()) {
    log("Tarayıcı ayarlı değil, tarama atlandı.");
  } else {
    const scan = await runScan(repo);
    log(`Tarama ${scan.status}: ${scan.found} sonuç, ${scan.added} yeni, ${scan.updated} tazelendi, ${scan.skipped} elendi${scan.error ? `, hata: ${scan.error}` : ""}`);
  }
  const res = await repo.runDailyList(trigger);
  log(`Günlük liste: ${res.created ? "oluşturuldu" : "vardı"}, eklenen ${res.added}, toplam ${res.run.selected}/${res.run.target}`);
}

async function catchUpDailyList() {
  const now = new Date();
  if (toTimeStr(now) < DAILY_LIST_HOUR) return;
  const runs = await must(db.from("daily_runs").select("date").eq("date", toDateStr(now)));
  if ((runs as unknown[]).length) return;
  const res = await repo.runDailyList("telafi");
  log(`Telafi listesi oluşturuldu: ${res.run.selected}/${res.run.target}`);
}

async function processScanRequest() {
  const claimed = await must(
    db.from("scan_requests").update({ status: "alindi" }).eq("status", "bekliyor").select("id"),
  );
  const req = (claimed as { id: string }[])[0];
  if (!req) return;
  log("Tarama isteği alındı.");
  try {
    await scanAndList("manuel");
  } finally {
    await must(db.from("scan_requests").update({ status: "bitti" }).eq("id", req.id));
  }
}

async function sendDueReminders() {
  if (!isNotifyConfigured()) return;
  const now = Date.now();
  const rows = await must(
    db
      .from("appointments")
      .select("*, business:businesses(*)")
      .eq("status", "planlandi")
      .is("reminder_sent_at", null)
      .lt("reminder_attempts", MAX_REMINDER_ATTEMPTS)
      .gt("starts_at", new Date(now - STALE_REMINDER_MS).toISOString())
      .lte("starts_at", new Date(now + 24 * 60 * 60_000).toISOString()),
  );
  for (const r of rows as Record<string, unknown>[]) {
    const a = toAppointment(r);
    const b = toBusiness(r.business as Record<string, unknown>);
    if (new Date(a.startsAt).getTime() - a.reminderMinutes * 60_000 > now) continue;

    // Tek gönderim: önce sahiplen, başka bir çalışma aynı anda göndermesin.
    const claimed = await must(
      db
        .from("appointments")
        .update({ reminder_claimed_at: new Date().toISOString() })
        .eq("id", a.id)
        .is("reminder_sent_at", null)
        .or(`reminder_claimed_at.is.null,reminder_claimed_at.lt.${new Date(now - CLAIM_TIMEOUT_MS).toISOString()}`)
        .select("id"),
    );
    if (!(claimed as unknown[]).length) continue;

    try {
      await sendNotification({
        title: `Randevu ${formatTime(a.startsAt)}: ${b.name}`,
        message: [
          [a.contactName, MEETING_TYPE_LABELS[a.meetingType]].filter(Boolean).join(", "),
          b.phone && `Telefon: ${formatPhone(b.phone)}`,
          a.location && `Yer: ${a.location}`,
          a.note,
        ]
          .filter(Boolean)
          .join("\n"),
        clickUrl: appUrl ? `${appUrl}/isletme?id=${b.id}` : undefined,
      });
      await must(db.from("appointments").update({ reminder_sent_at: new Date().toISOString(), reminder_error: null }).eq("id", a.id));
      log(`Hatırlatma gönderildi: ${a.id}`);
    } catch (e) {
      const message = e instanceof Error ? e.message.slice(0, 200) : "bilinmeyen hata";
      await must(
        db
          .from("appointments")
          .update({ reminder_attempts: Number(r.reminder_attempts ?? 0) + 1, reminder_error: message, reminder_claimed_at: null })
          .eq("id", a.id),
      );
      log(`Hatırlatma gönderilemedi (${a.id}): ${message}`);
    }
  }
}

async function syncCalendar() {
  const rows = await must(db.from("appointments").select("*, business:businesses(*)").eq("calendar_dirty", true).limit(25));
  for (const r of rows as Record<string, unknown>[]) {
    const a = toAppointment(r);
    const b = toBusiness(r.business as Record<string, unknown>);
    const sync = await syncAppointmentToCalendar(a, b);
    // Eşitleme sırasında randevu değiştiyse işaret kalkmasın: yalnızca okunan haliyle aynıysa temizle.
    await must(
      db
        .from("appointments")
        .update({ calendar_status: sync.status, calendar_error: sync.error ?? null, calendar_synced_at: sync.at, calendar_dirty: false })
        .eq("id", a.id)
        .eq("starts_at", String(r.starts_at))
        .eq("status", a.status)
        .eq("reminder_minutes", a.reminderMinutes),
    );
    if (sync.status !== "kapali") log(`Takvim ${sync.status}: ${a.id}${sync.error ? ` (${sync.error})` : ""}`);
  }
}

/** Bir adım hata verse de diğerleri çalışsın; hata sonunda bildirilsin. */
async function step(name: string, fn: () => Promise<void>, errors: string[]) {
  try {
    await fn();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    errors.push(`${name}: ${msg}`);
    log(`HATA ${name}: ${msg}`);
  }
}

async function main() {
  const task = process.argv[2];
  const errors: string[] = [];
  await step("heartbeat", heartbeat, errors);
  if (task === "daily") {
    await step("tarama ve liste", () => scanAndList("zamanlanmis"), errors);
  } else if (task === "frequent") {
    await step("liste telafisi", catchUpDailyList, errors);
    await step("tarama isteği", processScanRequest, errors);
    await step("hatırlatmalar", sendDueReminders, errors);
    await step("takvim", syncCalendar, errors);
  } else {
    throw new Error("Kullanım: tsx jobs/run.ts daily|frequent");
  }
  if (errors.length) {
    process.exitCode = 1;
  }
}

main().catch((e) => {
  log(`HATA: ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
});
