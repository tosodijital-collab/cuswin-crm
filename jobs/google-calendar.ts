// Randevuları Google Takvim'e yazar. Kimlik: servis hesabı; takvim bu hesapla "etkinlikleri değiştirebilir" olarak paylaşılır.
// Ücretsiz Calendar API kotası kullanılır; faturalandırma gerekmez.

import "server-only";
import { readFile } from "node:fs/promises";
import { JWT } from "google-auth-library";
import { z } from "zod";
import { formatPhone } from "@/lib/domain/contact-info";
import { MEETING_TYPE_LABELS } from "@/lib/domain/labels";
import { TZ } from "@/lib/domain/time";
import type { Appointment, Business, CalendarSync } from "@/lib/domain/types";

const API = "https://www.googleapis.com/calendar/v3";
const SCOPE = "https://www.googleapis.com/auth/calendar.events";
const TIMEOUT_MS = 10_000;
/** Randevuya bitiş saati girilmediği için takvimde varsayılan süre. */
export const EVENT_MINUTES = 30;

const keySchema = z.object({
  type: z.literal("service_account"),
  client_email: z.email(),
  private_key: z.string().startsWith("-----BEGIN PRIVATE KEY-----"),
});

type Config = { calendarId: string; keyFile: string };

function config(): Config | undefined {
  const calendarId = process.env.GOOGLE_CALENDAR_ID?.trim();
  const keyFile = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE?.trim();
  return calendarId && keyFile ? { calendarId, keyFile } : undefined;
}

export function isCalendarConfigured(): boolean {
  return config() !== undefined;
}

let clientPromise: Promise<JWT> | undefined;

async function client(keyFile: string): Promise<JWT> {
  clientPromise ??= readFile(keyFile, "utf8").then((raw) => {
    const parsed = keySchema.safeParse(JSON.parse(raw));
    if (!parsed.success) throw new CalendarError("Servis hesabı anahtar dosyası geçersiz.");
    return new JWT({ email: parsed.data.client_email, key: parsed.data.private_key, scopes: [SCOPE] });
  });
  try {
    return await clientPromise;
  } catch (e) {
    clientPromise = undefined;
    throw e;
  }
}

class CalendarError extends Error {}

/** Google etkinlik kimliği: base32hex (0-9, a-v). UUID'nin onaltılık hali bu kümeye uyar; tekrar denemede kopya oluşmaz. */
export function eventIdFor(appointmentId: string): string {
  const id = appointmentId.toLowerCase().replace(/[^0-9a-v]/g, "");
  if (id.length < 5) throw new CalendarError("Randevu kimliği takvim için uygun değil.");
  return id;
}

async function call(path: string, init: { method: string; body?: unknown }): Promise<Response> {
  const cfg = config()!;
  const jwt = await client(cfg.keyFile);
  const { token } = await jwt.getAccessToken();
  return fetch(`${API}/calendars/${encodeURIComponent(cfg.calendarId)}${path}`, {
    method: init.method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: init.body ? JSON.stringify(init.body) : undefined,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
}

async function failure(res: Response): Promise<never> {
  // Google hata gövdesinden yalnızca kısa mesajı al; token veya anahtar loglanmaz.
  let message = `HTTP ${res.status}`;
  try {
    const body = (await res.json()) as { error?: { message?: string } };
    if (body.error?.message) message += `: ${body.error.message.slice(0, 200)}`;
  } catch {}
  if (res.status === 403 || res.status === 404) {
    message += ". Takvimin servis hesabıyla 'Etkinliklerde değişiklik yapma' izniyle paylaşıldığını kontrol edin.";
  }
  throw new CalendarError(message);
}

function eventBody(a: Appointment, b: Business, appUrl?: string) {
  const start = new Date(a.startsAt);
  const end = new Date(start.getTime() + EVENT_MINUTES * 60_000);
  const lines = [
    a.contactName && `Görüşülecek kişi: ${a.contactName}`,
    `Görüşme türü: ${MEETING_TYPE_LABELS[a.meetingType]}`,
    b.phone && `Telefon: ${formatPhone(b.phone)}`,
    a.note && `Not: ${a.note}`,
    appUrl && `CRM kaydı: ${appUrl.replace(/\/$/, "")}/isletme/${b.id}`,
  ].filter(Boolean);
  return {
    summary: `Cuswin tanıtımı: ${b.name}`,
    description: lines.join("\n"),
    location: a.location ?? [b.address, b.district].filter(Boolean).join(", "),
    start: { dateTime: start.toISOString(), timeZone: TZ },
    end: { dateTime: end.toISOString(), timeZone: TZ },
    status: "confirmed",
    reminders: { useDefault: false, overrides: [{ method: "popup", minutes: a.reminderMinutes }] },
  };
}

/** Planlı randevuyu takvime yazar; iptal edilmişse takvimden kaldırır. Her zaman sonuç döner, fırlatmaz. */
export async function syncAppointmentToCalendar(a: Appointment, b: Business): Promise<CalendarSync> {
  const at = new Date().toISOString();
  if (!config()) return { status: "kapali", at };
  try {
    const eventId = eventIdFor(a.id);
    if (a.status === "iptal") {
      const res = await call(`/events/${eventId}`, { method: "DELETE" });
      if (!res.ok && res.status !== 404 && res.status !== 410) await failure(res);
      return { status: "kaldirildi", at };
    }
    const body = eventBody(a, b, process.env.APP_URL);
    let res = await call(`/events/${eventId}`, { method: "PUT", body });
    if (res.status === 404) {
      res = await call(`/events`, { method: "POST", body: { ...body, id: eventId } });
    }
    if (!res.ok) await failure(res);
    return { status: "eklendi", at };
  } catch (e) {
    const message =
      e instanceof CalendarError
        ? e.message
        : e instanceof Error && e.name === "TimeoutError"
          ? "Google Takvim zaman aşımına uğradı."
          : "Google Takvim'e bağlanılamadı.";
    return { status: "hata", at, error: message };
  }
}
