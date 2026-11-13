// DEMO verisi: tüm işletmeler ve numaralar uydurmadır (0312 000 … / 0532 000 …). Gerçek kayıtlarla karışmaz.

import { addDays, istanbulToUtc } from "@/lib/domain/time";
import type { Business, Category, DateStr } from "@/lib/domain/types";

type SeedRow = [name: string, categories: Category[], district: string, phone?: string, extra?: Partial<Business>];

const rows: SeedRow[] = [
  ["Demo Kızılay Ağız ve Diş Sağlığı Polikliniği", ["dis"], "Çankaya", "03120000101", { website: "demo-kizilaydis.example" }],
  ["Demo Bahçelievler Diş Kliniği", ["dis"], "Çankaya", "03120000102"],
  ["Demo Çayyolu Estetik Merkezi", ["estetik"], "Çankaya", "03120000103", { email: "iletisim@demo-cayyolu.example" }],
  ["Demo Batıkent Diş Hekimi Muayenehanesi", ["dis"], "Yenimahalle", "05320000104"],
  ["Demo Tunalı Saç Ekim Merkezi", ["sac_ekim", "sac_sagligi"], "Çankaya", "03120000105", { website: "demo-tunalisac.example" }],
  ["Demo Eryaman Ağız ve Diş Sağlığı", ["dis"], "Etimesgut", "03120000106"],
  ["Demo Keçiören Gülüş Tasarım", ["dis", "estetik"], "Keçiören", "03120000107"],
  ["Demo Ümitköy Dermatoloji ve Estetik", ["estetik"], "Çankaya", "03120000108"],
  ["Demo Sincan Diş Polikliniği", ["dis"], "Sincan", "03120000109"],
  ["Demo Ostim Saç Sağlığı Kliniği", ["sac_sagligi"], "Yenimahalle", "03120000110"],
  ["Demo Gaziosmanpaşa Estetik", ["estetik"], "Çankaya", "03120000111", { website: "demo-gopestetik.example" }],
  ["Demo Mamak Diş Hekimi", ["dis"], "Mamak", "05320000112"],
  ["Demo Dikmen Ortodonti", ["dis"], "Çankaya", "03120000113"],
  ["Demo Etlik Saç Ekim", ["sac_ekim"], "Keçiören", "03120000114"],
  ["Demo Balgat Ağız ve Diş Sağlığı Merkezi", ["dis"], "Çankaya", "03120000115"],
  ["Demo Altındağ Diş Kliniği", ["dis"], "Altındağ", "03120000116"],
  ["Demo Gölbaşı Estetik ve Lazer", ["estetik"], "Gölbaşı", "03120000117"],
  ["Demo Emek İmplant Merkezi", ["dis"], "Çankaya", "03120000118"],
  ["Demo Yaşamkent Diş", ["dis"], "Çankaya", "03120000119"],
  ["Demo Pursaklar Diş Hekimi", ["dis"], "Pursaklar", "05320000120"],
  ["Demo Kavaklıdere Saç Tasarım ve Ekim", ["sac_ekim", "estetik"], "Çankaya", "03120000121"],
  ["Demo Demetevler Diş Polikliniği", ["dis"], "Yenimahalle", "03120000122"],
  ["Demo Bilkent Estetik Klinik", ["estetik"], "Çankaya", "03120000123"],
  ["Demo Elvankent Ağız ve Diş", ["dis"], "Etimesgut", "03120000124"],
  ["Demo Aşağı Ayrancı Diş Kliniği", ["dis"], "Çankaya", "03120000125"],
  ["Demo Esat Saç Sağlığı Merkezi", ["sac_sagligi"], "Çankaya", "03120000126"],
  // Önceki günlerden kalan işler ve sonuçlanmış kayıtlar için
  ["Demo Necatibey Diş Kliniği", ["dis"], "Çankaya", "03120000127"],
  ["Demo Cebeci Estetik", ["estetik"], "Çankaya", "03120000128"],
  ["Demo Akay Diş Merkezi", ["dis"], "Çankaya", "03120000129"],
  ["Demo Söğütözü Saç Ekim", ["sac_ekim"], "Çankaya", "03120000130"],
  ["Demo Beşevler Diş Hekimi", ["dis"], "Yenimahalle", "03120000131"],
  ["Demo Oran Estetik ve Güzellik Tıp Merkezi", ["estetik"], "Çankaya", "03120000132"],
  ["Demo Anıttepe Diş Polikliniği", ["dis"], "Çankaya", "03120000133"],
  ["Demo Incek Diş Kliniği", ["dis"], "Gölbaşı", "03120000134"],
  ["Demo Kolej Saç Sağlığı", ["sac_sagligi"], "Çankaya", "03120000135"],
  ["Demo Çukurambar Estetik", ["estetik"], "Çankaya", "03120000136"],
  ["Demo Yenimahalle Ağız ve Diş", ["dis"], "Yenimahalle", "03120000137"],
  ["Demo Batıkent Saç Ekim", ["sac_ekim"], "Yenimahalle", "03120000138"],
  // Kontrol gerekli kayıtlar
  ["Demo Sıhhiye Diş Hekimi", ["dis"], "Çankaya", undefined],
  ["Demo Ulus Sağlık ve Güzellik", [], "Altındağ", "03120000140"],
  ["Demo Kızılay Diş Şube 2", ["dis"], "Çankaya", "03120000101", { reviewReason: "Ortak telefon: Demo Kızılay Ağız ve Diş Sağlığı Polikliniği ile aynı numara. Şube mi aynı işletme mi kontrol edin." }],
];

// Demo haritası için yaklaşık semt merkezleri (adlardaki semtten).
const DEMO_SPOTS: [string, number, number][] = [
  ["Kızılay", 39.9208, 32.8541], ["Bahçelievler", 39.9227, 32.8227], ["Çayyolu", 39.8851, 32.6895], ["Batıkent", 39.9683, 32.7312],
  ["Tunalı", 39.9033, 32.8606], ["Eryaman", 39.9786, 32.6375], ["Keçiören", 39.9786, 32.8642], ["Ümitköy", 39.8998, 32.7005],
  ["Gaziosmanpaşa", 39.8936, 32.8695], ["Dikmen", 39.8873, 32.8411], ["Balgat", 39.9036, 32.8233], ["Emek", 39.9139, 32.8135],
  ["Kavaklıdere", 39.9071, 32.8617], ["Bilkent", 39.8730, 32.7476], ["Ayrancı", 39.8977, 32.8478], ["Esat", 39.9111, 32.8711],
  ["Cebeci", 39.9301, 32.8780], ["Söğütözü", 39.9094, 32.8064], ["Beşevler", 39.9338, 32.8236], ["Necatibey", 39.9256, 32.8476],
];

function demoMapsUrl(name: string, i: number): string | undefined {
  const spot = DEMO_SPOTS.find(([k]) => name.includes(k));
  if (!spot) return undefined;
  // Aynı semtteki kayıtlar üst üste binmesin.
  const lat = spot[1] + ((i % 5) - 2) * 0.0012;
  const lng = spot[2] + ((i % 3) - 1) * 0.0015;
  return `https://www.google.com/maps/place/demo/data=!3d${lat.toFixed(6)}!4d${lng.toFixed(6)}`;
}

export function buildDemoBusinesses(today: DateStr): Business[] {
  return rows.map(([name, categories, district, phone, extra], i) => {
    const n = String(i + 1).padStart(2, "0");
    const foundDaysAgo = i < 26 ? 3 : 10 + i;
    return {
      id: `demo-${n}`,
      name,
      categories,
      phone,
      district,
      address: `Demo Cad. No:${i + 1}`,
      mapsUrl: demoMapsUrl(name, i),
      source: "demo",
      sourceId: `demo-place-${n}`,
      foundAt: istanbulToUtc(addDays(today, -foundDaysAgo), "07:30").toISOString(),
      verifiedAt: istanbulToUtc(addDays(today, -foundDaysAgo), "07:30").toISOString(),
      contacts: [],
      callStatus: "aranacak",
      salesStage: "yeni_aday",
      failedStreak: 0,
      ...extra,
    };
  });
}
