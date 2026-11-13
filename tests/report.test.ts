import { describe, expect, it } from "vitest";
import { recordVisitAction } from "@/lib/actions";
import { getRepository } from "@/lib/data";
import { buildActivityReport, goalProgress, REFERRAL_NOTE_PREFIX, reportText, weekStart } from "@/lib/domain/report";
import type { Activity } from "@/lib/domain/types";

const at = (day: string, h = "10") => `${day}T${h}:00:00+03:00`;
const a = (over: Partial<Activity>): Activity => ({ id: Math.random().toString(36), businessId: "b", at: at("2026-11-12"), type: "not", ...over });

describe("gün sonu raporu", () => {
  const acts: Activity[] = [
    a({ type: "arama", callResult: "gorusuldu" }),
    a({ type: "arama", callResult: "ulasilamadi" }),
    a({ type: "arama", callResult: "tekrar_aranacak" }),
    a({ type: "randevu", note: "12 Kasım 14:00" }),
    a({ type: "randevu", note: "Randevu değiştirildi: 13 Kasım" }),
    a({ type: "randevu", note: "Görüşme yapıldı: demo" }),
    a({ type: "ziyaret", visitResult: "demo_yapildi" }),
    a({ type: "ziyaret", visitResult: "kapali" }),
    a({ type: "not", note: `${REFERRAL_NOTE_PREFIX}: X önerdi.` }),
    a({ type: "asama", stage: "teklif_gonderildi" }),
    a({ type: "asama", stage: "musteri_oldu" }),
    a({ type: "arama", callResult: "gorusuldu", at: at("2026-11-11") }),
    a({ type: "arama", callResult: "gorusuldu", voidedAt: "2026-11-12T12:00:00Z" }),
  ];

  it("günün sayılarını doğru çıkarır; iptal, değişiklik ve hatalı kayıtları saymaz", () => {
    const r = buildActivityReport(acts, "2026-11-12", "2026-11-12");
    expect(r).toMatchObject({ calls: 3, reached: 2, unreachable: 1, appointmentsBooked: 1, visits: 2, demos: 1, referrals: 1, offers: 1, newCustomers: 1 });
    expect(r.visitsBy).toEqual({ demo_yapildi: 1, kapali: 1 });
    expect(buildActivityReport(acts, "2026-11-11", "2026-11-12").calls).toBe(4);
  });

  it("Türkiye saatine göre gün sayar (gece yarısından sonra ertesi gün)", () => {
    const late = [a({ type: "arama", callResult: "gorusuldu", at: "2026-11-12T21:30:00Z" })]; // 13 Kasım 00:30
    expect(buildActivityReport(late, "2026-11-12", "2026-11-12").calls).toBe(0);
    expect(buildActivityReport(late, "2026-11-13", "2026-11-13").calls).toBe(1);
  });

  it("hedef: 30 günde 5 müşteri, kalan gün", () => {
    const g = goalProgress([{ salesStage: "musteri_oldu" }, { salesStage: "yeni_aday" }], "2026-11-12");
    expect(g).toMatchObject({ customers: 1, target: 5, daysLeft: 30, daysTotal: 30, started: true });
    expect(goalProgress([], "2026-11-10").started).toBe(false);
    expect(goalProgress([], "2026-12-11").daysLeft).toBe(1);
  });

  it("hafta pazartesi başlar; özet metni hedefi içerir", () => {
    expect(weekStart("2026-11-12")).toBe("2026-11-09");
    expect(weekStart("2026-11-09")).toBe("2026-11-09");
    expect(weekStart("2026-11-15")).toBe("2026-11-09");
    const text = reportText("bugün", buildActivityReport(acts, "2026-11-12", "2026-11-12"), goalProgress([], "2026-11-12"));
    expect(text).toContain("Randevu alındı: 1");
    expect(text).toContain("0/5 müşteri");
  });
});

describe("tanıştırma yeni kayıt olur", () => {
  it("ziyaret sonucu tanıştırma adıyla aranacak yeni klinik açar", async () => {
    const repo = getRepository();
    const [from] = await repo.listBusinesses({});
    const fd = new FormData();
    fd.set("businessId", from.id);
    fd.set("result", "demo_yapildi");
    fd.set("referralName", "Tanıştırma Test Kliniği");
    fd.set("referralPhone", "0532 999 88 77");
    const res = await recordVisitAction({ ok: false }, fd);
    expect(res.ok).toBe(true);
    expect(res.message).toContain("aranacaklara eklendi");
    const [created] = await repo.listBusinesses({ q: "Tanıştırma Test" });
    expect(created).toMatchObject({ callStatus: "aranacak", categories: from.categories });
    const detail = await repo.getBusiness(created.id);
    expect(detail?.activities.some((x) => x.note?.startsWith(REFERRAL_NOTE_PREFIX))).toBe(true);
    // Aynı telefonla ikinci tanıştırma kopya açmaz.
    const again = await recordVisitAction({ ok: false }, fd);
    expect(again.message).toContain("eklenmedi");
  });
});

describe("dönemler, gün gün ve dönüşüm", () => {
  it("bugün/hafta/ay ve kıyas dönemi", async () => {
    const { periodRange, monthStart } = await import("@/lib/domain/report");
    expect(monthStart("2026-11-13")).toBe("2026-11-01");
    expect(periodRange("gun", "2026-11-13")).toMatchObject({ from: "2026-11-13", prevFrom: "2026-11-12", prevTo: "2026-11-12", vs: "düne göre" });
    // 13 Kasım cuma: hafta pazartesi 9'unda başlar; kıyas 2–6 Kasım
    expect(periodRange("hafta", "2026-11-13")).toMatchObject({ from: "2026-11-09", to: "2026-11-13", prevFrom: "2026-11-02", prevTo: "2026-11-06" });
    expect(periodRange("ay", "2026-11-13")).toMatchObject({ from: "2026-11-01", prevFrom: "2026-10-01", prevTo: "2026-10-13" });
    // 31 Mart: geçen ay şubat 28'de biter
    expect(periodRange("ay", "2026-03-31")).toMatchObject({ prevFrom: "2026-02-01", prevTo: "2026-02-28" });
  });

  it("gün gün satırlar ve oranlar; gönderilen mesajlar sayılır", async () => {
    const { buildActivityReport, conversionRates, dailyBreakdown } = await import("@/lib/domain/report");
    const acts = [
      { id: "1", businessId: "b", at: "2026-11-12T08:00:00Z", type: "arama", callResult: "gorusuldu" },
      { id: "2", businessId: "b", at: "2026-11-13T08:00:00Z", type: "arama", callResult: "ulasilamadi" },
      { id: "3", businessId: "b", at: "2026-11-13T09:00:00Z", type: "arama", callResult: "tekrar_aranacak", note: "Tanıtım dosyası WhatsApp'tan gönderildi (0532 000 00 00)." },
      { id: "4", businessId: "b", at: "2026-11-13T10:00:00Z", type: "not", note: "Mesaj gönderildi: randevu teyidi" },
    ] as Activity[];
    const rows = dailyBreakdown(acts, "2026-11-12", "2026-11-13");
    expect(rows.map((r) => [r.date, r.calls, r.reached])).toEqual([
      ["2026-11-13", 2, 1],
      ["2026-11-12", 1, 1],
    ]);
    const r = buildActivityReport(acts, "2026-11-12", "2026-11-13");
    expect(r.messages).toBe(2);
    expect(conversionRates(r)[0]).toMatchObject({ value: 67, detail: "2/3" });
    expect(conversionRates(r)[2].value).toBeUndefined();
  });
});
