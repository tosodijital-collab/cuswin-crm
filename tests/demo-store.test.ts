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
