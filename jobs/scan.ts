// Google Maps taraması: ayarlardaki kategori/ilçe tercihlerinden sorgu üretir, sonuçları ayıklayıp içe aktarır.
// Sunucu aşamasında bu akış pg-boss işi olarak çalışacak; şimdilik sunucu sürecinde arka planda çalışır.

import "server-only";
import { getRepository } from "@/lib/data";
import { ANKARA_DISTRICTS } from "@/lib/domain/labels";
import { mapScrapedPlace } from "@/lib/domain/places";
import type { Category, PlaceInput, ScanRun, Settings } from "@/lib/domain/types";
import { runMapsQuery, ScraperError } from "@/lib/integrations/maps-scraper";

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

export function buildQueries(settings: Pick<Settings, "categories" | "districts">): string[] {
  const districts = settings.districts.length ? settings.districts : DEFAULT_DISTRICT_ORDER;
  const queries: string[] = [];
  for (const d of districts) for (const c of settings.categories) queries.push(`${QUERY_TERMS[c]} ${d} Ankara`);
  return queries;
}

let running = false;

/** Taramayı başlatır ve hemen döner. Aynı anda tek tarama çalışır. */
export async function startScan(): Promise<{ started: boolean; message: string }> {
  if (running) return { started: false, message: "Bir tarama zaten çalışıyor." };
  const repo = getRepository();
  const settings = await repo.getSettings();
  if (!settings.scannerConfigured) return { started: false, message: "Tarayıcı bu sunucuda ayarlı değil." };

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
  running = true;
  await repo.saveScan(scan);
  void execute(scan, all, cursor).finally(() => {
    running = false;
  });
  return { started: true, message: `Tarama başladı, en fazla ${settings.scanLimit} yeni işletme eklenecek. Birkaç dakika sürebilir.` };
}

async function execute(scan: ScanRun, all: string[], cursor: number) {
  const repo = getRepository();
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
