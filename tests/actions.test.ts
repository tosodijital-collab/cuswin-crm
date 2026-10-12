import { describe, expect, it } from "vitest";
import { recordCallAction } from "@/lib/actions";
import { getRepository } from "@/lib/data";
import { addDays, toDateStr } from "@/lib/domain/time";

function form(values: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(values)) fd.set(k, v);
  return fd;
}

describe("Randevu aldım (tek adım)", () => {
  it("arama sonucunu ve randevuyu birlikte kaydeder", async () => {
    const repo = getRepository();
    const home = await repo.getHome();
    const b = home.newTasks[0].business;
    const date = addDays(toDateStr(new Date()), 2);
    const res = await recordCallAction(
      { ok: false },
      form({
        businessId: b.id,
        result: "gorusuldu",
        stage: "randevu_alindi",
        note: "Salı 14:00 tanıtım",
        withAppointment: "1",
        apptDate: date,
        apptTime: "14:00",
        apptMeetingType: "yuz_yuze",
        apptContact: "Dr. Test",
      }),
    );
    expect(res.ok).toBe(true);
    const detail = await repo.getBusiness(b.id);
    expect(detail?.business.salesStage).toBe("randevu_alindi");
    expect(detail?.openTask).toBeUndefined();
    const appt = detail?.appointments[0];
    expect(appt?.contactName).toBe("Dr. Test");
    expect(appt?.status).toBe("planlandi");
    expect(toDateStr(new Date(appt!.startsAt))).toBe(date);
    expect(appt?.reminderMinutes).toBe(30);
  });

  it("geçmiş saatli randevuyu reddeder ve hiçbir şey kaydetmez", async () => {
    const repo = getRepository();
    const b = (await repo.getHome()).newTasks[0].business;
    const before = (await repo.getBusiness(b.id))!.activities.length;
    const res = await recordCallAction(
      { ok: false },
      form({ businessId: b.id, result: "gorusuldu", stage: "randevu_alindi", withAppointment: "1", apptDate: "2020-01-01", apptTime: "10:00", apptMeetingType: "telefon" }),
    );
    expect(res.ok).toBe(false);
    expect((await repo.getBusiness(b.id))!.activities.length).toBe(before);
  });
});

describe("ara verme", () => {
  it("yarın için ara verince bugün etkilenmez, yarın etkilenir; devam et kaldırır", async () => {
    const { setPauseAction } = await import("@/lib/actions");
    const { isPausedOn } = await import("@/lib/domain/rules");
    const repo = getRepository();
    const today = toDateStr(new Date());
    const res = await setPauseAction({ ok: false }, form({ kind: "yarin" }));
    expect(res.ok).toBe(true);
    let s = await repo.getSettings();
    expect(isPausedOn(s.pause, today)).toBe(false);
    expect(isPausedOn(s.pause, addDays(today, 1))).toBe(true);
    expect(isPausedOn(s.pause, addDays(today, 2))).toBe(false);
    await setPauseAction({ ok: false }, form({ kind: "devam" }));
    s = await repo.getSettings();
    expect(s.pause).toBeUndefined();
  });

  it("tarih aralığı ve süresiz", async () => {
    const { setPauseAction } = await import("@/lib/actions");
    const { isPausedOn } = await import("@/lib/domain/rules");
    const repo = getRepository();
    const today = toDateStr(new Date());
    const bad = await setPauseAction({ ok: false }, form({ kind: "aralik", from: addDays(today, 3), until: addDays(today, 1) }));
    expect(bad.ok).toBe(false);
    await setPauseAction({ ok: false }, form({ kind: "aralik", from: addDays(today, 1), until: addDays(today, 3) }));
    let s = await repo.getSettings();
    expect(isPausedOn(s.pause, addDays(today, 2))).toBe(true);
    expect(isPausedOn(s.pause, addDays(today, 4))).toBe(false);
    await setPauseAction({ ok: false }, form({ kind: "suresiz" }));
    s = await repo.getSettings();
    expect(isPausedOn(s.pause, addDays(today, 365))).toBe(true);
    await setPauseAction({ ok: false }, form({ kind: "devam" }));
  });
});
