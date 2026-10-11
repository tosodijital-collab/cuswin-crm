// Randevuyu Supabase Edge Function (calendar-sync) ile Google Takvim'e anında yazdırır.
// Başarısız olursa randevu calendar_dirty olarak kalır; GitHub Actions'taki yedek iş birkaç dakika içinde tekrar dener.

import { getBrowserSupabase, isSupabaseConfigured } from "@/lib/supabase/client";

const TIMEOUT_MS = 15_000;

export async function syncCalendarNow(appointmentId: string): Promise<string> {
  if (!isSupabaseConfigured()) return "";
  try {
    const { data, error } = await getBrowserSupabase().functions.invoke<{ status: string; error?: string }>("calendar-sync", {
      body: { appointmentId },
      timeout: TIMEOUT_MS,
    });
    if (error || !data) return " Takvime şimdi yazılamadı; birkaç dakika içinde yeniden denenecek.";
    switch (data.status) {
      case "eklendi":
        return " Google Takvim'e yazıldı.";
      case "kaldirildi":
        return " Google Takvim'den kaldırıldı.";
      case "kapali":
        return "";
      default:
        return ` Takvime yazılamadı (${data.error ?? "bilinmeyen hata"}); birkaç dakika içinde yeniden denenecek.`;
    }
  } catch {
    return " Takvime şimdi yazılamadı; birkaç dakika içinde yeniden denenecek.";
  }
}
