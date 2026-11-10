// Satış kitinden ve pazarlama araştırmasından (10 Kasım 2026) uygulamaya taşınan kurallar ve metinler.
// Kaynak: Cuswin-Pazarlama/Cuswin-Saha-Kiti.pdf, 01-rakip-ve-pazarlama-arastirmasi.md

import type { Business, SalesStage } from "./types";

/** Konumlandırma: her görüşmede aynı hikâye. */
export const POSITIONING = {
  thesis: "Kliniklerin reklam sorunu yok, cevap sorunu var.",
  message: "Reklam veremiyorsunuz. O zaman gelen her mesaj, her arama altın değerinde. Cuswin hiçbirini kaçırmaz.",
  // Yönetmelikle uyumlu dil: "daha çok hasta getiriyoruz" değil.
  say: "Gelen hastayı kaçırmıyoruz.",
  rival: "Asıl rakip yazılım değil, maaş: bir hasta danışmanının maliyetiyle ve 7/24 çalışmasıyla karşılaştır.",
};

export const OBJECTIONS: { q: string; a: string }[] = [
  {
    q: "Hastalarım robotla konuşmak istemez.",
    a: "Hasta kiminle konuştuğuna değil, cevap alıp almadığına bakıyor. Gece cevap alamayan hasta sabahı beklemiyor, başka kliniğe yazıyor. İsterseniz her konuşmayı siz devralırsınız.",
  },
  {
    q: "Sekreterimiz var.",
    a: "Sekreteriniz kalıyor. Cuswin onun yetişemediği anlara bakıyor: ikinci hat, öğle arası, akşam, hafta sonu. Pilot klinikte mesajların yarısından fazlası mesai dışında geldi.",
  },
  {
    q: "Yanlış bir şey söylerse?",
    a: "Sadece sizin onayladığınız bilgilerle konuşur. Yayına almadan önce konuşmalarını birlikte dinliyoruz. Siz onay vermeden açılmıyor.",
  },
  {
    q: "Yapay zekaya güvenmiyorum.",
    a: "Haklısınız, çok abartan var. Söz vermiyorum, gösteriyorum. Az önce kendi telefonunuzdan yazdınız, cevabı gördünüz.",
  },
  {
    q: "Pahalı.",
    a: "Bir satış danışmanının maaşıyla kıyaslayalım. Cuswin 7/24 çalışıyor, izne çıkmıyor. Ayda bir hasta kurtarması masrafını çıkarıyor mu, birlikte bakalım.",
  },
  {
    q: "Zaten CRM'imiz var.",
    a: "CRM kayıt tutar, mesaja cevabı yine siz verirsiniz. Cuswin cevap veriyor, aramayı karşılıyor, takibi yapıyor. Kaydı da tutuyor.",
  },
  {
    q: "Reklam ajansımız var.",
    a: "Çok iyi. Ajansın getirdiği hastayı kaçırmamak için tam da bu var. İsterseniz ajansınızla da konuşurum.",
  },
  {
    q: "KVKK sorun olur mu?",
    a: "Hesaplar şifre paylaşmadan, resmî yetkilendirmeyle bağlanıyor. Veri sizin, ayrılırsanız sizde kalıyor.",
  },
  {
    q: "Şu an vaktim yok.",
    a: "Kurulumla siz uğraşmıyorsunuz. Sizden 1 saat istiyorum: fiyat listesi ve onay görüşmesi. Gerisini biz yapıyoruz.",
  },
  {
    q: "Kimler kullanıyor?",
    a: "Dürüst ol: Ankara'da bir estetik ve KBB kliniği 1 aydır kullanıyor, rakamlarını gösterdim. Erken başlayan klinikleri bizzat takip ediyoruz.",
  },
  {
    q: "Düşüneyim.",
    a: "Tabii. Ne olursa evet dersiniz? (Gerçek itirazı öğren.) Perşembe sizi arayayım mı? (Tarih koy.)",
  },
  {
    q: "Fiyat ne kadar?",
    a: "Mesaj ve arama yoğunluğunuza göre değişiyor; teklif şablonunu göster. Netleşmiş rakamı söyle, uydurma.",
  },
];

export const DO_RULES = [
  "Önce dinle, sonra göster, en son anlat.",
  "\"Yapay zeka\" deme, sonucu söyle: gece gelen mesaja 3 saniyede cevap, randevu takvimde.",
  "Kurulumu bizim yaptığımızı söyle.",
  "Her görüşmenin sonunda tarih koy.",
  "Her görüşmenin sonunda tanıştırma iste.",
];

export const DONT_RULES = [
  "Uydurma rakam ya da müşteri söyleme.",
  "Pilot kliniğin adını söyleme.",
  "Rakipleri kötüleme.",
  "Sekreteri atlama, küçümseme.",
  "Muayene saatinde ısrar etme.",
  "Tıbbi ya da hukuki kesin hüküm verme.",
];

/** Görüşmeden sonraki takip mesajları (satış kiti). Bundan sonra cevap yoksa bırak, 3 ay sonra tekrar dene. */
export const FOLLOW_UPS = [
  {
    id: "gun-3",
    label: "3. gün mesajı",
    when: "3 gün sonra, \"düşüneyim\" diyenlere",
    text: "Merhaba, kısa bir not: pilot kliniğimizde mesai dışında gelen 464 konuşmanın 462'si karşılandı. Sizin için de başlatalım mı?",
  },
  {
    id: "hafta-2",
    label: "2. hafta mesajı",
    when: "2 hafta sonra, son dokunuş",
    text: "Merhaba, uygun olduğunuz bir gün 10 dakikada canlı gösterebilirim. Ne zaman müsaitsiniz?",
  },
] as const;

const FUNNEL_STEPS: { stage: SalesStage; label: string }[] = [
  { stage: "iletisim_kuruldu", label: "İletişim" },
  { stage: "randevu_alindi", label: "Randevu" },
  { stage: "gorusme_yapildi", label: "Görüşme" },
  { stage: "teklif_gonderildi", label: "Teklif" },
  { stage: "musteri_oldu", label: "Müşteri" },
];
const ORDER: SalesStage[] = ["yeni_aday", ...FUNNEL_STEPS.map((s) => s.stage)];

export type FunnelStep = { label: string; count: number; /** Bir önceki adımdan geçiş yüzdesi. */ rate?: number };

/**
 * Satış hunisi: her adıma en az o aşamaya ulaşmış klinik sayısı. "Olumsuz" sonuçlananların hangi aşamada
 * düştüğü kayıtlı olmadığı için yalnızca toplamda sayılır.
 */
export function salesFunnel(businesses: Pick<Business, "salesStage">[]): { total: number; lost: number; steps: FunnelStep[] } {
  const reached = (stage: SalesStage) =>
    businesses.filter((b) => b.salesStage !== "olumsuz" && ORDER.indexOf(b.salesStage) >= ORDER.indexOf(stage)).length;
  let prev = businesses.length;
  const steps = FUNNEL_STEPS.map(({ stage, label }) => {
    const count = reached(stage);
    const step = { label, count, rate: prev > 0 ? Math.round((count / prev) * 100) : undefined };
    prev = count;
    return step;
  });
  return { total: businesses.length, lost: businesses.filter((b) => b.salesStage === "olumsuz").length, steps };
}

// ---------- Telefon: randevu alma senaryosu (Cuswin-Arama-Senaryosu.pdf ile aynı) ----------

export type Line = { who: string; text: string; tone?: "them" | "close" };
export type Branch = { title: string; lines: Line[]; tip?: string };

export const PHONE_GOAL =
  "Telefonda tek amaç 10 dakikalık yüz yüze görüşme tarihi almak. Satış yapmıyorsun, ürünü anlatmıyorsun; ikna yüz yüze demoda olur.";

export const PHONE_FLOW = [
  { step: "Açılış", text: "Kim olduğun ve neden aradığın, 15 saniye." },
  { step: "Tek soru", text: "\"Akşam gelen mesajlara kim bakıyor?\"" },
  { step: "İki seçenek", text: "\"Perşembe 14:00 mü, 16:00 mı?\"" },
  { step: "Teyit", text: "Tarihi tekrar et, WhatsApp'tan teyit at." },
] as const;

export const PHONE_SCENARIOS: { id: string; title: string; opening: Line; note?: string; branches: Branch[] }[] = [
  {
    id: "sekreter",
    title: "Sekreter açtı",
    opening: {
      who: "Açılış",
      text: "Merhaba, ben [adın], Cuswin'den. Kısa tutacağım. Kliniklere gelen telefon, WhatsApp ve Instagram mesajlarına cevap veren bir sistem kurduk; Ankara'da bir klinikte 1 aydır çalışıyor. Doktor bey/hanıma kliniğinizde 10 dakika yüz yüze göstermek istiyorum. Adınızı alabilir miyim?",
    },
    note: "Kurucu arıyorsa: \"ben Özkan, Cuswin'in kurucusuyum\". Sekreteri yanına al, adıyla hitap et.",
    branches: [
      {
        title: "\"Konu nedir?\" / \"Ne satıyorsunuz?\"",
        lines: [
          {
            who: "Sen",
            text: "Siz hastayla ilgilenirken çalan telefona, öğle arasında ve akşam gelen mesajlara cevap veriyor, randevuyu takvime yazıyor. Sizin işinizi almıyor; yetişemediğiniz anlara bakıyor. Akşam ve hafta sonu gelen mesajlara şu an kim bakıyor?",
          },
        ],
        tip: "\"Kimse\" ya da \"ertesi sabah\" derse: \"Tam bunun için. Perşembe 14:00 mü uygun, 16:00 mı?\"",
      },
      {
        title: "\"Doktor ameliyatta / muayenede / yok\"",
        lines: [
          {
            who: "Sen",
            text: "Anlıyorum, rahatsız etmeyeyim. Randevuyu sizden alabilir miyim? Perşembe öğleden sonra o bölgedeyim: 14:00 mü daha uygun, 16:00 mı? 10 dakika sürecek.",
          },
          {
            who: "\"Doktora sormam lazım\" derse",
            tone: "them",
            text: "Tabii. Perşembe 14:00'ü sizin için not ediyorum; doktor bey uygun değilse bana bu numaradan yazın. Ya da yarın 11:00'de sizi ben arayayım mı?",
          },
        ],
        tip: "Her durumda bir tarih bırak: ya randevu ya geri arama saati (Sonuç → Konuştum, sonra ara).",
      },
      {
        title: "\"Bilgi gönderin\" / \"Mail atın\"",
        lines: [
          {
            who: "Sen",
            text: "Hemen WhatsApp'tan tanıtım dosyasını atıyorum. Ama asıl farkı 10 dakikada doktor beyin kendi telefonundan yazıp cevabı görmesi; dosyada bu görünmüyor. Perşembe o bölgedeyim, 14:00'te uğrayayım mı?",
          },
        ],
        tip: "Sonuç → Tanıtımı gönder. Tarih yine yoksa Sonuç → Konuştum, sonra ara: 2 gün sonrası.",
      },
    ],
  },
  {
    id: "doktor",
    title: "Doktor açtı",
    opening: {
      who: "Açılış",
      text: "Merhaba Doktor Bey/Hanım, ben [adın], Cuswin'den. 30 saniyenizi alacağım. Ankara'da bir estetik kliniğinde 1 aydır çalışan bir sistemimiz var: 30 günde 2.934 mesaj ve arama gelmiş, yarısından fazlası mesai saatleri dışında. Mesai dışında gelen 464 konuşmanın 462'sine cevap verildi. Sizde akşam gelen mesajlara kim bakıyor?",
    },
    branches: [
      {
        title: "Kapanış",
        lines: [
          {
            who: "Sen",
            tone: "close",
            text: "Bunu anlatmak yerine göstermek istiyorum: kendi telefonunuzdan hasta gibi yazacaksınız, cevabı göreceksiniz. 10 dakika. Perşembe 14:00 mü, 16:00 mı?",
          },
        ],
      },
    ],
  },
];

export const PHONE_OBJECTIONS: { q: string; a: string; app?: string }[] = [
  {
    q: "İlgilenmiyoruz.",
    a: "Anlıyorum. Tek bir şey sorayım: akşam ve hafta sonu gelen mesajlara kim bakıyor? (Hâlâ hayırsa) Teşekkür ederim, iyi çalışmalar.",
    app: "Sonuç → İlgilenmiyor",
  },
  {
    q: "Sekreterimiz var, yetişiyoruz.",
    a: "Sekreteriniz kalıyor. Bu, ikinci hat çalarken, öğle arasında, akşam ve hafta sonu devreye giriyor. Pilot klinikte mesajların yarısından fazlası mesai dışında geldi. 10 dakikada görün, sonra karar verin.",
  },
  {
    q: "Zaten bir sistemimiz / CRM'imiz var.",
    a: "Çok iyi. CRM kaydı tutar, cevabı yine siz verirsiniz. Bu cevabı veriyor, aramayı karşılıyor, takibi yapıyor. Yan yana görmek için 10 dakika yeter.",
  },
  { q: "Reklam ajansımız var.", a: "Ajansın getirdiği hastayı kaçırmamak için tam da bu var. İsterseniz ajansınızla da konuşurum." },
  {
    q: "Fiyatı ne?",
    a: "Mesaj ve arama yoğunluğunuza göre değişiyor; görüşmede yoğunluğunuza bakıp net söylüyorum. Uydurma rakam vermek istemem. (Tarihe dön.)",
  },
  {
    q: "Yapay zeka mı? Hastalar sevmez.",
    a: "Hasta kiminle konuştuğuna değil, cevap alıp almadığına bakıyor. Gece cevap alamayan hasta sabahı beklemiyor. Her konuşmayı siz görüyorsunuz, istediğiniz an devralıyorsunuz.",
  },
  { q: "Şu an çok yoğunuz.", a: "O yüzden 10 dakika. Kurulumla siz uğraşmıyorsunuz, biz yapıyoruz. Hangi gün daha sakin, ona göre geleyim." },
  { q: "Sonra arayın.", a: "Tabii. Perşembe mi uygun, cuma mı? Saat? (Tarihsiz kapatma.)", app: "Sonuç → Konuştum, sonra ara" },
  { q: "Bizi aramayın.", a: "Anlaşıldı, kaydınızı kapatıyorum. İyi çalışmalar.", app: "Sonuç → Diğer sonuç → Tekrar iletişim kurma" },
];

export const CLINIC_TYPE_LINES: { id: string; title: string; hook: string; question: string; note: string }[] = [
  {
    id: "estetik",
    title: "Estetik ve medikal estetik",
    hook: "Instagram'da gönderilerinizin altına \"fiyat?\" yazan hastalara kim, ne zaman dönüyor? Reklam veremediğiniz bir dönemde o mesajlar en değerli hastanız.",
    question: "Botoks ya da dolgu soran biri akşam 22:00'de yazınca ne oluyor?",
    note: "Pilot klinik bu alanda; rakamları rahatça kullan.",
  },
  {
    id: "sac",
    title: "Saç ekimi",
    hook: "Saç ekiminde hasta karar vermeden önce birkaç kliniğe birden yazıyor: kaç greft, hangi teknik, fiyat. İlk cevap veren kliniğe gidiyor. Gece gelen o mesaja kaç saatte dönebiliyorsunuz?",
    question: "Operasyondan sonra hastaya kontrol ve hatırlatma mesajlarını kim atıyor?",
    note: "Dürüst ol: pilot klinik estetik ve KBB; saç ekiminde ilk klinikleri şimdi alıyoruz. Rakam uydurma.",
  },
  {
    id: "dis",
    title: "Diş",
    hook: "Hasta \"implant ne kadar?\" diye aradığında hat meşgulse ya da muayenedeyseniz o arama geri dönüyor mu? Cevapsız kalan arama, başka kliniğe giden hasta demek.",
    question: "Gün içinde kaç arama cevapsız kalıyor, geri arıyor musunuz?",
    note: "Pilot estetik kliniği, rakamlar oradan; dürüst söyle.",
  },
];

/** Ulaşamayınca cep numarasına gönderilen WhatsApp mesajı (henüz görüşülmemiş klinik). */
export const MISSED_CALL_TEXT =
  "Merhaba, Cuswin'den yazıyorum. Sizi aradım, ulaşamadım. Kliniklere gelen telefon, WhatsApp ve Instagram mesajlarına cevap veren sistemimizi 10 dakikada yüz yüze göstermek istiyorum. Bu hafta hangi gün uygun?";

/** Randevu teyidi: "Perşembe 12 Kasım saat 14:00'te kliniğinizdeyiz..." */
export function confirmationText(when: string): string {
  return `Merhaba, ${when}'te kliniğinizdeyiz. 10 dakika sürecek. Görüşmek üzere. Cuswin`;
}
