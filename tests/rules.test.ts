import { describe, expect, it } from "vitest";
import { formatPhone, normalizePhone, normalizeWebsite } from "@/lib/domain/contact-info";
import {
  dataIssues,
  decideCallOutcome,
  groupOpenTasks,
  recomputeFailedStreak,
  RuleError,
  selectDailyCandidates,
  type CandidateContext,
} from "@/lib/domain/rules";
import { addDays } from "@/lib/domain/time";
import type { Activity, Business, CallTask } from "@/lib/domain/types";

const TODAY = "2026-10-12";

function biz(over: Partial<Business> = {}): Business {
  return {
    id: "b1",
    name: "Test Diş",
    categories: ["dis"],
    phone: "0312 000 00 01",
    source: "demo",
    foundAt: "2026-10-01T05:00:00.000Z",
    contacts: [],
    callStatus: "aranacak",
    salesStage: "yeni_aday",
    failedStreak: 0,
    ...over,
  };
}

const ctx = (over: Partial<CandidateContext> = {}): CandidateContext => ({
  settings: { categories: ["estetik", "dis", "sac_sagligi", "sac_ekim"], districts: [] },
  businessIdsWithOpenTask: new Set(),
  businessIdsWithCallHistory: new Set(),
  ...over,
});

describe("arama sonucu kuralları", () => {
  it("ulaşılamayan kayıt ertesi güne takip görevi olarak taşınır", () => {
    const out = decideCallOutcome(biz(), { result: "ulasilamadi" }, TODAY);
    expect(out.patch.failedStreak).toBe(1);
    expect(out.patch.callStatus).toBe("ulasilamadi");
    expect(out.nextTask).toEqual({ reason: "ulasilamadi", dueDate: "2026-10-13", dueTime: undefined });
  });

  it("üçüncü ardışık başarısızlıkta beklemeye alınır ve görev açılmaz", () => {
    const out = decideCallOutcome(biz({ failedStreak: 2 }), { result: "ulasilamadi" }, TODAY);
    expect(out.patch.failedStreak).toBe(3);
    expect(out.patch.callStatus).toBe("beklemede");
    expect(out.nextTask).toBeUndefined();
    expect(out.activities.some((a) => a.type === "sistem")).toBe(true);
  });

  it("başarılı iletişim sayacı sıfırlar", () => {
    const out = decideCallOutcome(biz({ failedStreak: 2 }), { result: "gorusuldu" }, TODAY);
    expect(out.patch.failedStreak).toBe(0);
    expect(out.patch.salesStage).toBe("iletisim_kuruldu");
  });

  it("tekrar aranacak tarih ister ve o güne planlanır", () => {
    expect(() => decideCallOutcome(biz(), { result: "tekrar_aranacak" }, TODAY)).toThrow(RuleError);
    const out = decideCallOutcome(biz(), { result: "tekrar_aranacak", nextDate: "2026-10-16", nextTime: "14:30" }, TODAY);
    expect(out.nextTask).toEqual({ reason: "planlandi", dueDate: "2026-10-16", dueTime: "14:30" });
  });

  it("geçmiş tarihli planlama reddedilir", () => {
    expect(() =>
      decideCallOutcome(biz(), { result: "tekrar_aranacak", nextDate: "2026-10-11" }, TODAY),
    ).toThrow(RuleError);
  });

  it("ilgilenmiyor ve tekrar iletişim kurma yeni görev açmaz", () => {
    for (const result of ["ilgilenmiyor", "iletisim_kurma"] as const) {
      const out = decideCallOutcome(biz(), { result }, TODAY);
      expect(out.nextTask).toBeUndefined();
      expect(out.patch.nextActionDate).toBeUndefined();
    }
  });

  it("beklemedeki kayıt elle yeniden açılınca sayaç sıfırlanır ve görev açılır", () => {
    const out = decideCallOutcome(biz({ callStatus: "beklemede", failedStreak: 3 }), { result: "aranacak" }, TODAY);
    expect(out.patch.failedStreak).toBe(0);
    expect(out.nextTask?.dueDate).toBe(TODAY);
  });

  it("hatalı işaretlenen arama sayaçtan düşer", () => {
    const a = (at: string, callResult: Activity["callResult"], voidedAt?: string): Activity => ({
      id: at,
      businessId: "b1",
      at,
      type: "arama",
      callResult,
      voidedAt,
    });
    expect(
      recomputeFailedStreak([
        a("2026-10-08T08:00:00Z", "gorusuldu"),
        a("2026-10-09T08:00:00Z", "ulasilamadi"),
        a("2026-10-10T08:00:00Z", "ulasilamadi", "2026-10-10T09:00:00Z"),
        a("2026-10-11T08:00:00Z", "ulasilamadi"),
      ]),
    ).toBe(2);
  });
});

describe("ana ekran gruplaması", () => {
  const t = (over: Partial<CallTask>): CallTask => ({
    id: Math.random().toString(),
    businessId: "x",
    kind: "takip",
    reason: "planlandi",
    dueDate: TODAY,
    status: "acik",
    createdAt: "",
    ...over,
  });

  it("yeni adaylar takiplerden ayrı; gecikenler kaybolmaz; gelecek günler görünmez", () => {
    const g = groupOpenTasks(
      [
        t({ kind: "yeni", reason: "gunluk_liste" }),
        t({ kind: "yeni", reason: "gunluk_liste", dueDate: addDays(TODAY, -3) }),
        t({ reason: "ulasilamadi" }),
        t({ reason: "planlandi", dueTime: "14:00" }),
        t({ reason: "planlandi", dueDate: addDays(TODAY, 4) }),
      ],
      TODAY,
    );
    expect(g.yeni).toHaveLength(1);
    expect(g.gecikenler).toHaveLength(1);
    expect(g.dundenKalanlar).toHaveLength(1);
    expect(g.planlananlar).toHaveLength(1);
  });

  it("cumaya planlanan arama cuma günü görünür", () => {
    const friday = "2026-10-16";
    const tasks = [t({ dueDate: friday })];
    expect(groupOpenTasks(tasks, TODAY).planlananlar).toHaveLength(0);
    expect(groupOpenTasks(tasks, friday).planlananlar).toHaveLength(1);
  });
});

describe("günlük aday seçimi", () => {
  it("telefonsuz, kategorisiz, aranmış ve kapatılmış kayıtlar hedefe girmez", () => {
    const list = [
      biz({ id: "ok" }),
      biz({ id: "telefonsuz", phone: undefined }),
      biz({ id: "kategorisiz", categories: [] }),
      biz({ id: "kontrol", reviewReason: "Ortak telefon" }),
      biz({ id: "aranmis" }),
      biz({ id: "acik-gorev" }),
      biz({ id: "ilgilenmiyor", callStatus: "ilgilenmiyor" }),
      biz({ id: "musteri", salesStage: "musteri_oldu" }),
    ];
    const { selected, shortfallReason } = selectDailyCandidates(
      list,
      ctx({ businessIdsWithCallHistory: new Set(["aranmis"]), businessIdsWithOpenTask: new Set(["acik-gorev"]) }),
      20,
    );
    expect(selected.map((b) => b.id)).toEqual(["ok"]);
    expect(shortfallReason).toContain("1");
  });

  it("aynı girdiyle aynı listeyi verir ve hedefi aşmaz", () => {
    const list = Array.from({ length: 30 }, (_, i) =>
      biz({ id: `b${String(i).padStart(2, "0")}`, foundAt: `2026-10-0${(i % 9) + 1}T05:00:00Z` }),
    );
    const a = selectDailyCandidates(list, ctx(), 20);
    const b = selectDailyCandidates([...list].reverse(), ctx(), 20);
    expect(a.selected).toHaveLength(20);
    expect(a.shortfallReason).toBeUndefined();
    expect(a.selected.map((x) => x.id)).toEqual(b.selected.map((x) => x.id));
  });

  it("ilçe ve kategori tercihlerine uyar", () => {
    const list = [
      biz({ id: "cankaya-dis", district: "Çankaya" }),
      biz({ id: "mamak-dis", district: "Mamak" }),
      biz({ id: "cankaya-estetik", district: "Çankaya", categories: ["estetik"] }),
    ];
    const { selected } = selectDailyCandidates(
      list,
      ctx({ settings: { categories: ["dis"], districts: ["Çankaya"] } }),
      20,
    );
    expect(selected.map((b) => b.id)).toEqual(["cankaya-dis"]);
  });

  it("veri eksikleri doğru raporlanır", () => {
    expect(dataIssues({ phone: "12", categories: [] })).toEqual(["Geçerli telefon yok", "Kategori belirsiz"]);
  });
});

describe("iletişim bilgisi normalizasyonu", () => {
  it("telefon biçimleri aynı numaraya iner", () => {
    for (const raw of ["0312 427 48 48", "+90 (312) 427-4848", "903124274848", "3124274848", "00903124274848"]) {
      expect(normalizePhone(raw)).toBe("+903124274848");
    }
    expect(normalizePhone("427 48 48")).toBeUndefined();
    expect(formatPhone("+903124274848")).toBe("0312 427 48 48");
  });

  it("web sitesi alan adına iner", () => {
    expect(normalizeWebsite("https://www.Ornek.com.tr/iletisim")).toBe("ornek.com.tr");
    expect(normalizeWebsite("ornek.com.tr")).toBe("ornek.com.tr");
  });
});
