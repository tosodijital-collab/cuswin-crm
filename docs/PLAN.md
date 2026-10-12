# Uygulama planı ve kararlar

> **Güncel mimari (2026-10-12, kullanıcı kararı):** VPS kullanılmayacak. Arayüz GitHub Pages (açık depo, statik),
> veri ve giriş Supabase (ücretsiz plan), zamanlanmış işler GitHub Actions, bildirim ntfy.sh. Aşağıdaki VPS/Docker
> Compose maddeleri bu karar ile geçersizdir.
> Güncelleme (2026-10-12 gece): GitHub zamanlayıcısı hiç tetiklenmediği için dakikalık işler Supabase pg_cron +
> Edge Function `tick`'e taşındı (README). GitHub Actions yalnızca Docker gerektiren taramayı çalıştırır ve `tick` tarafından
> tetiklenir. Ara verme (bugün/yarın/tarih/süresiz) eklendi. Bilinen ödün: Google, Actions IP'lerinden taramayı
> engelleyebilir (şu ana kadar engel yok); ücretsiz Supabase 7 gün hareketsiz kalırsa uyur (dakikalık iş bunu engeller).

## Veri kaynağı
- **Google Places API kalıcı CRM kaydı için uygun değil**: Google Maps Platform şartları içeriğin (ad, telefon, adres…)
  önbelleğe alınmasını/saklanmasını yasaklar; yalnızca `place_id` süresiz saklanabilir.
  https://developers.google.com/maps/documentation/places/web-service/policies
- **Birincil kaynak: Overture Maps Places** (CDLA-Permissive-2.0 / Apache-2.0; Meta, Microsoft, Foursquare…; aylık sürüm).
  Saklama ve dışa aktarma serbest, atıf gerekir. https://docs.overturemaps.org/guides/places/
- 2026-09-23.1 sürümünde Ankara merkez kutusunda (32.40–33.20 D, 39.70–40.15 K) hedef kategorilerde ~1.130 kayıt;
  %91 telefonlu, %59 web, %50 e-posta; ilçe çoğunlukla `addresses[].locality` içinde; 36 telefon birden fazla kayıtta (kontrole).
- Maps bağlantısı: API anahtarı gerektirmeyen `https://www.google.com/maps/search/?api=1&query=…` URL'si.
- **Kullanıcı kararı (2026-10-12): Google Maps taraması için `gosom/google-maps-scraper` (MIT, Docker, REST API) birincil kaynak.**
  Risk kullanıcıya bildirildi: Google şartlarına aykırı otomatik kazıma, IP engeli ve arayüz değişikliğinde kırılma olasılığı.
  Uygulama: iç ağda container, düşük eşzamanlılık (1–2), proxy yok, CAPTCHA aşma yok; engel/hata olursa iş durur ve
  Ayarlar ekranında görünür. `place_id` kaynak kimliği; Overture yedek ve tamamlayıcı kaynak olarak kalır.

## Maliyet
Overture: 0. gosom scraper: 0. pg-boss: 0. ntfy (self-hosted): 0.
**Kural (kullanıcı, 2026-10-12): uygulama tamamen ücretsiz olmalı; her zaman ücretsiz/self-hosted yol seçilir. Ücretli API/SaaS yok.**

## Aşamalar
1. **Frontend (şu an)** — Next.js 16 + TypeScript + Tailwind. Bellek içi DEMO deposu; iş kuralları saf fonksiyonlar
   (`src/lib/domain/rules.ts`) olarak yazıldı ve backend'de aynen kullanılacak.
2. **Backend** — PostgreSQL + migration, tek kullanıcılı giriş (kayıt ekranı yok), Overture içe aktarma, tekrar kontrolü.
3. **Worker** — **pg-boss** (kullanıcı kararı, PostgreSQL üzerinde kuyruk; ek servis yok): cron (Europe/Istanbul),
   singleton/tekillik, retry, yeniden başlatmada devam. Ek güvence olarak DB tekillik kısıtları
   (`daily_runs.date` PK, işletme başına tek açık görev, hatırlatma başına tek gönderim). Kaçırılan gün açılışta telafi.
4. **Bildirim** — **ntfy** (kullanıcı kararı, self-hosted container, Telegram yerine tek kanal). Erişim: `auth-default-access: deny-all`
   + yayın token'ı. iOS anlık bildirim için `upstream-base-url: https://ntfy.sh` (yalnızca mesaj kimliği iletilir).
   Gönderim kaydı + sınırlı tekrar; aynı hatırlatma bir kez.
5. **Dağıtım** — Docker Compose (app, worker, scraper, ntfy, yedek), mevcut reverse proxy arkasında doktor.toso.tr, yedek/geri yükleme testi.

## Google Takvim (kullanıcı isteği, 2026-10-12)
- Randevular kullanıcının Gmail takvimine yazılır. Yöntem: **servis hesabı** + takvimin bu hesapla
  "Etkinliklerde değişiklik yapma" izniyle paylaşılması. Ücretsiz; OAuth gerekmez, 7 günlük token süresi sorunu yok.
- Etkinlik kimliği randevu UUID'sinden türetilir (base32hex) → tekrar denemede kopya oluşmaz. Değişiklik PUT, iptal DELETE.
- Etkinlik süresi varsayılan 30 dk. Telefon bildirimi ntfy ile; takvim hatırlatması ek kolaylık.

## Yerel test modu
- `DATA_MODE=yerel`: gerçek taranan kayıtlar `.data/yerel.json` dosyasında; demo kayıtlar yok. PostgreSQL gelince kaldırılacak.
- Tarama: Ayarlar → "Google Maps'te tara". Kategori × ilçe sorguları sırayla, tarama başına en fazla 6 sorgu, limit ayarlanabilir.
- Aynı gün liste yeniden açılmaz; hedefin altında kalan gün yeni adaylarla tamamlanabilir (kopyasız).

## Kararlar
- `cacheComponents` kapalı: tüm ekranlar kişisel ve canlı veri; önbellek katmanı fayda değil karmaşıklık getirir.
- Tarih mantığı her yerde Europe/Istanbul; günler `YYYY-MM-DD` string olarak tutulur.
