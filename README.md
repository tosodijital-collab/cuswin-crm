# Cuswin Arama — satış CRM'i

Ankara'daki diş, estetik ve saç kliniklerini arama listesine çeviren, tek kullanıcılı satış CRM'i.
Canlı adres: doktor.toso.tr (kendi VPS). Gereksinimler: `docs/GEREKSINIMLER.md`, plan ve kararlar: `docs/PLAN.md`.

## Durum
**Aşama 1 — frontend (tamam).** Tüm ekranlar çalışır; veriler bellek içi **DEMO** deposundan gelir
(uydurma kayıtlar, sunucu yeniden başlayınca sıfırlanır). Giriş, PostgreSQL, pg-boss, gosom tarayıcısı ve ntfy
bildirimleri sonraki aşamada bağlanacak.

## Yerel test (gerçek veri)
`.env.example` dosyasını `.env.local` olarak kopyalayıp yolları doldurun, sonra:
```bash
npm run build && npx next start -p 3000 -H 0.0.0.0
```
Ayarlar → "Google Maps'te tara" ile klinikler eklenir; ana ekranda "Bugünün listesini şimdi hazırla".

## Geliştirme
```bash
npm install
npm run dev        # http://localhost:3000
npm test           # iş kuralı ve demo depo testleri
npm run typecheck
npm run lint
npm run build
```

## Yapı
- `src/lib/domain/` — tipler, Türkçe etiketler, Türkiye saati yardımcıları, telefon/web normalizasyonu,
  takip kuralları (`rules.ts`: ulaşılamadı → ertesi gün, 3. denemede beklemeye alma, günlük aday seçimi).
- `src/lib/data/` — `CrmRepository` arayüzü ve demo uygulaması. PostgreSQL deposu aynı arayüzü uygulayacak.
- `src/app/` — ekranlar (Bugün, Kayıtlar, İşletme, Randevular, Ayarlar), server action'lar, CSV/Excel dışa aktarma.
