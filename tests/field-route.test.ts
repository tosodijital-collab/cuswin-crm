import { describe, expect, it } from "vitest";
import { buildFieldRoute, dayDirectionsHref, placeOnRoute, whatsappHref } from "@/lib/domain/field-route";
import type { Business } from "@/lib/domain/types";

function biz(over: Partial<Business> = {}): Business {
  return {
    id: over.name ?? "b1",
    name: "Klinik",
    categories: ["estetik"],
    source: "demo",
    foundAt: "2026-10-01T05:00:00.000Z",
    contacts: [],
    callStatus: "aranacak",
    salesStage: "yeni_aday",
    failedStreak: 0,
    district: "Çankaya",
    ...over,
  };
}

const day = (address: string, district = "Çankaya") => placeOnRoute({ address, district })?.dayId;

describe("saha rotası: adres → gün", () => {
  it("gerçek CRM adreslerini doğru güne koyar", () => {
    expect(day("YDA Center, Dumlupınar Blv. A3 Blok Kat:11 No:447 / C, Kızılırmak")).toBe("cukurambar-bina");
    expect(day("1071 Usta Ankara İş ve Yaşam Merkezi, 1443. Cd. B Blok 25B/130")).toBe("cukurambar-bina");
    expect(day("Mustafa Kemal Mahallesi, Dumlupınar Bulvarı Tepe Prime Avenue, B Blok")).toBe("cukurambar-bina");
    expect(day("Kızılırmak Mahallesi, 1443. Cd. No: 49 D:E, Çukurambar")).toBe("cukurambar-cadde");
    expect(day("1467. Sk. no: 8 D:34 B, Çukurambar")).toBe("cukurambar-cadde");
    expect(day("Tunalı Hilmi Cd. No:88 D:114, Kavaklıdere")).toBe("kavaklidere");
    expect(day("Uğur Mumcu Cd. No:6 Kat:4 D:30, Kazım Özalp")).toBe("kavaklidere");
    expect(day("Gökçen iş hanı, Ziya Gökalp Cd. No:9 D:12 kat 7, Cumhuriyet")).toBe("merkez");
    expect(day("Turan Güneş Bulvarı, 630. Sk. No:6, Oran")).toBe("merkez");
    expect(day("1332. Sk., Aşağı Öveçler")).toBe("merkez");
    expect(day("Neorama İş Merkezi, Kat:13 No:61, Yaşam Cd., Beştepe")).toBe("sogutozu-yenimahalle");
    expect(day("Osmanağa Konakları, 2494/3. Sk. No:9, Ümit")).toBe("cayyolu");
    expect(day("3047. Sk. No:13, Yaşamkent")).toBe("cayyolu");
  });

  it("Yenimahalle ilçesi adresteki mahalle adından önce gelir", () => {
    expect(day("Vatan Cd. No:81, Demetevler", "Yenimahalle")).toBe("sogutozu-yenimahalle");
    expect(day("Cumhuriyet Mah. 12. Sk.", "Yenimahalle")).toBe("sogutozu-yenimahalle");
  });

  it("sözcük ortasında eşleşmez, bilinmeyen adres rotaya girmez", () => {
    expect(day("Koran Sk. No:3, Etimesgut", "Etimesgut")).toBeUndefined();
    expect(placeOnRoute({ address: undefined, district: undefined })).toBeUndefined();
  });

  it("gün içinde aynı bina art arda gelir", () => {
    const route = buildFieldRoute(
      [
        biz({ name: "Usta", address: "Usta Plaza, 1443. Cd. C Blok" }),
        biz({ name: "YDA-1", address: "YDA Center A Blok" }),
        biz({ name: "Tepe", address: "Tepe Prime Avenue" }),
        biz({ name: "YDA-2", address: "YDA Center A2 Blok" }),
      ],
      () => true,
    );
    expect(route.days.find((d) => d.day.id === "cukurambar-bina")!.stops.map((s) => s.business.name)).toEqual(["YDA-1", "YDA-2", "Usta", "Tepe"]);
  });

  it("müşteri, olumsuz ve ilgilenmeyenleri çıkarır; beklemedekini tutar", () => {
    const a = "1443. Cd. No:1, Çukurambar";
    const route = buildFieldRoute(
      [
        biz({ name: "Aday", address: a }),
        biz({ name: "Müşteri", address: a, salesStage: "musteri_oldu" }),
        biz({ name: "Olumsuz", address: a, salesStage: "olumsuz" }),
        biz({ name: "İlgisiz", address: a, callStatus: "ilgilenmiyor" }),
        biz({ name: "Beklemede", address: a, callStatus: "beklemede" }),
        biz({ name: "Bilinmeyen", address: "Bir yer" }),
      ],
      () => true,
    );
    expect(route.days.find((d) => d.day.id === "cukurambar-cadde")!.stops.map((s) => s.business.name).sort()).toEqual(["Aday", "Beklemede"]);
    expect(route.excluded).toBe(3);
    expect(route.unplaced.map((b) => b.name)).toEqual(["Bilinmeyen"]);
  });
});

describe("saha takvimi", () => {
  it("perşembe Çayyolu ile başlar, günler tarih sırasıyla gelir", () => {
    const route = buildFieldRoute([], () => true);
    expect(route.days[0].day.id).toBe("cayyolu");
    expect(route.days[0].day.date).toBe("2026-11-12");
    const dates = route.days.map((d) => d.day.date);
    expect(dates).toEqual([...dates].sort());
    expect(new Set(dates).size).toBe(dates.length);
  });
});

describe("saha bağlantıları", () => {
  it("aynı adresi bir kez koyar, en çok 9 ara durak", () => {
    const stops = Array.from({ length: 12 }, (_, i) => ({ business: biz({ address: `Adres ${i}` }), order: i }));
    stops.push({ business: biz({ address: "Adres 11" }), order: 12 });
    const url = new URL(dayDirectionsHref(stops)!);
    expect(url.searchParams.get("destination")).toBe("Adres 11, Çankaya, Ankara");
    expect(url.searchParams.get("waypoints")!.split("|")).toHaveLength(9);
    expect(dayDirectionsHref([])).toBeUndefined();
  });

  it("WhatsApp yalnızca cep numarasına", () => {
    expect(whatsappHref("0532 156 56 72", "Merhaba")).toBe("https://wa.me/905321565672?text=Merhaba");
    expect(whatsappHref("+90 532 156 56 72", "x")).toContain("wa.me/905321565672");
    expect(whatsappHref("0312 467 35 66", "x")).toBeUndefined();
    expect(whatsappHref(undefined, "x")).toBeUndefined();
  });
});
