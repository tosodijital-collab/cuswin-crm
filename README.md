# Cuswin Arama — satış CRM'i

Ankara'daki diş, estetik ve saç kliniklerini Google Maps'ten bulup günlük arama listesine çeviren, görüşme
sonuçlarını, takipleri ve tanıtım randevularını yöneten tek kullanıcılı satış CRM'i.
Gereksinimler: `docs/GEREKSINIMLER.md` · Plan ve kararlar: `docs/PLAN.md`.

## Mimari (tamamen ücretsiz)
- **Arayüz:** Next.js statik çıktı → **GitHub Pages**, https://doktor.tosoco.tr (`.github/workflows/deploy.yml`).
- **Veri ve giriş:** **Supabase** (PostgreSQL + Auth, Frankfurt). Kayıt kapalı; yalnızca `app_owner` tablosundaki kullanıcı
  erişir (RLS). Şema: `supabase/migrations/`.
- **Dakikalık iş:** Supabase **pg_cron** her dakika Edge Function `tick`'i çağırır (`supabase/functions/tick`):
  randevu hatırlatmaları (ntfy), Google Takvim yedek eşitleme, 08.30 günün listesi (`run_daily_list`),
  08.00 tarama tetikleme ve "Şimdi tara" istekleri. Ara verilen günlerde liste ve tarama yapılmaz.
- **Takvime anında yazma:** Edge Function `calendar-sync` (oturum + RLS ile yetki).
- **Google Maps taraması:** GitHub Actions (`.github/workflows/jobs.yml`, `jobs/run.ts`), gosom/google-maps-scraper Docker;
  `tick` tarafından tetiklenir (GitHub'ın kendi zamanlayıcısı güvenilir olmadığı için kullanılmaz).
- **Bildirim:** ntfy.sh (telefon uygulaması, gizli konu adı).

Supabase ayarlı değilken arayüz tarayıcıda **demo** verisiyle çalışır.

## Ayarlar ve gizli değerler (değerler depoda yok)
- GitHub variables: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `APP_URL`, `JOBS_ENABLED`. Secret: `SUPABASE_SECRET_KEY`.
- Supabase Edge Function secrets: `GOOGLE_SERVICE_ACCOUNT_B64`, `GOOGLE_CALENDAR_ID`, `NTFY_TOPIC`, `GITHUB_DISPATCH_TOKEN`
  (yalnızca bu deponun Actions izni), `GITHUB_REPO`, `APP_URL`.
- Supabase Vault: `cron_token` (pg_cron → tick yetkisi, otomatik üretildi).
- Edge Function yükleme: `supabase functions deploy <ad> --project-ref zemljzbrpburfzkodjrp --no-verify-jwt --use-api`.

## Geliştirme
```bash
npm install
npm run dev        # http://localhost:3000 (demo ya da .env.local ile Supabase)
npm test
npm run typecheck
npm run lint
npm run build      # out/ klasörüne statik site
```

## Yapı
- `src/lib/domain/` — kurallar (takip, günlük aday seçimi, tekrar kontrolü, tarama sonucu dönüştürme), Türkiye saati.
- `src/lib/data/` — `CrmRepository` arayüzü; Supabase ve demo (bellek) uygulamaları.
- `src/app/` — ekranlar; `src/lib/actions.ts` — form işlemleri.
- `jobs/` — zamanlanmış işler: tarama, hatırlatma, takvim.
