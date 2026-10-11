// gosom/google-maps-scraper çalıştırıcısı. GitHub Actions'ta Docker imajı (GMAPS_SCRAPER_IMAGE),
// yerelde ikili dosya (GMAPS_SCRAPER_BIN). Düşük hız: tek tarayıcı, tek kaydırma, proxy yok, CAPTCHA aşma yok.

import { execFile } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const QUERY_TIMEOUT_MS = 5 * 60_000;

export function isScraperConfigured(): boolean {
  return Boolean(process.env.GMAPS_SCRAPER_IMAGE?.trim() || process.env.GMAPS_SCRAPER_BIN?.trim());
}

export class ScraperError extends Error {}

/** Tek bir arama sorgusu çalıştırır ve ham JSON kayıtlarını döner. */
export async function runMapsQuery(query: string): Promise<unknown[]> {
  const image = process.env.GMAPS_SCRAPER_IMAGE?.trim();
  const bin = process.env.GMAPS_SCRAPER_BIN?.trim();
  if (!image && !bin) throw new ScraperError("Tarayıcı ayarlı değil (GMAPS_SCRAPER_IMAGE veya GMAPS_SCRAPER_BIN).");

  const workDir = path.resolve(process.env.GMAPS_SCRAPER_WORKDIR ?? ".data/scraper");
  await mkdir(workDir, { recursive: true });
  const input = path.join(workDir, "queries.txt");
  const output = path.join(workDir, "results.json");
  await rm(output, { force: true });
  await writeFile(input, `${query.replace(/[\r\n]/g, " ")}\n`, "utf8");

  const flags = (dir: string) => ["-input", `${dir}/queries.txt`, "-results", `${dir}/results.json`, "-json", "-depth", "1", "-c", "1", "-lang", "tr", "-exit-on-inactivity", "2m"];
  const [cmd, args]: [string, string[]] = image
    ? ["docker", ["run", "--rm", "-v", `${workDir}:/work`, image, ...flags("/work")]]
    : [bin!, flags(workDir)];
  await new Promise<void>((resolve, reject) => {
    execFile(cmd, args, { cwd: workDir, timeout: QUERY_TIMEOUT_MS, maxBuffer: 20 * 1024 * 1024 }, (err) => {
      if (!err) return resolve();
      const reason = err.killed ? "zaman aşımı" : `çıkış kodu ${err.code ?? "?"}`;
      reject(new ScraperError(`Tarayıcı durdu (${reason}).`));
    });
  });

  let raw: string;
  try {
    raw = (await readFile(output, "utf8")).trim();
  } catch {
    throw new ScraperError("Tarayıcı sonuç dosyası üretmedi. Google erişimi engellemiş olabilir.");
  }
  if (!raw) return [];
  try {
    return raw.startsWith("[") ? (JSON.parse(raw) as unknown[]) : raw.split("\n").filter(Boolean).map((l) => JSON.parse(l));
  } catch {
    throw new ScraperError("Tarayıcı çıktısı okunamadı.");
  }
}
