import { beforeEach, describe, expect, it, vi } from "vitest";

// Her test temiz bir demo deposu ile başlar.
async function freshRepo() {
  const { MemoryRepository } = await import("@/lib/data/memory-store");
  return new MemoryRepository();
}

describe("demo deposu", () => {
  beforeEach(() => vi.useRealTimers());

  it("günlük liste aynı gün ikinci kez oluşturulmaz", async () => {
    const repo = await freshRepo();
    const before = await repo.getHome();
    const res = await repo.runDailyList("manuel");
    const after = await repo.getHome();
    expect(res.created).toBe(false);
    expect(after.counts.newTotal).toBe(before.counts.newTotal);
    expect(after.newTasks.map((t) => t.task.id)).toEqual(before.newTasks.map((t) => t.task.id));
  });

  it("bugünkü liste 20 farklı işletme içerir ve takiplerden ayrıdır", async () => {
    const repo = await freshRepo();
    const home = await repo.getHome();
    expect(home.counts.newTotal).toBe(20);
    const newIds = new Set(home.newTasks.map((t) => t.business.id));
    expect(newIds.size).toBe(home.newTasks.length);
    const followIds = [...home.dundenKalanlar, ...home.gecikenler, ...home.planlananlar].map((t) => t.business.id);
    for (const id of followIds) expect(newIds.has(id)).toBe(false);
  });

  it("işletme başına en fazla bir açık görev olur", async () => {
    const repo = await freshRepo();
    const home = await repo.getHome();
    const target = home.newTasks[0].business.id;
    await repo.recordCall(target, { result: "ulasilamadi" });
    await repo.recordCall(target, { result: "tekrar_aranacak", nextDate: "2099-01-01" });
    const detail = await repo.getBusiness(target);
    expect(detail?.openTask?.dueDate).toBe("2099-01-01");
    const after = await repo.getHome();
    const all = [...after.newTasks, ...after.dundenKalanlar, ...after.gecikenler, ...after.planlananlar];
    expect(all.filter((t) => t.business.id === target)).toHaveLength(0);
  });

  it("aynı telefonla ikinci işletme eklenemez", async () => {
    const repo = await freshRepo();
    await expect(
      repo.createBusiness({ name: "Kopya", categories: ["dis"], phone: "+90 312 000 01 01", contacts: [] }),
    ).rejects.toThrow("zaten kayıtlı");
  });

  it("telefonsuz manuel kayıt kontrol listesine düşer", async () => {
    const repo = await freshRepo();
    const id = await repo.createBusiness({ name: "Telefonsuz Klinik", categories: ["estetik"], contacts: [] });
    const detail = await repo.getBusiness(id);
    expect(detail?.business.reviewReason).toContain("telefon");
  });

  it("iptal edilen randevu planlı listeden çıkar, geçmişte görünür", async () => {
    const repo = await freshRepo();
    const appts = await repo.listAppointments();
    const planned = appts.find((a) => a.appointment.status === "planlandi")!;
    await repo.cancelAppointment(planned.appointment.id);
    const after = await repo.listAppointments();
    expect(after.find((a) => a.appointment.id === planned.appointment.id)?.appointment.status).toBe("iptal");
  });
});

describe("ileri günleri planlama", () => {
  it("boş günlere farklı klinikler atar, dolu günü tekrar doldurmaz", async () => {
    const { MemoryRepository } = await import("@/lib/data/memory-store");
    const { addDays, toDateStr } = await import("@/lib/domain/time");
    const repo = new MemoryRepository();
    const today = toDateStr(new Date());
    const days = [addDays(today, 1), addDays(today, 2)];
    const first = await repo.planDays(days);
    const tasks = (await repo.listUpcomingTasks(days[0], days[1])).filter((t) => t.task.kind === "yeni");
    const ids = tasks.map((t) => t.business.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(first.reduce((n, r) => n + r.added, 0)).toBe(tasks.length);
    const again = await repo.planDays(days);
    expect(again.every((r) => r.added === 0)).toBe(true);
  });
});

describe("yanlış sonucu geri alma (demo deposu)", () => {
  it("ilgilenmiyor yanlışlıkla girildiyse klinik bugünün listesine aynı görevle döner", async () => {
    const { MemoryRepository } = await import("@/lib/data/memory-store");
    const repo = new MemoryRepository();
    const home = await repo.getHome();
    const target = home.newTasks[0];
    await repo.recordCall(target.business.id, { result: "ilgilenmiyor" });
    expect((await repo.getHome()).newTasks.some((t) => t.task.id === target.task.id)).toBe(false);
    await repo.undoLastCall(target.business.id);
    const after = await repo.getHome();
    expect(after.newTasks.some((t) => t.task.id === target.task.id)).toBe(true);
    const detail = await repo.getBusiness(target.business.id);
    expect(detail?.business.callStatus).toBe(target.business.callStatus);
  });
});
