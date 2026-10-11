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
