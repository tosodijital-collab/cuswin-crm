import { describe, expect, it } from "vitest";
import { getDemoRepository } from "@/lib/data/memory-store";
import { buildFieldPlan, summarizeContacts, type AppointmentItem } from "@/lib/domain/field-plan";
import { buildFieldRoute } from "@/lib/domain/field-route";
import { decideVisitOutcome, RuleError, visitSummary } from "@/lib/domain/rules";
import type { Activity, Appointment, Business } from "@/lib/domain/types";

const TODAY = "2026-11-12";

function biz(over: Partial<Business> = {}): Business {
  return {
    id: "b1",
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

describe("ziyaret sonucu (aramadan ayrı)", () => {
  it("doktorla görüşme aşamayı ilerletir, sayacı sıfırlar, randevuyu tamamlar", () => {
    const o = decideVisitOutcome(biz({ salesStage: "randevu_alindi", failedStreak: 2 }), { result: "doktorla_gorusuldu" }, TODAY);
    expect(o.activities[0]).toEqual({ type: "ziyaret", visitResult: "doktorla_gorusuldu", note: undefined });
    expect(o.patch).toMatchObject({ salesStage: "gorusme_yapildi", callStatus: "gorusuldu", failedStreak: 0 });
    expect(o.completesAppointment).toBe(true);
    expect(o.nextTask).toBeUndefined();
  });

  it("arama kaydı üretmez ve ulaşılamama sayacına dokunmaz", () => {
    const o = decideVisitOutcome(biz({ failedStreak: 2 }), { result: "kapali" }, TODAY);
    expect(o.activities.every((a) => a.type !== "arama")).toBe(true);
    expect(o.patch.failedStreak).toBeUndefined();
    expect(o.completesAppointment).toBe(false);
  });

  it("aşamayı geri çekmez", () => {
    const o = decideVisitOutcome(biz({ salesStage: "teklif_gonderildi" }), { result: "doktorla_gorusuldu" }, TODAY);
    expect(o.patch.salesStage).toBeUndefined();
  });

  it("tekrar ara tarihi takip görevi açar; geçmiş tarih reddedilir", () => {
    const o = decideVisitOutcome(biz(), { result: "sekreterle_gorusuldu", nextDate: "2026-11-13", nextTime: "10:00" }, TODAY);
    expect(o.nextTask).toEqual({ reason: "planlandi", dueDate: "2026-11-13", dueTime: "10:00" });
    expect(o.patch).toMatchObject({ salesStage: "iletisim_kuruldu", nextActionDate: "2026-11-13" });
    expect(() => decideVisitOutcome(biz(), { result: "kapali", nextDate: "2026-11-01" }, TODAY)).toThrow(RuleError);
  });

  it("ilgilenmiyor kliniği listelerden çıkaracak duruma alır", () => {
    expect(decideVisitOutcome(biz(), { result: "ilgilenmiyor" }, TODAY).patch.callStatus).toBe("ilgilenmiyor");
    expect(visitSummary({ result: "ilgilenmiyor", note: "Kendi sekreteri var" })).toBe("Ziyaret: ilgilenmiyor. Kendi sekreteri var");
  });

  it("demo deposunda ziyaret arama sayısına girmez", async () => {
    const repo = getDemoRepository();
    const [b] = await repo.listBusinesses({});
    const before = (await repo.getHome()).counts.callsToday;
    await repo.recordVisit(b.id, { result: "kapali" });
    expect((await repo.getHome()).counts.callsToday).toBe(before);
    const history = await repo.listContactHistory();
    expect(history.find((a) => a.businessId === b.id && a.type === "ziyaret")?.visitResult).toBe("kapali");
  });
});

describe("saha planı: önce randevu", () => {
  const cay = biz({ id: "cay-1", name: "Çayyolu 1", address: "Osmanağa Konakları, Ümitköy" });
  const cay2 = biz({ id: "cay-2", name: "Çayyolu 2", address: "2494. Sk., Ümitköy" });
  const cay3 = biz({ id: "cay-3", name: "Çayyolu 3", address: "Alacaatlı" });
  const cay4 = biz({ id: "cay-4", name: "Çayyolu 4", address: "Yaşamkent" });
  const appt = (b: Business, startsAt: string, over: Partial<Appointment> = {}): AppointmentItem => ({
    business: b,
    appointment: { id: `a-${b.id}`, businessId: b.id, startsAt, meetingType: "yuz_yuze", status: "planlandi", reminderMinutes: 30, ...over },
  });
  const visit: Activity = { id: "v1", businessId: "cay-3", at: "2026-11-12T09:00:00Z", type: "ziyaret", visitResult: "kapali" };

  it("randevular o günün altında, randevulu ve ziyaret edilenler aranacaklarda değil", () => {
    const route = buildFieldRoute([cay, cay2, cay3, cay4], () => true);
    const plan = buildFieldPlan(
      route.days,
      [
        appt(cay, "2026-11-12T11:00:00Z"), // Per 14:00
        appt(cay2, "2026-11-20T08:00:00Z"), // saha günü dışında
        appt(cay4, "2026-11-12T07:00:00Z", { meetingType: "telefon" }), // yüz yüze değil
      ],
      summarizeContacts([visit]),
      new Date("2026-11-11T08:00:00Z"),
    );
    const day = plan.days.find((d) => d.view.day.id === "cayyolu")!;
    expect(day.appointments.map((v) => v.business.id)).toEqual(["cay-1"]);
    expect(day.toCall.map((s) => s.business.id)).toEqual(["cay-4"]);
    expect(day.visited.map((s) => s.business.id)).toEqual(["cay-3"]);
    expect(plan.otherAppointments.map((v) => v.business.id)).toEqual(["cay-2"]);
  });

  it("son arama ve son ziyaret ayrı tutulur", () => {
    const m = summarizeContacts([
      { id: "1", businessId: "x", at: "2026-11-10T08:00:00Z", type: "arama", callResult: "ulasilamadi" },
      { id: "2", businessId: "x", at: "2026-11-11T08:00:00Z", type: "arama", callResult: "gorusuldu" },
      { id: "3", businessId: "x", at: "2026-11-09T08:00:00Z", type: "ziyaret", visitResult: "kapali" },
    ]);
    expect(m.get("x")?.lastCall?.callResult).toBe("gorusuldu");
    expect(m.get("x")?.lastVisit?.visitResult).toBe("kapali");
  });
});

describe("satış kitinden kurallar", () => {
  it("görüşmeden sonra 3 gün, kapalıysa ertesi gün tarih önerilir; ilgilenmiyorsa önerilmez", async () => {
    const { suggestedFollowUp } = await import("@/lib/domain/rules");
    expect(suggestedFollowUp("demo_yapildi", TODAY)).toBe("2026-11-15");
    expect(suggestedFollowUp("sekreterle_gorusuldu", TODAY)).toBe("2026-11-15");
    expect(suggestedFollowUp("kapali", TODAY)).toBe("2026-11-13");
    expect(suggestedFollowUp("ilgilenmiyor", TODAY)).toBeUndefined();
  });

  it("demo yapıldı aşamayı görüşmeye taşır ve randevuyu tamamlar", () => {
    const o = decideVisitOutcome(biz({ salesStage: "randevu_alindi" }), { result: "demo_yapildi" }, TODAY);
    expect(o.patch.salesStage).toBe("gorusme_yapildi");
    expect(o.completesAppointment).toBe(true);
  });

  it("satış hunisi aşamaya ulaşanları sayar, olumsuzu ayrı tutar", async () => {
    const { salesFunnel } = await import("@/lib/domain/sales-playbook");
    const f = salesFunnel([
      { salesStage: "yeni_aday" },
      { salesStage: "yeni_aday" },
      { salesStage: "iletisim_kuruldu" },
      { salesStage: "randevu_alindi" },
      { salesStage: "musteri_oldu" },
      { salesStage: "olumsuz" },
    ]);
    expect(f.total).toBe(6);
    expect(f.lost).toBe(1);
    expect(f.steps.map((s) => s.count)).toEqual([3, 2, 1, 1, 1]);
    expect(f.steps[0].rate).toBe(50);
  });

  it("metinlerde pilot klinik adı ve 11 saniye yok", async () => {
    const pb = await import("@/lib/domain/sales-playbook");
    const all = JSON.stringify([pb.OBJECTIONS, pb.FOLLOW_UPS, pb.POSITIONING, pb.DO_RULES, pb.DONT_RULES]);
    expect(all).not.toMatch(/hakan|genç klinik|11 sn|11 saniye/i);
  });
});

describe("telefon rehberi", () => {
  it("pilot adı, 11 saniye ve 'daha çok hasta' vaadi yok; her senaryo tarih ister", async () => {
    const pb = await import("@/lib/domain/sales-playbook");
    const all = JSON.stringify([pb.PHONE_SCENARIOS, pb.PHONE_OBJECTIONS, pb.CLINIC_TYPE_LINES, pb.MISSED_CALL_TEXT, pb.PHONE_GOAL]);
    expect(all).not.toMatch(/hakan|11 sn|11 saniye|daha çok hasta getir/i);
    for (const s of pb.PHONE_SCENARIOS) {
      expect(JSON.stringify(s)).toMatch(/14:00|hangi gün/);
    }
    expect(pb.confirmationText("12 Kasım 14:00")).toBe("Merhaba, 12 Kasım 14:00'te kliniğinizdeyiz. 10 dakika sürecek. Görüşmek üzere. Özkan, Cuswin");
  });
});

describe("rehber içeriği", () => {
  it("en sık itirazlar listede var; pilot adı ve eski rakamlar yok; teklif yollanmaz", async () => {
    const g = await import("@/lib/domain/guide-content");
    const pb = await import("@/lib/domain/sales-playbook");
    for (const q of g.TOP_OBJECTIONS) expect(pb.OBJECTIONS.some((o) => o.q === q), q).toBe(true);
    const all = JSON.stringify([g.DOOR_STEPS, g.PRODUCT_QA, g.COMPETITORS]);
    expect(all).not.toMatch(/hakan|462|2\.934|%93|%60|11 sn|teklif şablon/i);
    expect(all).toContain("%53");
  });
});
