// Saha haritası: kliniklerin konumu (Google Maps bağlantısından) ve durumu. Saf fonksiyonlar.

import { coordsOf } from "./contact-info";
import type { ContactSummary } from "./field-plan";
import type { Appointment, Business } from "./types";

export type MapStatus = "randevu" | "aranacak" | "ziyaret" | "musteri" | "kapali";
export type MapPoint = {
  business: Business;
  lat: number;
  lng: number;
  status: MapStatus;
  appointment?: Appointment;
  /** Konum Maps bağlantısından değil adresten bulundu (yaklaşık). */
  approx?: boolean;
};
export type LatLng = { lat: number; lng: number };

export const MAP_STATUS: Record<MapStatus, { label: string; color: string }> = {
  randevu: { label: "Randevu var", color: "#2f3fa8" },
  aranacak: { label: "Gidilmedi", color: "#d97706" },
  ziyaret: { label: "Uğradım", color: "#13714a" },
  musteri: { label: "Müşteri", color: "#15202b" },
  kapali: { label: "İlgilenmiyor", color: "#9aa5b0" },
};

export function mapStatus(b: Business, appointment: Appointment | undefined, contact: ContactSummary | undefined): MapStatus {
  if (b.salesStage === "musteri_oldu") return "musteri";
  if (b.salesStage === "olumsuz" || b.callStatus === "ilgilenmiyor" || b.callStatus === "iletisim_kurma") return "kapali";
  if (appointment) return "randevu";
  if (contact?.lastVisit) return "ziyaret";
  return "aranacak";
}

/** Konumu bilinen klinikler ve konumu olmayanların sayısı. */
export function mapPoints(
  businesses: Business[],
  appointments: Appointment[],
  contacts: Map<string, ContactSummary>,
  now: Date,
  /** Adresten bulunan konumlar (Maps bağlantısı olmayanlar için). */
  geocoded: ReadonlyMap<string, LatLng> = new Map(),
): { points: MapPoint[]; missing: number } {
  const upcoming = new Map<string, Appointment>();
  for (const a of [...appointments].sort((x, y) => x.startsAt.localeCompare(y.startsAt))) {
    if (a.status === "planlandi" && new Date(a.startsAt) >= now && !upcoming.has(a.businessId)) upcoming.set(a.businessId, a);
  }
  const points: MapPoint[] = [];
  let missing = 0;
  for (const b of businesses) {
    const exact = coordsOf(b.mapsUrl);
    const c = exact ?? geocoded.get(b.id);
    if (!c) {
      missing++;
      continue;
    }
    const appointment = upcoming.get(b.id);
    points.push({ business: b, lat: c.lat, lng: c.lng, appointment, status: mapStatus(b, appointment, contacts.get(b.id)), approx: !exact });
  }
  return { points, missing };
}

/** İki nokta arası kuş uçuşu mesafe (metre). */
export function distanceMeters(a: LatLng, b: LatLng): number {
  const R = 6_371_000;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** "180 m", "1,2 km" */
export function formatDistance(m: number): string {
  return m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toLocaleString("tr-TR", { maximumFractionDigits: 1 })} km`;
}

/** Yürüyerek gidilecekler: kapalı/müşteri olmayanlar, yakından uzağa. */
export function nearest(points: MapPoint[], from: LatLng, limit: number): { point: MapPoint; meters: number }[] {
  return points
    .filter((p) => p.status !== "kapali" && p.status !== "musteri")
    .map((point) => ({ point, meters: distanceMeters(from, point) }))
    .sort((a, b) => a.meters - b.meters)
    .slice(0, limit);
}

/** Adresten konum aramak için sorgu; adres yoksa undefined (ilçe tek başına yanlış nokta verir). */
export function geocodeQuery(b: Pick<Business, "address" | "district">): string | undefined {
  const address = b.address?.trim();
  if (!address || address.length < 6 || /^demo /i.test(address)) return undefined;
  return [address, b.district, "Ankara", "Türkiye"].filter(Boolean).join(", ");
}

/** Ankara ve çevresi dışına düşen sonuç yanlış eşleşmedir. */
export function nearAnkara(c: LatLng): boolean {
  return c.lat > 39.3 && c.lat < 40.6 && c.lng > 31.8 && c.lng < 33.9;
}

/** Bir noktadan sonraki en yakın, gidilmemiş (randevulu ya da gidilmedi) klinik. */
export function nextStop(points: MapPoint[], fromId: string): { point: MapPoint; meters: number } | undefined {
  const from = points.find((p) => p.business.id === fromId);
  if (!from) return undefined;
  return points
    .filter((p) => p.business.id !== fromId && (p.status === "aranacak" || p.status === "randevu"))
    .map((point) => ({ point, meters: distanceMeters(from, point) }))
    .sort((a, b) => a.meters - b.meters)[0];
}
