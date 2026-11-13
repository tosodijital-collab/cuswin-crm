import { describe, expect, it } from "vitest";
import { geocodeQuery, mapPoints, nearAnkara, nextStop } from "@/lib/domain/map-points";
import { DEMO, demoWhatsappHref, insightLine, parseInsights, withInsights } from "@/lib/domain/sales-playbook";
import type { Business } from "@/lib/domain/types";

const biz = (id: string, lat: number | undefined, extra: Partial<Business> = {}): Business => ({
  id,
  name: id,
  categories: ["estetik"],
  source: "google_maps",
  foundAt: "2026-11-01T00:00:00Z",
  contacts: [],
  callStatus: "aranacak",
  salesStage: "yeni_aday",
  failedStreak: 0,
  mapsUrl: lat === undefined ? undefined : `https://www.google.com/maps/place/x/data=!3d${lat}!4d32.85`,
  ...extra,
});

describe("görüşmede öğrenilenler", () => {
  it("satıra yazar, geri okur, sıcaklığı bilir", () => {
    const line = insightLine(["aksam", "ajans"]);
    expect(line).toBe("Öğrenilen: Akşam / hafta sonu bakan yok · Reklam ajansı var");
    expect(parseInsights(withInsights("Doktorla konuştum", line))).toEqual({
      labels: ["Akşam / hafta sonu bakan yok", "Reklam ajansı var"],
      hot: true,
    });
    expect(parseInsights(insightLine(["ajans"])).hot).toBe(false);
    expect(parseInsights("sadece not")).toEqual({ labels: [], hot: false });
    expect(withInsights(undefined, undefined)).toBeUndefined();
    expect(insightLine([])).toBe("");
  });
});

describe("canlı demo", () => {
  it("demo hattına hazır mesajla WhatsApp açar", () => {
    expect(demoWhatsappHref("Merhaba")).toBe("https://wa.me/908505100946?text=Merhaba");
    expect(DEMO.phone.replace(/\D/g, "")).toBe("08505100946");
  });
});

describe("saha haritası: sıradaki ve adres", () => {
  it("sıradaki en yakın gidilmemiş kliniği seçer", () => {
    const { points } = mapPoints(
      [biz("burada", 39.9), biz("yakin-kapali", 39.9001, { callStatus: "ilgilenmiyor" }), biz("yakin", 39.902), biz("uzak", 39.95)],
      [],
      new Map(),
      new Date("2026-11-13T09:00:00Z"),
    );
    expect(nextStop(points, "burada")?.point.business.id).toBe("yakin");
    expect(nextStop(points, "yok")).toBeUndefined();
  });

  it("adresten bulunan konum yaklaşık işaretlenir", () => {
    const { points, missing } = mapPoints([biz("adres", undefined)], [], new Map(), new Date(), new Map([["adres", { lat: 39.9, lng: 32.8 }]]));
    expect(missing).toBe(0);
    expect(points[0].approx).toBe(true);
  });

  it("adres sorgusu yalnızca açık adres varsa yapılır", () => {
    expect(geocodeQuery({ address: "Kızılırmak Mah. 1443. Cad. No:5", district: "Çankaya" })).toBe(
      "Kızılırmak Mah. 1443. Cad. No:5, Çankaya, Ankara, Türkiye",
    );
    expect(geocodeQuery({ district: "Çankaya" })).toBeUndefined();
    expect(geocodeQuery({ address: "Demo Cad. No:3" })).toBeUndefined();
    expect(nearAnkara({ lat: 41.0, lng: 29.0 })).toBe(false);
    expect(nearAnkara({ lat: 39.92, lng: 32.85 })).toBe(true);
  });
});
