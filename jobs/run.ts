// GitHub Actions işi: Google Maps taraması + günün listesini tamamlama.
// Supabase'deki dakikalık "tick" fonksiyonu her sabah 08.00'de ve "Şimdi tara" isteğinde bu işi tetikler.
// Kullanım: tsx jobs/run.ts daily

import { createClient } from "@supabase/supabase-js";
import { SupabaseRepository } from "@/lib/data/supabase-repository";
import { isScraperConfigured } from "./maps-scraper";
import { runFullScan, runScan } from "./scan";

function env(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`${name} tanımlı değil.`);
  return v;
}

function log(msg: string) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

async function main() {
  const task = process.argv[2];
  if (task !== "daily" && task !== "full") throw new Error("Kullanım: tsx jobs/run.ts daily|full");
  const db = createClient(env("SUPABASE_URL"), env("SUPABASE_SECRET_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const repo = new SupabaseRepository(db);
  try {
    if (task === "full") {
      if (!isScraperConfigured()) throw new Error("Tarayıcı ayarlı değil.");
      const shard = Number(process.env.SHARD ?? 0);
      const shards = Number(process.env.SHARDS ?? 1);
      const scan = await runFullScan(repo, log, shard, shards);
      log(`Tam tarama ${scan.status}: ${scan.found} sonuç, ${scan.added} yeni, ${scan.updated} tazelendi${scan.error ? `, ${scan.error}` : ""}`);
      return;
    }
    if (!isScraperConfigured()) {
      log("Tarayıcı ayarlı değil, tarama atlandı.");
    } else {
      const scan = await runScan(repo);
      log(`Tarama ${scan.status}: ${scan.found} sonuç, ${scan.added} yeni, ${scan.updated} tazelendi, ${scan.skipped} elendi${scan.error ? `, hata: ${scan.error}` : ""}`);
    }
    // Liste yoksa oluşturur, hedefin altındaysa yeni adaylarla tamamlar; tamamsa dokunmaz.
    const res = await repo.runDailyList("manuel");
    log(`Günlük liste: ${res.created ? "oluşturuldu" : "vardı"}, eklenen ${res.added}, toplam ${res.run.selected}/${res.run.target}`);
  } finally {
    const { error } = await db.from("scan_requests").update({ status: "bitti" }).eq("status", "alindi");
    if (error) log(`Tarama isteği kapatılamadı: ${error.message}`);
  }
}

main().catch((e) => {
  log(`HATA: ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
});
