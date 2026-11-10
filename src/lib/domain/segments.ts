import type { Business } from "./types";

export type Segment = "estetik" | "dis";

/** Önce estetik ve saç (pilot klinik bu alanda, rakamlar en güçlü burada); diş 2. aşama. */
export const SEGMENTS: Record<Segment, { label: string; match: (b: Business) => boolean }> = {
  estetik: { label: "Estetik ve saç", match: (b) => !b.categories.includes("dis") || b.categories.length > 1 },
  dis: { label: "Diş (2. aşama)", match: (b) => b.categories.includes("dis") },
};

/** "2026-11-12" → "12 Kas Per" (kısa) ya da "12 Kasım Perşembe" (uzun). Öğlen alınır: saat dilimi günü kaydırmasın. */
export function dayLabel(date: string, style: "short" | "long"): string {
  return new Date(`${date}T12:00:00+03:00`).toLocaleDateString("tr-TR", {
    timeZone: "Europe/Istanbul",
    day: "numeric",
    month: style === "short" ? "short" : "long",
    weekday: style === "short" ? "short" : "long",
  });
}
