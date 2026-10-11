# Cuswin Satış CRM — Gereksinimler (özet, 2026-10-12)

Kaynak: kullanıcının verdiği tam brif. Bu dosya bağlayıcı özettir; kapsam dışı maddeler kendiliğinden eklenmez.

## Amaç
Ankara'daki doktor/klinikleri bulup günlük arama listesi oluşturan, görüşme sonuçlarını, notları ve
Cuswin tanıtım randevularını yöneten **tek kullanıcılı satış CRM'i**. Hasta yönetim sistemi değildir.
Akış: işletmeyi bul → günlük listeye ekle → görüşmeyi kaydet → takip et → randevuyu hatırlat → satış sonucunu kaydet.

## Hedef
- Konum Ankara. Kategoriler: estetik klinikleri, diş klinikleri/diş hekimleri, saç sağlığı klinikleri, saç ekim merkezleri.
- Bir işletmeye birden fazla kategori. Kategori ve ilçe filtreleri. Kuaför, güzellik ürünü mağazası vb. alınmaz.

## Veri
- Saklama/dışa aktarma hakkı olmayan veri kalıcı tutulmaz. Ücretli servis izinsiz alınmaz. CAPTCHA/engel aşma yok.
- Alanlar: ad, varsa ilgili kişi, kategoriler, işletme telefonu, açıkça yayımlanmış e-posta, web, ilçe, adres,
  Maps bağlantısı, kaynak + kaynak kimliği, bulunma ve son doğrulama tarihi.
- Eksik bilgi uydurulmaz. WhatsApp doğrulanmadan işaretlenmez. Kişisel/hasta verisi toplanmaz.
- Telefonsuz veya kategorisi belirsiz kayıt: "Eksik bilgi / Kontrol gerekli"; günlük hedefe girmez.

## Tekrar önleme
- Günlük hedef 20 **farklı işletme**; kişiler işletmeye bağlanır.
- Kaynak kimliği, normalize telefon, web sitesi, adres ile kontrol; sadece benzer isimle birleştirme yok.
  Şubeler ayrı; ortak telefon gibi belirsizlikler kontrole işaretlenir.
- Yeni veri geldiğinde notlar/durum/geçmiş korunur. Aranmış, müşteri olmuş, "iletişim kurma" işaretli kayıtlar yeni aday olmaz.

## Günlük otomasyon
- Her gün 09.00 (Europe/Istanbul) 20 yeni aranabilir işletme hazır. Hedef, kategori, ilçe ayarlanabilir.
- Aynı gün tekrar çalışınca yeni liste/tekrar kayıt yok. Tarayıcıdan bağımsız. Kaçırılan gün kontrollü telafi.
- Yetersiz aday: gerçek sayı + neden; sahte/tekrar kayıtla doldurma yok.
- Yeni adaylar ve takipler ayrı. Son çalışma, bulunan sayı, hata görünür. Manuel çalıştırma aynı kurallarla.

## Arama ve satış takibi
- Arama durumları: Aranacak, Ulaşılamadı, Tekrar aranacak, Görüşüldü, İlgilenmiyor, Beklemeye alındı, Tekrar iletişim kurma.
- Satış aşamaları: Yeni aday, İletişim kuruldu, Randevu alındı, Görüşme yapıldı, Teklif gönderildi, Müşteri oldu, Olumsuz sonuçlandı.
- Her deneme tarih/saat/sonuç/notla geçmişe. Hatalı işlem düzeltilebilir; geçmiş sessizce silinmez.
- İlgilenmiyor / Tekrar iletişim kurma otomatik listelere dönmez.

## Takip kuralları
- Ulaşılamadı → ertesi gün "Dünden kalanlar".
- 3 ardışık başarısız deneme → otomatik "Beklemeye alındı"; manuel yeniden açılabilir. Başarılı iletişimde sayaç sıfırlanır.
- Tekrar aranacak → tarih + isteğe bağlı saat; o gün görünür.
- Hiç aranmamış, günü geçmiş görevler "Gecikenler"de kalır.
- İşletme başına tek açık arama görevi. Randevulu / teklif takibindeki kayıtlar yeni arama listesine dönmez.

## Randevu ve hatırlatma
- Tarih-saat, görüşülecek kişi, tür (telefon/çevrim içi/yüz yüze), bağlantı veya adres, kısa not.
- Hatırlatma varsayılan 30 dk önce (ayarlanabilir), uygulama kapalıyken de ulaşır, tek dış kanal (Telegram önerildi).
- Başarısızlık kaydı + kontrollü tekrar; aynı hatırlatma tekrar gönderilmez. Değişiklikte eski iptal/yeni oluşur;
  iptal randevuya bildirim yok. Geçmiş randevular sonuç girmek için görünür.

## Arayüz
- Türkçe, sade, mobil uyumlu. Ana ekran: (1) Bugün aranacak yeniler, (2) Takipler: dünden kalanlar/gecikenler/bugüne planlananlar, (3) Bugünkü randevular.
- Tüm kayıtlar arama/filtre, randevu listesi, otomasyon ve bildirim ayarları, CSV/Excel dışa aktarma, manuel ekleme/düzeltme.
- Sayılar: yeni adaylar, aramalar, bekleyen takipler, randevular, kazanılan müşteriler. Grafik/animasyon/çok katmanlı menü yok.

## Teknik
- Kendi VPS, doktor.toso.tr. TypeScript, Next.js, PostgreSQL, Docker Compose. Mikroservis yok.
- Güvenli giriş (kayıt ekranı yok), HTTPS, sunucu tarafı yetki, migration, kalıcı/tekrarsız zamanlanmış işler,
  Türkiye saati, anahtarlar yalnız sunucuda, girdi doğrulama, kota/zaman aşımı/hata yönetimi, tarama limiti,
  loglarda gizli bilgi yok, otomatik yedek + denenmiş geri yükleme, yeniden başlatmada devam, mevcut servisleri bozmayan dağıtım.
- Deterministik işlere yapay zekâ yok.

## Kapsam dışı (ilk sürüm)
Otomatik toplu WhatsApp/SMS/e-posta, otomatik arama, hasta kayıtları, ekip/rol/çok kiracılı yapı, satış tahmini/AI puanlama,
faturalama/ödeme, reklam yönetimi.

## Kabul senaryoları
Tekrar taramada kopya yok · 20 yeni aday takiplerden ayrı · telefonsuz kayıt hedefe girmiyor · ulaşılamayan ertesi güne,
3.'de beklemeye · planlı arama doğru gün · gecikenler kaybolmuyor · randevu oluştur/değiştir/iptal hatırlatmayı doğru etkiliyor ·
uygulama kapalıyken bildirim · yeniden başlatmada veri/görev korunuyor · yetkisiz erişim yok · mobil arama+not akışı ·
dışa aktarma · yedekten geri yükleme. Demo ve gerçek veri ayrı. Doğrulanamayan şey çalışıyor diye sunulmaz.

**Başarı ölçütü:** Sabah açınca kimi arayacağımı, kimi takip edeceğimi, hangi randevularım olduğunu hemen görmek;
sonucu birkaç tıklamayla kaydetmek.
