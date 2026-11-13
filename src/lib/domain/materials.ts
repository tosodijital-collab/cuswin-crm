// Müşteriye ve iş ortaklarına gönderilen PDF'ler ve yanlarındaki hazır mesajlar.
// Dosyalar public/dosyalar altında: herkese açık yayınlanır, bu yüzden yalnızca dışarıya gönderilecek
// belgeler burada durur (iç kullanım saha kiti burada yok).

export type MaterialId = "tanitim" | "brosur" | "is-ortakligi";

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
    pages: "8 sayfa",
    when: "Ziyaretten sonra aynı gün ya da \"tanıtımınız var mı?\" diyene.",
    message:
      "Merhaba, tanıtım dosyamız burada; telefondan rahatça okunuyor:\n{link}\n\nKısaca: siz hastanızla ilgilenirken kliniğinize yazan ve arayan hastaları karşılıyor, randevusunu ayarlıyor ve sonrasını takip ediyor. Denemek isterseniz demo hattımız 0850 510 09 46; arayabilir ya da WhatsApp'tan yazabilirsiniz.\n\nÖzkan Toso · 0537 839 54 20",
  },
  {
    id: "brosur",
    title: "Tek sayfa broşür",
    fileName: "Cuswin-Brosur.pdf",
    path: "/dosyalar/cuswin-brosur.pdf",
    pages: "1 sayfa",
    when: "Kapıda elden bırakılır (basılı). Fuarda tanışılana aynı gün WhatsApp'tan.",
    message:
      "Merhaba, bugün tanıştık. Konuştuğumuz Cuswin'in tek sayfalık özeti burada:\n{link}\n\nUygun olduğunuz bir gün kliniğinizde 10 dakikalık bir gösterim yapabilirim.\n\nÖzkan Toso · 0537 839 54 20",
  },
  {
    id: "is-ortakligi",
    title: "İş ortaklığı dosyası",
    fileName: "Cuswin-Is-Ortakligi.pdf",
    path: "/dosyalar/cuswin-is-ortakligi.pdf",
    pages: "7 sayfa",
    when: "Kliniklere çalışan ajans ya da aracı iş birliği istediğinde.",
    message:
      "Merhaba, iş ortaklığı dosyamız burada:\n{link}\n\nKısaca: müşterinize lead değil randevu teslim etmenizi sağlıyoruz. Kurulum ve destek bizden. 30 dakikalık bir görüşmede size uygun modeli birlikte belirleyelim. Bu hafta hangi gün uygun?\n\nÖzkan Toso · 0537 839 54 20",
  },
];

export function getMaterial(id: MaterialId): Material {
  return MATERIALS.find((m) => m.id === id)!;
}

/** Mesajdaki {link} yerine dosyanın adresini koyar. Karşı taraf linke dokununca PDF açılır; rehbere kayıt gerekmez. */
export function messageWithLink(m: Material, url: string): string {
  return m.message.replace("{link}", url);
}
