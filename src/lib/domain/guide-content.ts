// Rehber içeriği: kapıda adım adım konuşma, doktorun soracağı ürün soruları ve rakiplere cevaplar.
// Ürün bilgisi Cuswin panelinde gerçekten olan özelliklerden ve tanıtım dosyasından alınmıştır; rakam uydurulmaz,
// pilot klinikten yalnızca "%53 mesai dışı" söylenir, klinik adı söylenmez, rakip kötülenmez.

export type DoorStep = { title: string; time: string; say: string[]; tips: string[]; demo?: boolean };

/** Kapıda / yüz yüze görüşme: 10 dakikalık akış. */
export const DOOR_STEPS: DoorStep[] = [
  {
    title: "Kapıda",
    time: "30 sn",
    say: [
      "Merhaba, ben Özkan, Cuswin'in kurucusuyum. Doktor bey/hanımla 10 dakika görüşmek için geldim.",
    ],
    tips: [
      "Randevu varsa ekle: \"Saat __ için konuşmuştuk.\"",
      "Sekreteri adıyla an, yanına al; sorunu en iyi o bilir.",
      "Doktor müsait değilse ısrar etme: 15 dakikalık bir saat al, broşürü bırak.",
    ],
  },
  {
    title: "Açılış",
    time: "30 sn",
    say: [
      "Ankara'da bir klinikte Cuswin'i 1 aydır kullanıyoruz. Gelen hasta mesajlarının %53'ü mesai saatleri dışında geliyor. Sizde durum nasıl?",
    ],
    tips: ["Pilot kliniğin adını hiçbir koşulda söyleme: \"Ankara'da bir estetik ve KBB kliniği.\""],
  },
  {
    title: "Sor ve dinle",
    time: "2 dk",
    say: [
      "Günde aşağı yukarı kaç mesaj, kaç arama geliyor?",
      "Akşam ve hafta sonu gelen mesajlara kim bakıyor?",
      "Fiyat sorup \"düşüneyim\" diyen hastaya geri dönülüyor mu?",
    ],
    tips: ["Konuşmanın çoğunu o yapsın. Cevapları \"Uğradım\"daki \"Ne öğrendin?\" ile işaretle."],
  },
  {
    title: "Canlı demo",
    time: "3 dk",
    say: [
      "Anlatmak yerine göstereyim: kendi telefonunuzdan hasta gibi yazın.",
      "(Cevap geldikten sonra) Bu cevabı sizde şu an kim, ne kadar sürede veriyor?",
    ],
    tips: ["QR'ı doktorun kendi telefonuna okut. Cevap saniyeler içinde gelir; sus, okumasını bekle.", "Sonra paneli göster: konuşma kayıtlı, takip planı hazır."],
    demo: true,
  },
  {
    title: "Güven",
    time: "2 dk",
    say: [
      "Kurulumu ben yapıyorum. Siz onay vermeden hiçbir şey açılmıyor.",
      "Sadece sizin onayladığınız bilgilerle konuşur, tıbbi tavsiye vermez. Her konuşmayı görürsünüz, istediğiniz an devralırsınız.",
      "Hasta verisi sizindir; bırakırsanız kayıtlar sizde kalır.",
    ],
    tips: ["Yapay zeka diye açma; sonucu söyle: gelen hastaya hemen dönülüyor, randevu takvimde."],
  },
  {
    title: "Kapanış",
    time: "2 dk",
    say: [
      "Kurulum 3 gün sürüyor. Hangi gün başlayalım, pazartesi mi çarşamba mı?",
      "(Düşüneyim derse) Tabii. Ne olursa evet dersiniz? Perşembe sizi arayayım mı?",
      "(Her durumda) Bu sorunu yaşayan tanıdığınız başka klinik var mı?",
    ],
    tips: ["Tarih koymadan çıkma. Fiyatı yoğunluğa bakıp yüz yüze söyle; uydurma rakam verme."],
  },
  {
    title: "Çıkınca",
    time: "1 dk",
    say: [],
    tips: [
      "Uygulamada \"Uğradım: sonucu yaz\": sonuç, öğrendiklerin, takip günü ve tanıştırılan klinik.",
      "Tanıtım dosyasını aynı gün WhatsApp'tan gönder; panel kendiliğinden açılır.",
    ],
  },
];

export type ProductQA = { q: string; a: string[] };

/** Doktorun demoda soracakları. */
export const PRODUCT_QA: ProductQA[] = [
  {
    q: "Ne yapıyor?",
    a: [
      "Karşılar: Instagram, WhatsApp ve telefondan gelen her hastaya saniyeler içinde, kliniğin üslubuyla cevap verir. Gece de, hafta sonu da.",
      "Randevuya çevirir: hastanın ne istediğini anlar, uygun saati önerir, randevuyu yazar ve bir gün önce hatırlatır.",
      "Unutmaz: düşünen, gelmeyen ya da işlem olan hastayı belirlenen planla nazikçe takip eder.",
    ],
  },
  {
    q: "Hangi kanallar?",
    a: [
      "Instagram mesajları, WhatsApp, telefon (sesli asistan) ve Facebook/Instagram form reklamları tek panelde.",
      "Instagram otomasyonu: gönderi yorumuna ya da hikâye cevabına otomatik mesaj.",
    ],
  },
  {
    q: "Takip nasıl yapılıyor?",
    a: [
      "Hazır planlar var; her adımın günü, saati ve mesajı değiştirilebilir, hastaya özel de ayarlanabilir.",
      "Sıkı takip (1, 3, 7, 14, 21, 30, 60. gün) ve esnek takip (3, 14, 30. gün).",
      "İşlem ve ameliyat sonrası bakım: kontrol, Google yorum isteği, fotoğraf ve tanıştırma adımlarıyla bir yıl.",
      "Ameliyat öncesi: 7 gün ve 1 gün önce belge ve saat teyidi.",
    ],
  },
  {
    q: "Eski hastalar?",
    a: [
      "Kontrol zamanını hatırlatır; uzun süredir gelmeyeni sesli asistan nazikçe arar, randevu isteyen olursa sekretere görev düşer.",
      "Seçilen hastalara toplu mesaj (kampanya, duyuru); göndermeden önce siz görürsünüz.",
      "Memnun hastaya Google yorum bağlantısı gider; memnun olmayanın görüşü önce size ulaşır.",
    ],
  },
  {
    q: "Kontrol bende mi?",
    a: [
      "Her konuşma panelde kayıtlı. İstediğiniz an devralırsınız; siz yazarken asistan susar.",
      "Yalnızca onayladığınız bilgilerle konuşur, fiyat uydurmaz, tıbbi tavsiye vermez; tıbbi soru ve acil durumu size iletir.",
      "Asistanın adını, üslubunu (sıcak, dengeli, resmî) ve cevap uzunluğunu siz seçersiniz.",
    ],
  },
  {
    q: "Panelde ne görürüm?",
    a: [
      "Hasta akışı panoları: yeni talepler, işlem takibi, ameliyat takibi.",
      "Gelen kutusu: tüm mesajlar ve aramalar tek yerde.",
      "Genel bakış: gelen hasta, randevu alan, randevuya gelen ve işlem olan hasta sayıları.",
    ],
  },
  {
    q: "Kurulum nasıl, ne kadar sürer?",
    a: [
      "3 gün. Kurulumu biz yapıyoruz; hesaplar şifre paylaşmadan, resmî yetkilendirmeyle bağlanır.",
      "Sizden: hizmet ve fiyat listesi, çalışma saatleri, hesap yetkileri, takip tercihleri, yaklaşık 1 saatlik onay görüşmesi.",
      "Konuşmaları birlikte test ederiz; siz onaylamadan yayına çıkmaz.",
    ],
  },
  {
    q: "KVKK, veri kimde?",
    a: ["Hasta verisi kliniğe aittir, kimseyle paylaşılmaz. Çalışmayı bırakırsanız kayıtlarınız sizinle kalır."],
  },
  {
    q: "Fiyatı ne?",
    a: ["Mesaj ve arama yoğunluğuna göre değişiyor; yoğunluğa bakıp net rakamı yüz yüze söylüyoruz. Uydurma rakam verme."],
  },
];

export type Competitor = { names: string; what: string; say: string };

/** "Zaten X kullanıyoruz" diyene. Rakip kötülenmez; fark söylenir, sonra demoya dönülür. */
export const COMPETITORS: Competitor[] = [
  {
    names: "Sekreter / hasta danışmanı",
    what: "Asıl rakip maaş: kliniklerin çoğu bu işi bir çalışanla çözmeye çalışıyor.",
    say: "Sekreteriniz kalıyor. Cuswin onun yetişemediği anlara bakıyor: ikinci hat, öğle arası, akşam, hafta sonu. Bir danışmanın maaşıyla kıyaslayın; 7/24 çalışıyor, izne çıkmıyor.",
  },
  {
    names: "Kommo, Planports gibi CRM'ler",
    what: "Mesajları bir yerde toplayıp kayıt tutuyorlar; cevabı çoğunlukla yine ekip veriyor.",
    say: "Güzel, kayıt tarafı hazır. Peki gelen mesaja cevabı kim veriyor, telefonu kim karşılıyor? Cuswin cevabı veriyor, aramayı karşılıyor, takibi yapıyor. Yan yana görmek için 10 dakika yeter.",
  },
  {
    names: "Sesli asistan / çağrı merkezi yazılımları",
    what: "Telefona bakıyorlar; Instagram ve WhatsApp mesajları ayrı kalıyor.",
    say: "Telefon tarafı güzel. Instagram ve WhatsApp'tan gelenlere kim bakıyor? Cuswin telefonu ve mesajları tek yerde karşılıyor; kurulumu da kliniğinize özel biz yapıyoruz.",
  },
  {
    names: "DentalBulut, DentSoft, Estesoft gibi klinik yazılımları",
    what: "Randevu ve hasta kaydı yönetimi; takip ve satış yapmıyorlar. Rakip değil, tamamlayıcı.",
    say: "Takvim ve kayıt orada kalsın. Cuswin hastayı o randevuya getiriyor ve sonrasını takip ediyor.",
  },
  {
    names: "Reklam / sağlık turizmi ajansları",
    what: "Lead getirip bırakıyorlar; randevuya çevirmek onların işi değil. Olası ortak.",
    say: "Çok iyi. Ajansın getirdiği hasta yazınca kaç dakikada cevap alıyor? Cuswin tam o hastayı kaçırmamak için var. İsterseniz ajansınızla da konuşurum.",
  },
];

/** En sık duyulan itirazlar (Rehber'de en üstte). OBJECTIONS'taki soru metinleriyle aynı. */
export const TOP_OBJECTIONS = ["Sekreterimiz var.", "Pahalı.", "Düşüneyim.", "Hastalarım robotla konuşmak istemez.", "Şu an vaktim yok."];
