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
