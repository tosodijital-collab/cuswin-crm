// gosom/google-maps-scraper çalıştırıcısı. Yerelde ikili dosya (GMAPS_SCRAPER_BIN) kullanılır;
// sunucuda aynı araç Docker container olarak çalışacak. Düşük hız: tek tarayıcı, sonuç listesinde tek kaydırma,
// proxy yok, CAPTCHA aşma yok.

import "server-only";
import { execFile } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const QUERY_TIMEOUT_MS = 5 * 60_000;

export function scraperBin(): string | undefined {
  return process.env.GMAPS_SCRAPER_BIN?.trim() || undefined;
}

export class ScraperError extends Error {}

/** Tek bir arama sorgusu çalıştırır ve ham JSON kayıtlarını döner. */
export async function runMapsQuery(query: string): Promise<unknown[]> {
  const bin = scraperBin();
  if (!bin) throw new ScraperError("Tarayıcı ayarlı değil (GMAPS_SCRAPER_BIN).");

  const workDir = path.resolve(/*turbopackIgnore: true*/ process.env.GMAPS_SCRAPER_WORKDIR ?? ".data/scraper");
  await mkdir(workDir, { recursive: true });
  const input = path.join(workDir, "queries.txt");
  const output = path.join(workDir, "results.json");
  await rm(output, { force: true });
  await writeFile(input, `${query.replace(/[\r\n]/g, " ")}\n`, "utf8");

  const args = ["-input", input, "-results", output, "-json", "-depth", "1", "-c", "1", "-lang", "tr", "-exit-on-inactivity", "2m"];
  await new Promise<void>((resolve, reject) => {
    execFile(/*turbopackIgnore: true*/ bin, args, { cwd: workDir, timeout: QUERY_TIMEOUT_MS, maxBuffer: 20 * 1024 * 1024 }, (err) => {
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
