// Edge Function'lar arasında paylaşılan Google Takvim kodu (servis hesabı JWT + etkinlik yazma).
// Etkinlik içeriği jobs/google-calendar.ts ile aynı tutulmalıdır.

const API = "https://www.googleapis.com/calendar/v3";
const SCOPE = "https://www.googleapis.com/auth/calendar.events";
const TZ = "Europe/Istanbul";
const EVENT_MINUTES = 30;
const MEETING: Record<string, string> = { telefon: "Telefon", cevrimici: "Çevrim içi", yuz_yuze: "Yüz yüze" };

// ---------- Google kimlik doğrulama (servis hesabı JWT, Web Crypto) ----------

type ServiceAccount = { client_email: string; private_key: string };

/** Anahtar base64 (GOOGLE_SERVICE_ACCOUNT_B64) ya da düz JSON olarak verilebilir. Bozuk/eksikse undefined. */
function serviceAccount(): ServiceAccount | undefined {
  const b64 = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_B64");
  const raw = b64 ? new TextDecoder().decode(Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))) : Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON");
  if (!raw) return undefined;
  // Ortam değişkeni aktarılırken \n kaçışları gerçek satır sonuna dönmüş olabilir; olduğu gibi okunamazsa geri çevir.
  for (const text of [raw, raw.replace(/\r?\n/g, "\\n")]) {
    try {
      const sa = JSON.parse(text) as ServiceAccount;
      if (sa.client_email && sa.private_key) return sa;
    } catch {
      // sonraki biçimi dene
    }
  }
  return undefined;
}

export function isCalendarConfigured() {
  return Boolean(Deno.env.get("GOOGLE_CALENDAR_ID") && serviceAccount());
}

let cachedToken: { token: string; exp: number } | undefined;

const b64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const enc = new TextEncoder();

async function googleToken(sa: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.exp - 60 > now) return cachedToken.token;
  const header = b64url(enc.encode(JSON.stringify({ alg: "RS256", typ: "JWT" })));
  const claim = b64url(
    enc.encode(JSON.stringify({ iss: sa.client_email, scope: SCOPE, aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 })),
  );
  const pem = sa.private_key.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey("pkcs8", der, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, enc.encode(`${header}.${claim}`)));
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${header}.${claim}.${b64url(sig)}`,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Google kimlik doğrulama başarısız (HTTP ${res.status})`);
  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { token: data.access_token, exp: now + data.expires_in };
  return data.access_token;
}

// ---------- etkinlik ----------

export type Row = Record<string, unknown>;
const s = (v: unknown) => (v === null || v === undefined || v === "" ? undefined : String(v));

export function formatPhone(raw?: string) {
  if (!raw) return undefined;
  let d = raw.replace(/\D/g, "");
  if (d.startsWith("0090")) d = d.slice(4);
  else if (d.startsWith("90") && d.length === 12) d = d.slice(2);
  else if (d.startsWith("0") && d.length === 11) d = d.slice(1);
  return d.length === 10 ? `0${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6, 8)} ${d.slice(8)}` : raw;
}

function eventBody(a: Row, b: Row, appUrl?: string) {
  const start = new Date(String(a.starts_at));
  const end = new Date(start.getTime() + EVENT_MINUTES * 60_000);
  const lines = [
    s(a.contact_name) && `Görüşülecek kişi: ${a.contact_name}`,
    `Görüşme türü: ${MEETING[String(a.meeting_type)] ?? a.meeting_type}`,
    s(b.phone) && `Telefon: ${formatPhone(String(b.phone))}`,
    s(a.note) && `Not: ${a.note}`,
    appUrl && `CRM kaydı: ${appUrl.replace(/\/$/, "")}/isletme?id=${b.id}`,
  ].filter(Boolean);
  return {
    summary: `Cuswin tanıtımı: ${b.name}`,
    description: lines.join("\n"),
    location: s(a.location) ?? [s(b.address), s(b.district)].filter(Boolean).join(", "),
    start: { dateTime: start.toISOString(), timeZone: TZ },
    end: { dateTime: end.toISOString(), timeZone: TZ },
    status: "confirmed",
    reminders: { useDefault: false, overrides: [{ method: "popup", minutes: Number(a.reminder_minutes) }] },
  };
}

export async function syncAppointment(a: Row, b: Row): Promise<{ status: string; error?: string }> {
  const calendarId = Deno.env.get("GOOGLE_CALENDAR_ID");
  const sa = serviceAccount();
  if (!calendarId || !sa) return { status: "kapali" };
  let token: string;
  try {
    token = await googleToken(sa);
  } catch (e) {
    return { status: "hata", error: e instanceof Error ? e.message : "Google kimlik doğrulama hatası" };
  }
  const eventId = String(a.id).toLowerCase().replace(/[^0-9a-v]/g, "");
  const base = `${API}/calendars/${encodeURIComponent(calendarId)}/events`;
  const call = (url: string, method: string, body?: unknown) =>
    fetch(url, {
      method,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(10_000),
    });

  if (a.status === "iptal") {
    const res = await call(`${base}/${eventId}`, "DELETE");
    if (!res.ok && res.status !== 404 && res.status !== 410) return { status: "hata", error: `Google Takvim HTTP ${res.status}` };
    return { status: "kaldirildi" };
  }
  const body = eventBody(a, b, Deno.env.get("APP_URL"));
  let res = await call(`${base}/${eventId}`, "PUT", body);
  if (res.status === 404) res = await call(base, "POST", { ...body, id: eventId });
  if (!res.ok) {
    const hint = res.status === 403 || res.status === 404 ? " (takvim servis hesabıyla paylaşılmış mı?)" : "";
    return { status: "hata", error: `Google Takvim HTTP ${res.status}${hint}` };
  }
  return { status: "eklendi" };
}


/** Eşitleme sonucunu yazar; bu arada randevu değiştiyse işaret kalkmaz, sonraki tur tekrar dener. */
// deno-lint-ignore no-explicit-any
export async function saveSyncResult(db: any, a: Row, result: { status: string; error?: string }) {
  if (result.status === "kapali") return;
  await db
    .from("appointments")
    .update({ calendar_status: result.status, calendar_error: result.error ?? null, calendar_synced_at: new Date().toISOString(), calendar_dirty: false })
    .eq("id", a.id)
    .eq("starts_at", String(a.starts_at))
    .eq("status", String(a.status))
    .eq("reminder_minutes", Number(a.reminder_minutes));
}
