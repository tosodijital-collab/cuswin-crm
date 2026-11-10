// Saha (kapı kapı) rotası: işletmeleri adresteki bina, cadde ve mahalle adlarına göre ziyaret günlerine ayırır.
// Saf fonksiyonlar; yeni taranan kayıtlar da adresine göre kendiliğinden doğru güne düşer.

import { CLOSED_CALL_STATUSES } from "./rules";
import type { Business, SalesStage } from "./types";

export type FieldDay = {
  id: string;
  title: string;
  area: string;
  note?: string;
  /** Sıra önemlidir: önce eşleşen anahtar günü belirler, anahtarın sırası gün içindeki ziyaret sırasıdır. */
  keys: string[];
  /** Adres eşleşmezse ilçeye göre bu güne düşer. */
  districts?: string[];
};

export const FIELD_DAYS: FieldDay[] = [
  {
    id: "gun-1",
    title: "1. gün · Çukurambar: YDA Center ve Usta Plaza",
    area: "Kızılırmak Mah. Çoğu aynı iki binada, kat kat gezilir.",
    note: "En verimli gün: kliniklerin çoğu iki binada.",
    keys: ["yda", "usta", "tepe prime"],
  },
  {
    id: "gun-2",
    title: "2. gün · Çukurambar: 1443. Cadde boyunca",
    area: "Aynı cadde ve ara sokaklar, yürüyerek.",
    keys: ["muhsin yazicioglu", "1443", "1467", "1480", "1426", "paragon", "kizilirmak", "cukurambar"],
  },
  {
    id: "gun-3",
    title: "3. gün · Kavaklıdere, Gaziosmanpaşa, Kazım Özalp",
    area: "Tunalı Hilmi ve Uğur Mumcu Caddesi çevresi.",
    keys: [
      "tunali",
      "bestekar",
      "kavaklidere",
      "ataturk b",
      "sipahioglu",
      "filistin",
      "tahran",
      "gaziosmanpasa",
      "ugur mumcu",
      "kazim ozalp",
      "cankaya cd",
    ],
  },
  {
    id: "gun-4",
    title: "4. gün · Bahçelievler, Kızılay, Kocatepe, Öveçler, Oran",
    area: "Merkez ve güneydoğu.",
    note: "Hastane bünyesindeki merkezlerde karar verici farklı olabilir, en sona bırak.",
    keys: [
      "askabat",
      "bahcelievler",
      "maltepe",
      "mithatpasa",
      "kultur",
      "kumrular",
      "kizilay",
      "ziya gokalp",
      "cumhuriyet",
      "kocatepe",
      "selanik",
      "yildiz",
      "birlik",
      "guvenevler",
      "hosdere",
      "aziziye",
      "ovecler",
      "oran",
    ],
  },
  {
    id: "gun-5",
    title: "5. gün · Söğütözü Neorama ve Yenimahalle",
    area: "Önce Neorama Plaza, sonra İvedik, Demetevler ve Batıkent.",
    keys: ["neorama", "bestepe", "sogutozu", "yasam cd", "ivedik", "demet", "vatan cd", "batikent", "macun", "pamuklar"],
    districts: ["Yenimahalle"],
  },
  {
    id: "gun-6",
    title: "6. gün · Ümitköy, Çayyolu, Yaşamkent",
    area: "Batı Çankaya. Osmanağa Konakları'nda cerrahlar yan yana.",
    note: "Pilot klinik de bu bölgede. Rakamları anlatırken klinik adını hiçbir koşulda söyleme.",
    keys: ["osmanaga", "osman aga", "umitkoy", "umit", "alacaatli", "cayyolu", "konutkent", "yasamkent"],
  },
];

/** Karşılaştırma için: küçük harf, Türkçe harfler ASCII. */
export function normalizeText(s: string | undefined): string {
  return (s ?? "")
    .toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "");
}

const keyPatterns = new Map<string, RegExp>();
function hasKey(haystack: string, key: string): boolean {
  let re = keyPatterns.get(key);
  if (!re) {
    // Sözcük başında eşleşir: "oran" "Koran"ı, "umit" "Kumit"i yakalamaz.
    re = new RegExp(`(^|[^a-z0-9])${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`);
    keyPatterns.set(key, re);
  }
  return re.test(haystack);
}

export type FieldPlacement = { dayId: string; order: number };

/** İşletmenin rota günü ve gün içindeki sırası; hiçbir güne uymuyorsa undefined. */
export function placeOnRoute(b: Pick<Business, "address" | "district">): FieldPlacement | undefined {
  const address = normalizeText(b.address);
  const orderIn = (day: FieldDay) => (address ? day.keys.findIndex((k) => hasKey(address, k)) : -1);
  // İlçe kesin bilgidir: başka ilçedeki aynı adlı mahalle ya da cadde yanlış güne düşürmesin.
  const byDistrict = FIELD_DAYS.find((d) => b.district && d.districts?.includes(b.district));
  if (byDistrict) {
    const order = orderIn(byDistrict);
    return { dayId: byDistrict.id, order: order >= 0 ? order : byDistrict.keys.length };
  }
  for (const day of FIELD_DAYS) {
    const order = orderIn(day);
    if (order >= 0) return { dayId: day.id, order };
  }
  return undefined;
}

/** Ziyaret listesinden çıkan aşamalar: müşteri olmuş ya da olumsuz sonuçlanmış. */
const DONE_STAGES: ReadonlySet<SalesStage> = new Set(["musteri_oldu", "olumsuz"]);

export type FieldStop = { business: Business; order: number };
export type FieldDayView = { day: FieldDay; stops: FieldStop[] };
export type FieldRoute = { days: FieldDayView[]; unplaced: Business[]; excluded: number };

/** Sonuç girilmiş mi: arama ya da ziyaret sonucu kaydedilmiş, ya da aşama ilerlemiş. */
export function hasOutcome(b: Business): boolean {
  return b.callStatus !== "aranacak" || b.salesStage !== "yeni_aday";
}

export function buildFieldRoute(businesses: Business[], filter: (b: Business) => boolean): FieldRoute {
  const byDay = new Map<string, FieldStop[]>(FIELD_DAYS.map((d) => [d.id, []]));
  const unplaced: Business[] = [];
  let excluded = 0;
  for (const b of businesses) {
    if (!filter(b)) continue;
    // "Beklemede" (telefonla ulaşılamayan) sahada ziyaret edilmeye değer; kalır.
    if (DONE_STAGES.has(b.salesStage) || (CLOSED_CALL_STATUSES.has(b.callStatus) && b.callStatus !== "beklemede")) {
      excluded++;
      continue;
    }
    const p = placeOnRoute(b);
    if (p) byDay.get(p.dayId)!.push({ business: b, order: p.order });
    else unplaced.push(b);
  }
  const days = FIELD_DAYS.map((day) => ({
    day,
    stops: byDay
      .get(day.id)!
      .sort((a, b) => a.order - b.order || (a.business.address ?? "").localeCompare(b.business.address ?? "", "tr")),
  }));
  return { days, unplaced, excluded };
}

/** Günün durakları için Google Haritalar yol tarifi (en çok 9 ara durak, aynı bina bir kez). */
export function dayDirectionsHref(stops: FieldStop[]): string | undefined {
  const points = [
    ...new Set(stops.map((s) => [s.business.address, s.business.district, "Ankara"].filter(Boolean).join(", "))),
  ];
  if (points.length === 0) return undefined;
  const destination = points[points.length - 1];
  const waypoints = points.slice(0, -1).slice(0, 9);
  let href = `https://www.google.com/maps/dir/?api=1&travelmode=driving&destination=${encodeURIComponent(destination)}`;
  if (waypoints.length) href += `&waypoints=${encodeURIComponent(waypoints.join("|"))}`;
  return href;
}

/** Cep numarasıysa WhatsApp bağlantısı (mesaj hazır gelir, gönderen kullanıcıdır). */
export function whatsappHref(phone: string | undefined, text: string): string | undefined {
  const digits = (phone ?? "").replace(/\D/g, "");
  const national = digits.startsWith("90") && digits.length === 12 ? digits.slice(2) : digits.replace(/^0/, "");
  if (national.length !== 10 || !national.startsWith("5")) return undefined;
  return `https://wa.me/90${national}?text=${encodeURIComponent(text)}`;
}
