// Müşteriye ve iş ortaklarına gönderilen PDF'ler ve yanlarındaki hazır mesajlar.
// Dosyalar public/dosyalar altında: herkese açık yayınlanır, bu yüzden yalnızca dışarıya gönderilecek
// belgeler burada durur (iç kullanım saha kiti burada yok).

export type MaterialId = "tanitim" | "brosur" | "teklif" | "is-ortakligi";

export type Material = {
  id: MaterialId;
  title: string;
  /** Paylaşılırken karşı tarafta görünen dosya adı. */
  fileName: string;
  path: string;
  pages: string;
  /** Ne zaman gönderilir. */
  when: string;
  /** Gönderilecek hazır mesaj; "{link}" dosyanın açık adresiyle değiştirilir. */
  message: string;
};

export const MATERIALS: Material[] = [
  {
    id: "tanitim",
    title: "Tanıtım dosyası",
    fileName: "Cuswin-Tanitim-Dosyasi.pdf",
    path: "/dosyalar/cuswin-tanitim.pdf",
    pages: "11 sayfa",
    when: "Ziyaretten sonra aynı gün ya da \"tanıtımınız var mı?\" diyene.",
    message:
      "Merhaba, Cuswin'den Özkan. Konuştuğumuz tanıtım dosyası burada:\n{link}\n\nKısaca: telefon, WhatsApp ve Instagram'dan gelen hastaya 3 saniyede cevap veriyor, randevuyu takvime yazıyor, sonra hastayı takip ediyor. Kurulumu biz yapıyoruz.\n\n10 dakikada canlı göstermek isterim. Bu hafta hangi gün uygun?",
  },
  {
    id: "brosur",
    title: "Tek sayfa broşür",
    fileName: "Cuswin-Brosur.pdf",
    path: "/dosyalar/cuswin-brosur.pdf",
    pages: "1 sayfa",
    when: "Kapıda elden bırakılır (basılı). Fuarda tanışılana aynı gün WhatsApp'tan.",
    message:
      "Merhaba, Cuswin'den Özkan, bugün tanıştık. Tek sayfalık özet burada:\n{link}\n\nKliniğinizde 10 dakikalık bir gösterim için bu hafta hangi gün uygun?",
  },
  {
    id: "teklif",
    title: "Teklif şablonu",
    fileName: "Cuswin-Teklif.pdf",
    path: "/dosyalar/cuswin-teklif.pdf",
    pages: "2 sayfa",
    when: "Demo yapıldı ve klinik \"teklif gönderin\" dedi. Doldurulup tanıtım dosyasıyla birlikte gönderilir.",
    message:
      "Merhaba, Cuswin'den Özkan. Konuştuğumuz teklif burada:\n{link}\n\nKurulum 3 gün sürüyor, siz onay vermeden hiçbir şey açılmıyor. Hangi gün başlayalım?",
  },
  {
    id: "is-ortakligi",
    title: "İş ortaklığı dosyası",
    fileName: "Cuswin-Is-Ortakligi.pdf",
    path: "/dosyalar/cuswin-is-ortakligi.pdf",
    pages: "5 sayfa",
    when: "Kliniklere çalışan ajans ya da aracı iş birliği istediğinde.",
    message:
      "Merhaba, Cuswin'den Özkan. İş ortaklığı dosyamız burada:\n{link}\n\nKısaca: müşterinize lead değil randevu teslim etmenizi sağlıyoruz. Kurulum ve destek bizden. 30 dakikalık bir görüşmede size uygun modeli birlikte belirleyelim. Bu hafta hangi gün uygun?",
  },
];

export function getMaterial(id: MaterialId): Material {
  return MATERIALS.find((m) => m.id === id)!;
}

/** Mesajdaki {link} yerine dosyanın adresini koyar. Karşı taraf linke dokununca PDF açılır; rehbere kayıt gerekmez. */
export function messageWithLink(m: Material, url: string): string {
  return m.message.replace("{link}", url);
}
