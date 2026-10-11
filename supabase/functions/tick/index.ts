// Dakikalık iş: Supabase pg_cron her dakika çağırır (GitHub zamanlayıcısı güvenilir olmadığı için).
//   - randevu hatırlatmaları (ntfy, tek gönderim)
//   - Google Takvim yedek eşitleme (calendar_dirty kayıtlar)
//   - 08.30'dan sonra günün listesi yoksa oluşturma (run_daily_list)
//   - 08.00'den sonra günlük Google Maps taraması ve "Şimdi tara" istekleri için GitHub Actions'ı tetikleme
// Yetki: pg_cron'un Vault'tan gönderdiği x-cron-token, veritabanında check_cron_token ile doğrulanır.

import { createClient } from "npm:@supabase/supabase-js@2.117.3";
import { formatPhone, isCalendarConfigured, type Row, saveSyncResult, syncAppointment } from "../_shared/google-calendar.ts";

const TZ = "Europe/Istanbul";
const LIST_TIME = "08:30";
const SCAN_TIME = "08:00";
const MAX_REMINDER_ATTEMPTS = 5;
const STALE_REMINDER_MS = 2 * 60 * 60_000;
const CLAIM_TIMEOUT_MS = 10 * 60_000;
const MEETING: Record<string, string> = { telefon: "Telefon", cevrimici: "Çevrim içi", yuz_yuze: "Yüz yüze" };

const dateFmt = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });
const timeFmt = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const log: string[] = [];

async function must<T>(p: PromiseLike<{ data: T | null; error: { message: string } | null }>): Promise<T> {
  const { data, error } = await p;
  if (error) throw new Error(error.message);
  return data as T;
}

async function getState(key: string): Promise<unknown> {
  const rows = (await must(db.from("job_state").select("value").eq("key", key))) as Row[];
  return rows[0]?.value;
}

async function setState(key: string, value: unknown) {
  await must(db.from("job_state").upsert({ key, value, updated_at: new Date().toISOString() }));
}

// ---------- GitHub Actions tetikleme ----------

async function dispatchScan(reason: string): Promise<boolean> {
  const token = Deno.env.get("GITHUB_DISPATCH_TOKEN");
  const repo = Deno.env.get("GITHUB_REPO");
  if (!token || !repo) return false;
  const res = await fetch(`https://api.github.com/repos/${repo}/actions/workflows/jobs.yml/dispatches`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
      "User-Agent": "cuswin-crm-tick",
    },
    body: JSON.stringify({ ref: "main", inputs: { task: "daily" } }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    await setState("last_error", { at: new Date().toISOString(), where: "github", message: `GitHub tetikleme HTTP ${res.status}` });
    log.push(`tarama tetiklenemedi (${reason}): HTTP ${res.status}`);
    return false;
  }
  log.push(`tarama tetiklendi (${reason})`);
  return true;
}

async function scans(today: string, now: string) {
  // Elle istenen tarama
  const claimed = (await must(db.from("scan_requests").update({ status: "alindi" }).eq("status", "bekliyor").select("id"))) as Row[];
  if (claimed.length) {
    const ok = await dispatchScan("istek");
    if (!ok) await must(db.from("scan_requests").update({ status: "bekliyor" }).in("id", claimed.map((r) => r.id)));
  }
  // Günlük tarama (kaçırıldıysa gün içinde telafi edilir)
  if (now >= SCAN_TIME && (await getState("scan_dispatched_date")) !== today) {
    if (await dispatchScan("günlük")) await setState("scan_dispatched_date", today);
  }
}

// ---------- günlük liste ----------

async function dailyList(today: string, now: string) {
  if (now < LIST_TIME) return;
  const runs = (await must(db.from("daily_runs").select("date").eq("date", today))) as Row[];
  if (runs.length) return;
  const trigger = now < "08:40" ? "zamanlanmis" : "telafi";
  const res = (await must(db.rpc("run_daily_list", { p_trigger: trigger }))) as { added: number };
  log.push(`günün listesi oluşturuldu (${trigger}): ${res.added}`);
}

// ---------- hatırlatmalar ----------

async function sendNtfy(title: string, message: string, clickUrl?: string) {
  const topic = Deno.env.get("NTFY_TOPIC")!;
  const headers: Record<string, string> = {
    Title: `=?UTF-8?B?${btoa(String.fromCharCode(...new TextEncoder().encode(title)))}?=`,
    Priority: "high",
    Tags: "calendar",
  };
  if (clickUrl) headers.Click = clickUrl;
  const res = await fetch(`https://ntfy.sh/${encodeURIComponent(topic)}`, {
    method: "POST",
    headers,
    body: message,
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`ntfy HTTP ${res.status}`);
}

async function reminders() {
  if (!Deno.env.get("NTFY_TOPIC")) return;
  const now = Date.now();
  const rows = (await must(
    db
      .from("appointments")
      .select("*, business:businesses(*)")
      .eq("status", "planlandi")
      .is("reminder_sent_at", null)
      .lt("reminder_attempts", MAX_REMINDER_ATTEMPTS)
      .gt("starts_at", new Date(now - STALE_REMINDER_MS).toISOString())
      .lte("starts_at", new Date(now + 24 * 60 * 60_000).toISOString()),
  )) as Row[];
  const appUrl = Deno.env.get("APP_URL")?.replace(/\/$/, "");
  for (const a of rows) {
    const start = new Date(String(a.starts_at));
    if (start.getTime() - Number(a.reminder_minutes) * 60_000 > now) continue;
    const claimed = (await must(
      db
        .from("appointments")
        .update({ reminder_claimed_at: new Date().toISOString() })
        .eq("id", a.id)
        .is("reminder_sent_at", null)
        .or(`reminder_claimed_at.is.null,reminder_claimed_at.lt.${new Date(now - CLAIM_TIMEOUT_MS).toISOString()}`)
        .select("id"),
    )) as Row[];
    if (!claimed.length) continue;
    const b = a.business as Row;
    try {
      await sendNtfy(
        `Randevu ${timeFmt.format(start)}: ${b.name}`,
        [
          [a.contact_name, MEETING[String(a.meeting_type)]].filter(Boolean).join(", "),
          b.phone && `Telefon: ${formatPhone(String(b.phone))}`,
          a.location && `Yer: ${a.location}`,
          a.note,
        ]
          .filter(Boolean)
          .join("\n"),
        appUrl ? `${appUrl}/isletme?id=${b.id}` : undefined,
      );
      await must(db.from("appointments").update({ reminder_sent_at: new Date().toISOString(), reminder_error: null }).eq("id", a.id));
      log.push(`hatırlatma gönderildi ${String(a.id).slice(0, 8)}`);
    } catch (e) {
      await must(
        db
          .from("appointments")
          .update({
            reminder_attempts: Number(a.reminder_attempts ?? 0) + 1,
            reminder_error: e instanceof Error ? e.message.slice(0, 200) : "bilinmeyen hata",
            reminder_claimed_at: null,
          })
          .eq("id", a.id),
      );
    }
  }
}

// ---------- takvim yedeği ----------

async function calendar() {
  const rows = (await must(db.from("appointments").select("*, business:businesses(*)").eq("calendar_dirty", true).limit(10))) as Row[];
  for (const a of rows) {
    let result: { status: string; error?: string };
    try {
      result = await syncAppointment(a, a.business as Row);
    } catch (e) {
      result = { status: "hata", error: e instanceof Error ? e.message.slice(0, 120) : "bilinmeyen hata" };
    }
    if (result.status === "kapali") {
      await must(db.from("appointments").update({ calendar_status: "kapali", calendar_dirty: false }).eq("id", a.id));
    } else {
      await saveSyncResult(db, a, result);
    }
  }
}

// ---------- istek ----------

Deno.serve(async (req) => {
  const token = req.headers.get("x-cron-token") ?? "";
  const { data: ok } = await db.rpc("check_cron_token", { p: token });
  if (ok !== true) return new Response("yetkisiz", { status: 401 });

  log.length = 0;
  const nowDate = new Date();
  const today = dateFmt.format(nowDate);
  const now = timeFmt.format(nowDate);
  const errors: string[] = [];
  const step = async (name: string, fn: () => Promise<void>) => {
    try {
      await fn();
    } catch (e) {
      errors.push(`${name}: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  await step("durum", () =>
    setState("integrations", {
      scanner: Boolean(Deno.env.get("GITHUB_DISPATCH_TOKEN")),
      calendar: isCalendarConfigured(),
      notifications: Boolean(Deno.env.get("NTFY_TOPIC")),
    }),
  );
  await step("hatırlatma", reminders);
  await step("takvim", calendar);
  await step("liste", () => dailyList(today, now));
  await step("tarama", () => scans(today, now));
  if (errors.length) await step("hata kaydı", () => setState("last_error", { at: nowDate.toISOString(), where: "tick", message: errors.join(" | ") }));

  return new Response(JSON.stringify({ ok: errors.length === 0, log, errors }), {
    headers: { "Content-Type": "application/json" },
  });
});
