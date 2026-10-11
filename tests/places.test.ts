import { describe, expect, it } from "vitest";
import { decideImport, mapScrapedPlace } from "@/lib/domain/places";
import type { Business, PlaceInput } from "@/lib/domain/types";
import { MemoryRepository } from "@/lib/data/memory-store";
import { eventIdFor } from "../jobs/google-calendar";

const raw = (over: Record<string, unknown> = {}) => ({
  title: "Örnek Ağız ve Diş Sağlığı Polikliniği",
  category: "Diş Kliniği",
  categories: ["Diş Kliniği"],
  phone: "(0312) 417 00 04",
  web_site: "https://www.ornekdis.com.tr/",
  emails: [],
  place_id: "ChIJ27NztlRP0xQR-m2IxOeRRF0",
  link: "https://www.google.com/maps/place/Ornek",
  address: "Meşrutiyet Cd. 37/1, 06690 Çankaya/Ankara",
  complete_address: { borough: "Kültür", street: "Meşrutiyet Cd. 37/1", city: "Çankaya", state: "Ankara" },
  ...over,
});

describe("tarama sonucu dönüştürme", () => {
  it("diş kliniğini kategori, ilçe ve kaynak kimliğiyle dönüştürür", () => {
    const m = mapScrapedPlace(raw());
    expect("place" in m && m.place).toMatchObject({
      categories: ["dis"],
      district: "Çankaya",
      address: "Meşrutiyet Cd. 37/1, Kültür",
      source: "google_maps",
      sourceId: "ChIJ27NztlRP0xQR-m2IxOeRRF0",
      mapsUrl: "https://www.google.com/maps/place/Ornek",
    });
  });

  it("kamu kurumu, kuaför, kapalı ve Ankara dışı kayıtları eler", () => {
    expect(mapScrapedPlace(raw({ title: "T.C. Sağlık Bakanlığı Topraklık ADSM" }))).toEqual({ skip: "Kamu kurumu" });
    expect(mapScrapedPlace(raw({ web_site: "https://topraklikadsm.saglik.gov.tr" }))).toEqual({ skip: "Kamu kurumu" });
    expect(mapScrapedPlace(raw({ title: "Işıl Kuaför", category: "Kuaför", categories: ["Kuaför"] }))).toEqual({ skip: "Kuaför / güzellik salonu" });
    expect(mapScrapedPlace(raw({ status: "Kalıcı olarak kapalı" }))).toEqual({ skip: "Kalıcı olarak kapalı" });
    expect(mapScrapedPlace(raw({ complete_address: { city: "Kadıköy", state: "İstanbul" } }))).toEqual({ skip: "Ankara dışında" });
  });

  it("birden fazla kategori atar; belirsiz kategoriyi boş bırakır", () => {
    const m = mapScrapedPlace(raw({ title: "Kavaklıdere Saç Ekimi ve Estetik", category: "Sağlık merkezi", categories: [] }));
    expect("place" in m && m.place.categories.sort()).toEqual(["estetik", "sac_ekim"]);
    const u = mapScrapedPlace(raw({ title: "Yıldız Sağlık", category: "Sağlık merkezi", categories: [], web_site: null }));
    expect("place" in u && u.place.categories).toEqual([]);
  });

  it("bozuk dış veriyi reddeder", () => {
    expect(mapScrapedPlace({ title: "" })).toEqual({ skip: "Geçersiz kayıt" });
    expect(mapScrapedPlace(null)).toEqual({ skip: "Geçersiz kayıt" });
  });
});

describe("içe aktarma tekrar kontrolü", () => {
  const existing = [
    { id: "a", name: "Ana Klinik", source: "google_maps", sourceId: "P1", phone: "03124170004", website: "https://ana.com" },
  ] as Business[];
  const place = (over: Partial<PlaceInput>): PlaceInput => ({ name: "X", categories: ["dis"], source: "google_maps", sourceId: "P2", ...over });

  it("aynı kaynak kimliği güncellenir", () => {
    expect(decideImport(existing, place({ sourceId: "P1" }))).toEqual({ kind: "update", businessId: "a" });
  });
  it("ortak telefon veya site ayrı eklenir ama kontrole işaretlenir", () => {
    expect(decideImport(existing, place({ phone: "+90 312 417 00 04" }))).toMatchObject({ kind: "add", reviewReason: expect.stringContaining("Ortak telefon") });
    expect(decideImport(existing, place({ website: "http://www.ana.com/sube" }))).toMatchObject({ kind: "add", reviewReason: expect.stringContaining("Ortak web") });
  });
  it("yalnızca benzer isim birleştirme sebebi değildir", () => {
    expect(decideImport(existing, place({ name: "Ana Klinik" }))).toEqual({ kind: "add" });
  });
});

describe("yerel depo içe aktarma", () => {
  async function emptyRepo() {
    return new MemoryRepository({ seed: false });
  }
  const p = (i: number, over: Partial<PlaceInput> = {}): PlaceInput => ({
    name: `Klinik ${i}`,
    categories: ["dis"],
    phone: `0312 000 10 ${String(i).padStart(2, "0")}`,
    source: "google_maps",
    sourceId: `P${i}`,
    ...over,
  });

  it("aynı tarama iki kez çalışınca kopya oluşmaz, durum ve notlar korunur", async () => {
    const repo = await emptyRepo();
    const first = await repo.importPlaces([p(1), p(2)], 20);
    expect(first).toMatchObject({ added: 2, updated: 0 });
    const [b] = await repo.listBusinesses({ q: "Klinik 1" });
    await repo.recordCall(b.id, { result: "gorusuldu", note: "İlgilendi" });
    const second = await repo.importPlaces([p(1, { website: "https://yeni.com" }), p(2)], 20);
    expect(second).toMatchObject({ added: 0, updated: 2 });
    expect(await repo.listBusinesses({})).toHaveLength(2);
    const detail = await repo.getBusiness(b.id);
    expect(detail?.business.callStatus).toBe("gorusuldu");
    expect(detail?.business.website).toBe("https://yeni.com");
    expect(detail?.activities.some((a) => a.note === "İlgilendi")).toBe(true);
  });

  it("tarama limiti yeni kayıt sayısını sınırlar", async () => {
    const repo = await emptyRepo();
    const res = await repo.importPlaces([p(1), p(2), p(3)], 2);
    expect(res).toMatchObject({ added: 2, skipped: 0, overLimit: 1 });
  });

  it("eksik kalan günlük liste yeni adaylarla tamamlanır, kopya ve ikinci liste oluşmaz", async () => {
    const repo = await emptyRepo();
    await repo.importPlaces([p(1), p(2), p(3)], 20);
    const first = await repo.runDailyList("manuel");
    expect(first).toMatchObject({ created: true, added: 3 });
    expect(first.run.shortfallReason).toBeDefined();
    await repo.importPlaces([p(4), p(5)], 20);
    const second = await repo.runDailyList("manuel");
    expect(second).toMatchObject({ created: false, added: 2 });
    const third = await repo.runDailyList("manuel");
    expect(third.added).toBe(0);
    const home = await repo.getHome();
    expect(home.newTasks).toHaveLength(5);
    expect(new Set(home.newTasks.map((t) => t.business.id)).size).toBe(5);
    expect((await repo.listRuns(10))).toHaveLength(1);
  });

  it("telefonsuz kayıt eklenir ama günlük listeye girmez", async () => {
    const repo = await emptyRepo();
    await repo.importPlaces([p(1, { phone: undefined })], 20);
    const res = await repo.runDailyList("manuel");
    expect(res.added).toBe(0);
    const [b] = await repo.listBusinesses({ needsReview: true });
    expect(b.reviewReason).toContain("telefon");
  });

});

describe("Google Takvim", () => {
  it("etkinlik kimliği base32hex kurallarına uyar ve deterministiktir", () => {
    const id = eventIdFor("3f2b8c1e-9a4d-4e6f-b123-0a1b2c3d4e5f");
    expect(id).toBe("3f2b8c1e9a4d4e6fb1230a1b2c3d4e5f");
    expect(id).toMatch(/^[0-9a-v]{5,1024}$/);
  });
});

describe("kategori önceliği", () => {
  it("Google kategorisi isimdeki reklam kelimelerinden önce gelir", () => {
    const dental = mapScrapedPlace(raw({ title: "Diş Hekimi X - Gülüş Estetiği I İmplant", category: "Diş Kliniği", categories: ["Diş Kliniği"] }));
    expect("place" in dental && dental.place.categories).toEqual(["dis"]);
    const botox = mapScrapedPlace(raw({ title: "Botoks Ankara - Diş Sıkma Botoksu", category: "Medikal estetik kliniği", categories: ["Medikal estetik kliniği"] }));
    expect("place" in botox && botox.place.categories).toEqual(["estetik"]);
    const en = mapScrapedPlace(raw({ title: "British Esthetic Ankara", category: "Sağlık merkezi", categories: [] }));
    expect("place" in en && en.place.categories).toEqual(["estetik"]);
  });
});
