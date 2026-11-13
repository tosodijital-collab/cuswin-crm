// Kliniğe özel teklif: bilgiler linkin içinde taşınır (sunucu yok), /teklif sayfası açınca gösterir.
// Linkteki veri dışarıdan gelir: her alan doğrulanır, sayfada metin olarak (HTML değil) gösterilir.

import { z } from "zod";

export const PACKAGES = ["Starter", "Growth", "Scale", "Enterprise"] as const;
export const OFFER_TYPES = { sesli: "Mesaj + sesli asistan", mesaj: "Sadece mesaj" } as const;

const money = z.number().int().min(0).max(10_000_000);
export const offerSchema = z.object({
  /** Klinik adı */
  c: z.string().trim().min(2).max(160),
  /** Yetkili */
  y: z.string().trim().max(120).optional(),
  p: z.enum(PACKAGES),
  t: z.enum(["sesli", "mesaj"]),
  /** Kurulum, aylık, ek kanal (TL) */
  k: money,
  a: money,
  e: money.optional(),
  /** KDV dahil mi */
  v: z.boolean(),
  /** Görüşmeden notlar */
  n: z.string().trim().max(700).optional(),
  /** Teklif tarihi ve geçerlilik (gün) */
  d: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  g: z.number().int().min(1).max(90),
});
export type Offer = z.infer<typeof offerSchema>;

function toBase64Url(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(s: string): string {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  return new TextDecoder().decode(Uint8Array.from(bin, (ch) => ch.charCodeAt(0)));
}

export function encodeOffer(o: Offer): string {
  return toBase64Url(JSON.stringify(offerSchema.parse(o)));
}

export function decodeOffer(token: string | null | undefined): Offer | undefined {
  if (!token || token.length > 4000) return undefined;
  try {
    const parsed = offerSchema.safeParse(JSON.parse(fromBase64Url(token)));
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
}

/** "15000" → "15.000 ₺" */
export function formatTl(n: number): string {
  return `${n.toLocaleString("tr-TR")} ₺`;
}

/** Teklif no: tarih + klinik adından kısa, sabit bir ek ("CW-20261113-4F2A"). */
export function offerNumber(o: Pick<Offer, "c" | "d">): string {
  let h = 0;
  for (const ch of o.c) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return `CW-${o.d.replace(/-/g, "")}-${(h % 0xffff).toString(16).toUpperCase().padStart(4, "0")}`;
}

export const OFFER_INCLUDES =
  "Instagram, WhatsApp, web ve telefondan gelen her hastaya 7/24 cevap · randevu ve bir gün önce hatırlatma · düşünen ve gelmeyen hastanın takibi · işlem ve ameliyat sonrası bir yıllık takip · eski hastalara kontrol hatırlatması ve seçtiğiniz hastalara toplu mesaj · tıbbi soru ve acil durumun size iletilmesi · memnun hastadan Google yorumu.";

export const OFFER_GUARANTEES = [
  "Sistem, onayınız olmadan yayına alınmaz.",
  "Her konuşma panelde kayıtlıdır; ekibiniz istediği an devralır.",
  "Asistan yalnızca sizin fiyat listeniz ve bilgilerinizle konuşur, tıbbi tavsiye vermez.",
  "Hesaplarınız şifre paylaşmadan, resmî yetkilendirmeyle bağlanır.",
  "Hasta verisi kliniğinize aittir, kimseyle paylaşılmaz; çalışmayı bırakırsanız kayıtlarınız sizinle kalır.",
];

export const OFFER_STEPS = ["Klinik analizi ve bilgilerin alınması", "Kanal bağlantısı", "Test ve onay görüşmesi", "Yayına alma"];

export const OFFER_NEEDS = [
  "Hizmet ve fiyat listesi",
  "Çalışma saatleri ve takvim",
  "Hesap yetkilendirmeleri",
  "Takip planı tercihleri",
  "~1 saatlik onay görüşmesi",
  "Sekreterle kısa tanışma",
];
