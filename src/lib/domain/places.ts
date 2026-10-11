// Google Maps tarama sonucunu CRM kaydına dönüştürme ve tekrar kontrolü. Saf fonksiyonlar.

import { z } from "zod";
import { normalizePhone, normalizeWebsite } from "./contact-info";
import { ANKARA_DISTRICTS } from "./labels";
import type { Business, Category, PlaceInput } from "./types";

/** gosom/google-maps-scraper JSON çıktısının kullandığımız alanları. Dış veri: her alan doğrulanır. */
export const scrapedPlaceSchema = z.object({
  title: z.string().trim().min(1).max(300),
  category: z.string().max(200).optional().nullable(),
  categories: z.array(z.string().max(200)).optional().nullable(),
  phone: z.string().max(60).optional().nullable(),
  web_site: z.string().max(500).optional().nullable(),
  emails: z.array(z.string().max(200)).optional().nullable(),
  place_id: z.string().min(5).max(200),
  link: z.string().max(2000).optional().nullable(),
  status: z.string().max(100).optional().nullable(),
  address: z.string().max(500).optional().nullable(),
  complete_address: z
    .object({
      borough: z.string().optional().nullable(),
      street: z.string().optional().nullable(),
      city: z.string().optional().nullable(),
      state: z.string().optional().nullable(),
    })
    .optional()
    .nullable(),
});
export type ScrapedPlace = z.infer<typeof scrapedPlaceSchema>;

const lower = (s: string) => s.toLocaleLowerCase("tr-TR");

const CATEGORY_RULES: [Category, RegExp][] = [
  ["dis", /diş|dental|dent\b|ortodont|implant|ağız ve diş|periodont|endodont|pedodont/],
  ["sac_ekim", /saç ekim|hair transplant|saç nakli|\bfue\b|\bdhi\b/],
  ["sac_sagligi", /saç sağlığı|saç tedavi|trikoloji|trichology|saç dökülme/],
  ["estetik", /estetik|esthetic|aesthetic|plastik cerrah|plastic surg|dermatolog|cilt|botoks|botox|dolgu klinik|lazer epilasyon|güzellik tıp/],
];

/** Hedef dışı işletmeler: kuaför, güzellik salonu, mağaza ve kamu kurumları. */
const EXCLUDE_RULES: [string, RegExp][] = [
  ["Kamu kurumu", /t\.c\.|sağlık bakanlığı|\badsm\b|devlet hastanesi|eğitim ve araştırma|üniversitesi|fakültesi|toplum sağlığı|aile sağlığı/],
  ["Kuaför / güzellik salonu", /kuaför|berber|güzellik salonu|beauty salon|hair salon|nail|tırnak/],
  ["Mağaza / satış", /mağaza|store|shop|kozmetik satış|depo|market|eczane|dental depo|diş deposu|laboratuvar/],
];

function matchCategories(text: string): Category[] {
  return CATEGORY_RULES.filter(([, re]) => re.test(text)).map(([c]) => c);
}

export type MapResult = { place: PlaceInput } | { skip: string };

export function mapScrapedPlace(raw: unknown): MapResult {
  const parsed = scrapedPlaceSchema.safeParse(raw);
  if (!parsed.success) return { skip: "Geçersiz kayıt" };
  const p = parsed.data;

  if (p.status && /kalıcı olarak kapalı|permanently closed/i.test(p.status)) return { skip: "Kalıcı olarak kapalı" };
  const state = p.complete_address?.state;
  if (state && lower(state) !== "ankara") return { skip: "Ankara dışında" };

  const haystack = lower([p.title, p.category, ...(p.categories ?? []), p.web_site].filter(Boolean).join(" | "));
  for (const [reason, re] of EXCLUDE_RULES) if (re.test(haystack)) return { skip: reason };
  if (p.web_site && /\.gov\.tr/i.test(p.web_site)) return { skip: "Kamu kurumu" };

  // Önce Google'ın kategori alanı; eşleşme yoksa ad ve web sitesi. İsimdeki reklam kelimeleri
  // ("Gülüş Estetiği", "Diş Sıkma Botoksu") kategori alanı varken yanlış kategori eklemesin.
  const fromCategory = matchCategories(lower([p.category, ...(p.categories ?? [])].filter(Boolean).join(" | ")));
  const categories = fromCategory.length ? fromCategory : matchCategories(haystack);
  const city = p.complete_address?.city?.trim();
  const district = ANKARA_DISTRICTS.find((d) => city && lower(d) === lower(city));
  const street = p.complete_address?.street?.trim();
  const borough = p.complete_address?.borough?.trim();
  const email = (p.emails ?? []).map((e) => e.trim()).find((e) => z.email().safeParse(e).success);
  const website = p.web_site?.trim() && /^https?:\/\//i.test(p.web_site.trim()) ? p.web_site.trim() : undefined;
  const mapsUrl = p.link && p.link.startsWith("https://www.google.com/maps/") ? p.link : undefined;

  return {
    place: {
      name: p.title,
      categories,
      phone: p.phone?.trim() || undefined,
      email,
      website,
      district,
      address: [street, borough].filter(Boolean).join(", ") || p.address?.trim() || undefined,
      mapsUrl,
      source: "google_maps",
      sourceId: p.place_id,
    },
  };
}

export type ImportDecision =
  | { kind: "update"; businessId: string }
  | { kind: "add"; reviewReason?: string };

/**
 * Tekrar kontrolü: kaynak kimliği aynıysa güncelle. Telefon veya web sitesi başka kayıtla aynıysa
 * şube olabilir; ayrı ekle ama kontrol için işaretle. Yalnızca isim benzerliğiyle birleştirme yapılmaz.
 */
export function decideImport(existing: Business[], place: PlaceInput): ImportDecision {
  const same = existing.find((b) => b.source === place.source && b.sourceId === place.sourceId);
  if (same) return { kind: "update", businessId: same.id };

  const phone = normalizePhone(place.phone);
  const site = normalizeWebsite(place.website);
  const phoneTwin = phone && existing.find((b) => normalizePhone(b.phone) === phone);
  if (phoneTwin) return { kind: "add", reviewReason: `Ortak telefon: ${phoneTwin.name} ile aynı numara. Şube mi aynı işletme mi kontrol edin` };
  const siteTwin = site && existing.find((b) => normalizeWebsite(b.website) === site);
  if (siteTwin) return { kind: "add", reviewReason: `Ortak web sitesi: ${siteTwin.name} ile aynı site. Şube mi aynı işletme mi kontrol edin` };
  return { kind: "add" };
}
