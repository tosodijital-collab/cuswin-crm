# Cuswin Arama — satış CRM'i

Ankara'daki diş, estetik ve saç kliniklerini Google Maps'ten bulup günlük arama listesine çeviren, görüşme
sonuçlarını, takipleri ve tanıtım randevularını yöneten tek kullanıcılı satış CRM'i.
Gereksinimler: `docs/GEREKSINIMLER.md` · Plan ve kararlar: `docs/PLAN.md`.

## Mimari (tamamen ücretsiz)
- **Arayüz:** Next.js statik çıktı → **GitHub Pages** (`.github/workflows/deploy.yml`).
- **Veri ve giriş:** **Supabase** (PostgreSQL + Auth). Kayıt kapalı; yalnızca `app_owner` tablosundaki kullanıcı
  erişir (RLS). Şema: `supabase/migrations/`.
- **Zamanlanmış işler:** **GitHub Actions** (`.github/workflows/jobs.yml`, `jobs/run.ts`)
  - her sabah 08.00: Google Maps taraması (gosom/google-maps-scraper Docker) + günün arama listesi
  - 5 dakikada bir: kaçırılan liste telafisi, "şimdi tara" istekleri, ntfy hatırlatmaları, Google Takvim eşitleme
- **Bildirim:** ntfy.sh (telefon uygulaması, gizli konu adı).

Supabase ayarlı değilken arayüz tarayıcıda **demo** verisiyle çalışır.

## GitHub ayarları
Repository variables: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `APP_URL`, `BASE_PATH` (özel alan adı yoksa `/cuswin-crm`).
Repository secrets: `SUPABASE_SECRET_KEY`, `NTFY_TOPIC`, isteğe bağlı `GOOGLE_SERVICE_ACCOUNT_JSON`, `GOOGLE_CALENDAR_ID`.

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
