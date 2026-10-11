// Randevuyu Google Takvim'e anında yazar. Arayüz randevu kaydedilince/değişince/iptal edilince çağırır.
// Yetki: çağıranın oturumu (RLS) — yalnızca app_owner randevuyu okuyup güncelleyebilir.
// Başarısız olursa randevu calendar_dirty kalır; dakikalık "tick" fonksiyonu tekrar dener.

import { createClient } from "npm:@supabase/supabase-js@2.117.3";
import { type Row, saveSyncResult, syncAppointment } from "../_shared/google-calendar.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-retry-count, traceparent, tracestate, baggage",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Yalnızca POST." }, 405);

  const authorization = req.headers.get("Authorization");
  const apikey = req.headers.get("apikey");
  if (!authorization || !apikey) return json({ error: "Oturum gerekli." }, 401);

  let appointmentId: string;
  try {
    appointmentId = String(((await req.json()) as { appointmentId?: unknown }).appointmentId ?? "");
  } catch {
    return json({ error: "Geçersiz istek." }, 400);
  }
  if (!/^[0-9a-f-]{36}$/i.test(appointmentId)) return json({ error: "Geçersiz randevu." }, 400);

  const db = createClient(Deno.env.get("SUPABASE_URL")!, apikey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });
  const { data: user } = await db.auth.getUser();
  if (!user.user) return json({ error: "Oturum gerekli." }, 401);

  // RLS: yalnızca sahip görebilir; başkası için sonuç boş döner.
  const { data: rows, error } = await db.from("appointments").select("*, business:businesses(*)").eq("id", appointmentId);
  if (error) return json({ error: "Randevu okunamadı." }, 500);
  const a = (rows as Row[])[0];
  if (!a) return json({ error: "Randevu bulunamadı." }, 404);

  let result: { status: string; error?: string };
  try {
    result = await syncAppointment(a, a.business as Row);
  } catch (e) {
    result = { status: "hata", error: e instanceof Error && e.name === "TimeoutError" ? "Google zaman aşımı" : `Google Takvim hatası: ${e instanceof Error ? e.message.slice(0, 120) : "bilinmiyor"}` };
  }
  await saveSyncResult(db, a, result);
  return json(result);
});
