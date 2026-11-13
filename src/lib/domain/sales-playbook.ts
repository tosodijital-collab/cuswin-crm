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

// ---------- Telefon: randevu alma senaryosu (Rehber → Telefon ve aramadaki kart) ----------
// Metinlerde "{gün}" saha gününün adıyla değiştirilir (ör. "Cuma").

export type Line = { who: string; text: string; tone?: "them" | "close" };
export type Branch = { title: string; lines: Line[]; tip?: string };
export type Question = { text: string; /** Cevaba göre ne yapacağın. */ listen: string };

/** "{gün}" yerine günün adını koyar. */
export function withDay(text: string, day: string): string {
  return text.replaceAll("{gün}", day);
}

export const PHONE_GOAL =
  "Telefonda tek amaç: 10 dakikalık yüz yüze görüşme tarihi. Satma, uzun anlatma. Sor, sus, dinle; sonra iki saat seçeneği ver.";

export const PHONE_FLOW = [
  { step: "Açılış", text: "Kim olduğun, izin iste. 15 saniye." },
  { step: "Sor", text: "3 kısa soru. Sor ve sus, cevabı dinle." },
  { step: "Bağla", text: "Onun cevabını kullan: \"Tam bunun için arıyorum.\"" },
  { step: "Tarih iste", text: "İki seçenek: \"14:00 mü, 16:00 mı?\"" },
  { step: "Teyit", text: "Saati tekrar et, WhatsApp'tan teyit at." },
] as const;

export type PhoneScenario = {
  id: "sekreter" | "doktor";
  title: string;
  opening: string;
  note: string;
  questions: Question[];
  bridge: string;
  close: string;
  confirm: string;
  /** Sık karşılaşılan durumlar (yalnız sekreter). */
  branches: Branch[];
};

export const PHONE_SCENARIOS: PhoneScenario[] = [
  {
    id: "sekreter",
    title: "Sekreter açtı",
    opening:
      "Merhaba, iyi günler. Ben Özkan, Cuswin'in kurucusuyum. Çok kısa bir şey soracağım, bir dakikanızı alabilir miyim? Kiminle görüşüyorum?",
    note: "Adını al ve hep adıyla hitap et. Sekreter kapıdaki bekçi değil, en büyük yardımcın: sorunu en iyi o biliyor.",
    questions: [
      {
        text: "Gün içinde telefona ve WhatsApp'a siz mi bakıyorsunuz?",
        listen: "\"Evet\" derse: \"Kolay gelsin, yoğun oluyordur.\" Onu yanına al.",
      },
      {
        text: "Siz hastayla ilgilenirken telefon çalarsa ya da aynı anda birkaç mesaj gelirse ne oluyor?",
        listen: "\"Bekliyor\", \"sonra dönüyoruz\" derse sorun bu. Aklında tut.",
      },
      {
        text: "Akşam ve hafta sonu gelen mesajlara kim bakıyor?",
        listen: "\"Kimse\" ya da \"sabah bakıyoruz\" derse hemen bağla.",
      },
    ],
    bridge:
      "Tam bunun için arıyorum. Sizin işinizi almıyor; siz yetişemediğinizde devreye giriyor. Hastaya saniyeler içinde cevap veriyor, randevuyu takvime yazıyor, sabah her şey önünüzde hazır oluyor.",
    close:
      "Bunu doktor bey/hanıma 10 dakikada göstermek istiyorum: kendi telefonundan hasta gibi yazacak, cevabı görecek. {gün} o bölgedeyim. 14:00 mü uygun, 16:00 mı?",
    confirm:
      "Not aldım: {gün} saat __, doktor bey/hanımla 10 dakika. Bu numaraya WhatsApp'tan teyit atıyorum. Çok teşekkürler, iyi çalışmalar.",
    branches: [
      {
        title: "\"Konu nedir?\" / \"Ne satıyorsunuz?\"",
        lines: [
          {
            who: "Sen",
            text: "Satmak için değil, göstermek için arıyorum. Kliniklere gelen telefon ve mesajlara siz yetişemediğinizde cevap veren bir sistem. Size bir şey sorayım: akşam gelen mesajlara kim bakıyor?",
          },
        ],
        tip: "Her cevabı bir soruyla bitir. Konuşmayı o yapsın.",
      },
      {
        title: "\"Doktor ameliyatta / müsait değil\"",
        lines: [
          {
            who: "Sen",
            text: "Hiç rahatsız etmeyeyim. Randevuyu sizden alabilir miyim? {gün} o bölgedeyim, 10 dakika sürecek. 14:00 mü daha uygun, 16:00 mı?",
          },
          {
            who: "\"Doktora sormam lazım\" derse",
            tone: "them",
            text: "Tabii. {gün} 14:00'ü şimdilik yazıyorum. Yarın 11:00'de sizi arayıp teyit alayım, olur mu?",
          },
        ],
        tip: "Her durumda bir saat bırak. Uygulamada: Nasıl bitti? → Sonra ara dedi.",
      },
      {
        title: "\"Bilgi gönderin\" / \"Mail atın\"",
        lines: [
          {
            who: "Sen",
            text: "Hemen WhatsApp'tan atıyorum. Bu numara WhatsApp'ta mı, yoksa hangi numaraya atayım? Yalnız dosyada asıl farkı göremezsiniz: doktor bey kendi telefonundan yazıp cevabı görüyor, 10 dakika. {gün} 14:00'te uğrayayım mı?",
          },
        ],
        tip: "Uygulamada: Bilgi istedi → numarayı yaz → WhatsApp'ta gönder. 2 gün sonra (hafta sonu atlanır) arama kendiliğinden planlanır.",
      },
      {
        title: "\"Doktorun numarasını veremem\"",
        lines: [
          {
            who: "Sen",
            text: "Hiç gerek yok, randevuyu sizden almam yeterli. {gün} 14:00 mü uygun, 16:00 mı?",
          },
        ],
      },
    ],
  },
  {
    id: "doktor",
    title: "Doktor açtı",
    opening: "Merhaba Doktor Bey/Hanım, ben Özkan, Cuswin'in kurucusuyum. 30 saniyenizi alıp bir şey sorabilir miyim?",
    note: "Sorudan sonra sus. Sözünü kesme; ne kadar çok konuşursa o kadar iyi.",
    questions: [
      { text: "Günde aşağı yukarı kaç mesaj ve arama geliyor?", listen: "Rakamı not al; yüz yüze görüşmede kullanacaksın." },
      // İkinci soru klinik türüne göre değişir (CLINIC_TYPE_LINES).
      {
        text: "Fiyat sorup bir daha yazmayan hastaya geri dönen oluyor mu?",
        listen: "\"Hayır\" ya da \"vakit yok\" derse bağla.",
      },
    ],
    bridge:
      "Ankara'da bir estetik kliniğinde 1 aydır tam bunu çözüyoruz: mesai dışında gelen 464 konuşmanın 462'sine cevap verildi. Gelen hastayı kaçırmıyor, randevuyu takvime yazıyor, sonra takip ediyor. Kurulumu ben yapıyorum.",
    close:
      "Anlatmak yerine göstereyim: kendi telefonunuzdan hasta gibi yazacaksınız, cevabı göreceksiniz. 10 dakika. {gün} 14:00 mü uygun, 16:00 mı?",
    confirm: "Harika: {gün} saat __, kliniğinizdeyim. Bu numaraya WhatsApp'tan teyit atıyorum. İyi çalışmalar.",
    branches: [],
  },
];

export const PHONE_OBJECTIONS: { q: string; a: string; app?: string }[] = [
  {
    q: "İlgilenmiyoruz.",
    a: "Anlıyorum. Tek bir şey sorup kapatacağım: akşam ve hafta sonu gelen mesajlara kim bakıyor? (Hâlâ hayır derse) Teşekkür ederim, iyi çalışmalar.",
    app: "Nasıl bitti? → İlgilenmiyor",
  },
  {
    q: "Sekreterimiz var, yetişiyoruz.",
    a: "Çok iyi, sekreteriniz kalıyor. Bu, onun yetişemediği anlara bakıyor: ikinci hat, öğle arası, akşam, hafta sonu. Pilot klinikte mesajların yarısından fazlası mesai dışında geldi. Sizde akşamları durum nasıl?",
  },
  {
    q: "Zaten bir sistemimiz / CRM'imiz var.",
    a: "Güzel. Peki o sistem hastaya kendisi cevap veriyor mu, yoksa kaydı mı tutuyor? (Dinle) Bu cevabı veriyor, aramayı karşılıyor, takibi yapıyor. Yan yana görmek için 10 dakika yeter.",
  },
  {
    q: "Reklam ajansımız var.",
    a: "Çok iyi. Ajansın getirdiği hasta yazınca kaç dakikada cevap alıyor? Bu, o hastayı kaçırmamak için var. İsterseniz ajansınızla da konuşurum.",
  },
  {
    q: "Fiyatı ne?",
    a: "Yoğunluğunuza göre değişiyor. Günde kaç mesaj geliyor? (Dinle) Görüşmede birlikte bakıp net söylüyorum, uydurma rakam vermek istemem. {gün} 14:00 mü, 16:00 mı?",
  },
  {
    q: "Yapay zeka mı? Hastalar sevmez.",
    a: "Hasta kiminle konuştuğuna değil, cevap alıp almadığına bakıyor. Gece cevap alamayan hasta sabahı beklemiyor. Her konuşmayı siz görüyorsunuz, istediğiniz an devralıyorsunuz. Kendi gözünüzle görmek ister misiniz?",
  },
  {
    q: "Şu an çok yoğunuz.",
    a: "O yüzden kısa tutuyorum. Kurulumla siz uğraşmıyorsunuz, biz yapıyoruz. Hangi gün daha sakin? Ona göre geleyim.",
  },
  { q: "Sonra arayın.", a: "Tabii. Ne zaman arayayım: yarın mı, {gün} mü? Saat kaç uygun?", app: "Nasıl bitti? → Sonra ara dedi" },
  { q: "Bizi aramayın.", a: "Anlaşıldı, kaydınızı kapatıyorum. İyi çalışmalar.", app: "Nasıl bitti? → Diğer → Tekrar iletişim kurma" },
];

export const CLINIC_TYPE_LINES: { id: string; title: string; hook: string; question: string; note: string }[] = [
  {
    id: "estetik",
    title: "Estetik ve medikal estetik",
    hook: "Instagram'da gönderilerinizin altına \"fiyat?\" yazan hastalara kim, ne zaman dönüyor? Reklam veremediğiniz bir dönemde o mesajlar en değerli hastanız.",
    question: "Akşam 22:00'de biri Instagram'dan \"dolgu ne kadar?\" diye yazınca ne oluyor?",
    note: "Pilot klinik bu alanda; rakamları rahatça kullan.",
  },
  {
    id: "sac",
    title: "Saç ekimi",
    hook: "Saç ekiminde hasta karar vermeden önce birkaç kliniğe birden yazıyor: kaç greft, hangi teknik, fiyat. İlk cevap veren kliniğe gidiyor.",
    question: "Gece \"kaç greft, fiyat ne?\" diye yazan hastaya kaç saatte dönebiliyorsunuz?",
    note: "Dürüst ol: pilot klinik estetik ve KBB; saç ekiminde ilk klinikleri şimdi alıyoruz. Rakam uydurma.",
  },
  {
    id: "dis",
    title: "Diş",
    hook: "Hasta \"implant ne kadar?\" diye aradığında hat meşgulse ya da muayenedeyseniz o arama geri dönüyor mu? Cevapsız kalan arama, başka kliniğe giden hasta demek.",
    question: "Muayenedeyken cevapsız kalan aramaları geri arayabiliyor musunuz?",
    note: "Pilot estetik kliniği, rakamlar oradan; dürüst söyle.",
  },
];

/** Ulaşamayınca cep numarasına gönderilen WhatsApp mesajı (henüz görüşülmemiş klinik). */
export const MISSED_CALL_TEXT =
  "Merhaba, ben Özkan, Cuswin'den. Az önce aradım, ulaşamadım. Kliniklere gelen telefon ve mesajlara, siz yetişemediğinizde cevap veren sistemimizi 10 dakikada yüz yüze göstermek istiyorum. Bu hafta hangi gün uygun olur?";

/** Randevu teyidi: "Perşembe 12 Kasım saat 14:00'te kliniğinizdeyiz..." */
export function confirmationText(when: string): string {
  return `Merhaba, ${when}'te kliniğinizdeyiz. 10 dakika sürecek. Görüşmek üzere. Özkan, Cuswin`;
}
