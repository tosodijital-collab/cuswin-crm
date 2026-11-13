import type { Business } from "./types";

/**
 * Türkiye telefon numarasını karşılaştırma için E.164 biçimine getirir (+90XXXXXXXXXX).
 * Geçerli 10 haneli ulusal numara çıkmıyorsa undefined döner.
 */
export function normalizePhone(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("0090")) digits = digits.slice(4);
  else if (digits.startsWith("90") && digits.length === 12) digits = digits.slice(2);
  else if (digits.startsWith("0") && digits.length === 11) digits = digits.slice(1);
  if (digits.length !== 10) return undefined;
  return `+90${digits}`;
}

/** "+903124274848" → "0312 427 48 48" */
export function formatPhone(raw: string | undefined): string | undefined {
  const e164 = normalizePhone(raw);
  if (!e164) return raw;
  const n = e164.slice(3);
  return `0${n.slice(0, 3)} ${n.slice(3, 6)} ${n.slice(6, 8)} ${n.slice(8, 10)}`;
}

export function telHref(raw: string | undefined): string | undefined {
  const e164 = normalizePhone(raw);
  return e164 ? `tel:${e164}` : undefined;
}

/** Karşılaştırma için alan adı: "https://www.Ornek.com.tr/iletisim" → "ornek.com.tr" */
export function normalizeWebsite(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  try {
    const url = new URL(raw.includes("://") ? raw : `https://${raw}`);
    return url.hostname.toLowerCase().replace(/^www\./, "") || undefined;
  } catch {
    return undefined;
  }
}

export function websiteHref(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  return raw.includes("://") ? raw : `https://${raw}`;
}

/** Kaynak link vermediyse API anahtarı gerektirmeyen Maps arama bağlantısı. */
export function mapsHref(b: Pick<Business, "mapsUrl" | "name" | "address" | "district">): string {
  if (b.mapsUrl) return b.mapsUrl;
  const query = [b.name, b.address, b.district, "Ankara"].filter(Boolean).join(", ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

const isMobile = (e164: string | undefined) => Boolean(e164?.startsWith("+905"));

/** Kayıttaki WhatsApp'a uygun numara: önce kişilerdeki cep, sonra kliniğin cep numarası. */
export function whatsappNumberOf(b: Pick<Business, "phone" | "contacts">): string | undefined {
  const all = [...b.contacts.map((c) => c.phone), b.phone].map(normalizePhone);
  return all.find(isMobile);
}

/** Numara herhangi bir TR numarası olabilir (WhatsApp Business sabit hatta da açılabilir). Rehbere kaydetmeden sohbet açar. */
export function whatsappChatHref(raw: string | undefined, text: string): string | undefined {
  const e164 = normalizePhone(raw);
  return e164 ? `https://wa.me/${e164.slice(1)}?text=${encodeURIComponent(text)}` : undefined;
}

/**
 * Kişilere WhatsApp numarası ekler. Numara geçersizse ya da zaten kayıtlıysa (kliniğin numarası dahil)
 * undefined döner: kaydedilecek bir şey yok.
 */
export function withWhatsapp(b: Pick<Business, "phone" | "contacts">, raw: string): Business["contacts"] | undefined {
  const e164 = normalizePhone(raw);
  if (!e164) return undefined;
  const known = [b.phone, ...b.contacts.map((c) => c.phone)].map(normalizePhone);
  if (known.includes(e164)) return undefined;
  return [...b.contacts, { id: crypto.randomUUID(), name: "WhatsApp", phone: formatPhone(e164) }];
}

/** Google Maps bağlantısındaki konum ("!3d39.91!4d32.85" ya da "@39.91,32.85"). */
export function coordsOf(mapsUrl: string | undefined): { lat: number; lng: number } | undefined {
  if (!mapsUrl) return undefined;
  const m = mapsUrl.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/) ?? mapsUrl.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (!m) return undefined;
  const lat = Number(m[1]);
  const lng = Number(m[2]);
  // Türkiye sınırları dışında bir değer bozuk veridir.
  return lat > 35 && lat < 43 && lng > 25 && lng < 45 ? { lat, lng } : undefined;
}
