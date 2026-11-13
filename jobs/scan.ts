// Google Maps taraması: ayarlardaki kategori/ilçe tercihlerinden sorgu üretir, sonuçları ayıklayıp içe aktarır.
// GitHub Actions'taki zamanlanmış iş tarafından çalıştırılır.

import type { CrmRepository } from "@/lib/data/repository";
import { ANKARA_DISTRICTS } from "@/lib/domain/labels";
import { mapScrapedPlace } from "@/lib/domain/places";
import type { Category, PlaceInput, ScanRun, Settings } from "@/lib/domain/types";
import { runMapsQuery, ScraperError } from "./maps-scraper";
const QUERY_TERMS: Record<Category, string> = {
  dis: "diş kliniği",
  estetik: "estetik klinik",
  sac_ekim: "saç ekim merkezi",
  sac_sagligi: "saç sağlığı kliniği",
};

/** Merkez ilçeler önce; tercih yoksa Ankara geneli bu sırayla taranır. */
const DEFAULT_DISTRICT_ORDER = [
  "Çankaya", "Yenimahalle", "Keçiören", "Etimesgut", "Mamak", "Altındağ", "Sincan", "Gölbaşı", "Pursaklar",
  ...ANKARA_DISTRICTS.filter((d) => !["Çankaya", "Yenimahalle", "Keçiören", "Etimesgut", "Mamak", "Altındağ", "Sincan", "Gölbaşı", "Pursaklar"].includes(d)),
];

/** Bir taramada çalıştırılacak en fazla sorgu (Google'a yükü ve süreyi sınırlar). */
const MAX_QUERIES_PER_SCAN = 6;

/** Klinik yoğun merkez ilçeler: tam taramada sonuç listesi daha derin kaydırılır. */
const DENSE_DISTRICTS = new Set(["Çankaya", "Yenimahalle", "Keçiören", "Etimesgut", "Mamak", "Altındağ", "Sincan", "Gölbaşı", "Pursaklar"]);

export function buildQueries(settings: Pick<Settings, "categories" | "districts">): string[] {
  const districts = settings.districts.length ? settings.districts : DEFAULT_DISTRICT_ORDER;
  const queries: string[] = [];
  for (const d of districts) for (const c of settings.categories) queries.push(`${QUERY_TERMS[c]} ${d} Ankara`);
  return queries;
}

/** Taramayı çalıştırır ve bitince sonucu döner. */
export async function runScan(repo: CrmRepository): Promise<ScanRun> {
  const settings = await repo.getSettings();
  const all = buildQueries(settings);
  const cursor = (await repo.getScanCursor()) % all.length;
  const scan: ScanRun = {
    id: crypto.randomUUID(),
    startedAt: new Date().toISOString(),
    status: "calisiyor",
    limit: settings.scanLimit,
    queries: [],
    found: 0,
    added: 0,
    updated: 0,
    flagged: 0,
    skipped: 0,
    overLimit: 0,
  };
  await repo.saveScan(scan);
  await execute(repo, scan, all, cursor);
  return scan;
}

async function execute(repo: CrmRepository, scan: ScanRun, all: string[], cursor: number) {
  try {
    for (let i = 0; i < Math.min(MAX_QUERIES_PER_SCAN, all.length) && scan.added < scan.limit; i++) {
      const query = all[(cursor + i) % all.length];
      scan.queries.push(query);
      await repo.setScanCursor(cursor + i + 1);
      const raw = await runMapsQuery(query);
      scan.found += raw.length;
      const places: PlaceInput[] = [];
      for (const r of raw) {
        const m = mapScrapedPlace(r);
        if ("place" in m) places.push(m.place);
        else scan.skipped++;
      }
      const res = await repo.importPlaces(places, scan.limit - scan.added);
      scan.added += res.added;
      scan.updated += res.updated;
      scan.flagged += res.flagged;
      scan.skipped += res.skipped;
      scan.overLimit += res.overLimit;
      await repo.saveScan(scan);
    }
    scan.status = "tamam";
    if (scan.added < scan.limit) {
      scan.note = `${scan.queries.length} sorguda ${scan.added} yeni işletme bulundu; diğerleri zaten kayıtlı ya da hedef dışıydı. Sonraki tarama farklı ilçe ve kategorilerle devam eder.`;
    }
  } catch (e) {
    scan.status = "hata";
    scan.error = e instanceof ScraperError ? e.message : "Tarama beklenmedik bir hatayla durdu.";
    if (!(e instanceof ScraperError)) console.error("[tarama] beklenmedik hata", e instanceof Error ? e.message : e);
  }
  scan.finishedAt = new Date().toISOString();
  await repo.saveScan(scan);
}

/**
 * Google Maps bir aramada en fazla ~120 sonuç gösterir; "diş kliniği Çankaya" tüm Çankaya'yı getiremez.
 * Tam taramada klinik yoğun semtler ayrı ayrı aranır, ilçeler de ayrıca (yinelenenler place_id ile elenir).
 */
const DENSE_SEMTS = [
  // Çankaya
  "Kızılay", "Bahçelievler", "Çayyolu", "Ümitköy", "Balgat", "Dikmen", "Gaziosmanpaşa", "Kavaklıdere", "Tunalı Hilmi",
  "Ayrancı", "Emek", "Cebeci", "Kurtuluş", "Maltepe", "Sıhhiye", "Esat", "Yüzüncüyıl", "Çukurambar", "Söğütözü",
  "Bilkent", "Oran", "Yaşamkent", "Mutlukent", "Konutkent", "Öveçler", "Kızılırmak", "Anıttepe", "Beşevler", "Birlik",
  // Yenimahalle
  "Batıkent", "Demetevler", "Ostim", "Şentepe", "Karşıyaka Yenimahalle", "Yenimahalle merkez",
  // Keçiören, Etimesgut, Altındağ, Mamak, Sincan, Gölbaşı
  "Etlik", "Kalaba", "Aktepe", "Keçiören merkez", "Eryaman", "Elvankent", "Bağlıca", "Etimesgut merkez", "Ulus",
  "Aydınlıkevler", "Abidinpaşa", "Tuzluçayır", "Mamak merkez", "Sincan merkez", "Gölbaşı merkez", "İncek", "Pursaklar merkez",
];
const SEMT_TERMS = ["diş kliniği", "estetik klinik", "saç ekim merkezi"];

export type ScanQuery = { query: string; depth: number };

/** Tam taramanın tüm sorguları: semtler (orta derinlik) + her ilçe × kategori (merkez ilçelerde daha derin). */
export function fullQueries(categories: Category[]): ScanQuery[] {
  const out: ScanQuery[] = [];
  for (const semt of DENSE_SEMTS) for (const t of SEMT_TERMS) out.push({ query: `${t} ${semt} Ankara`, depth: 3 });
  for (const query of buildQueries({ categories, districts: [] })) {
    const district = query.replace(/ Ankara$/, "").split(" ").pop() ?? "";
    out.push({ query, depth: DENSE_DISTRICTS.has(district) ? 4 : 2 });
  }
  return out;
}

/**
 * Bir defalık tam Ankara taraması. Sorgular `shards` parçaya bölünür; her GitHub işi bir parçayı tarar
 * (paralel, farklı makineler). Eklenecek yeni işletme sınırı yok; art arda 3 hatada parça durur.
 */
export async function runFullScan(repo: CrmRepository, log: (m: string) => void, shard = 0, shards = 1): Promise<ScanRun> {
  const settings = await repo.getSettings();
  const all = fullQueries(settings.categories).filter((_, i) => i % shards === shard);
  const scan: ScanRun = {
    id: crypto.randomUUID(),
    startedAt: new Date().toISOString(),
    status: "calisiyor",
    limit: 100_000,
    queries: [],
    found: 0,
    added: 0,
    updated: 0,
    flagged: 0,
    skipped: 0,
    overLimit: 0,
  };
  await repo.saveScan(scan);
  let failures = 0;
  for (const [i, { query, depth }] of all.entries()) {
    try {
      const raw = await runMapsQuery(query, { depth, timeoutMs: 12 * 60_000 });
      scan.queries.push(query);
      scan.found += raw.length;
      const places: PlaceInput[] = [];
      for (const r of raw) {
        const m = mapScrapedPlace(r);
        if ("place" in m) places.push(m.place);
        else scan.skipped++;
      }
      const res = await repo.importPlaces(places, scan.limit - scan.added);
      scan.added += res.added;
      scan.updated += res.updated;
      scan.flagged += res.flagged;
      scan.skipped += res.skipped;
      log(`[${shard + 1}/${shards}] (${i + 1}/${all.length}) ${query}: ${raw.length} sonuç, ${res.added} yeni`);
      failures = 0;
    } catch (e) {
      failures++;
      log(`[${shard + 1}/${shards}] (${i + 1}/${all.length}) ${query}: atlandı (${e instanceof Error ? e.message : "hata"})`);
      // Art arda hata: Google erişimi kısıtlamış olabilir, zorlamadan dur.
      if (failures >= 3) {
        scan.status = "hata";
        scan.error = "Art arda 3 sorgu başarısız oldu; bu parça durduruldu. Bir süre sonra tekrar denenebilir.";
        break;
      }
    }
    await repo.saveScan(scan);
  }
  if (scan.status === "calisiyor") {
    scan.status = "tamam";
    scan.note = `Tam Ankara taraması (parça ${shard + 1}/${shards}): ${scan.queries.length} sorgu, ${scan.added} yeni işletme.`;
  }
  scan.finishedAt = new Date().toISOString();
  await repo.saveScan(scan);
  return scan;
}
