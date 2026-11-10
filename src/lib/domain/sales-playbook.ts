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
