import { describe, expect, it } from "vitest";
import { daysBetween, doneToday, messagesDue, orderToday, sentNote, taskLabel, weekDays } from "@/lib/domain/day-plan";
import { decodeOffer, encodeOffer, formatTl, offerNumber, type Offer } from "@/lib/domain/offer";
import { formatLongDateTime } from "@/lib/domain/time";
import type { Activity, Appointment, Business, CallTask } from "@/lib/domain/types";

const biz = (id: string, extra: Partial<Business> = {}): Business => ({
  id,
  name: id,
  categories: ["estetik"],
  source: "google_maps",
  foundAt: "2026-11-01T00:00:00Z",
  contacts: [],
  callStatus: "gorusuldu",
  salesStage: "gorusme_yapildi",
  failedStreak: 0,
  ...extra,
});
const act = (businessId: string, at: string, extra: Partial<Activity>): Activity => ({ id: `${businessId}-${at}`, businessId, at, type: "arama", ...extra });
const task = (kind: CallTask["kind"], reason: CallTask["reason"], dueDate: string, dueTime?: string) => ({ task: { kind, reason, dueDate, dueTime } });

describe("Bugün planı", () => {
  const today = "2026-11-13";

  it("haftayı bugünden başlatır, gün farkını sayar", () => {
    expect(weekDays(today)).toEqual(["2026-11-13", "2026-11-14", "2026-11-15", "2026-11-16", "2026-11-17", "2026-11-18", "2026-11-19"]);
    expect(daysBetween("2026-11-10", today)).toBe(3);
  });

  it("görevin neden listede olduğunu yazar", () => {
    expect(taskLabel({ kind: "yeni", reason: "gunluk_liste", dueDate: today }, today)).toEqual({ text: "Yeni klinik", late: false });
    expect(taskLabel({ kind: "takip", reason: "ulasilamadi", dueDate: today }, today).text).toBe("Dün açmadı, tekrar");
    expect(taskLabel({ kind: "takip", reason: "planlandi", dueDate: today, dueTime: "11:00" }, today).text).toBe("Takip · saat 11:00");
    expect(taskLabel({ kind: "yeni", reason: "gunluk_liste", dueDate: "2026-11-12" }, today)).toEqual({ text: "Dünden kaldı", late: true });
    expect(taskLabel({ kind: "yeni", reason: "gunluk_liste", dueDate: "2026-11-10" }, today).text).toBe("3 gündür bekliyor");
  });

  it("sıra: saatli takip, takip, dün açmayan, yeni", () => {
    const sorted = orderToday([
      task("yeni", "gunluk_liste", today),
      task("takip", "ulasilamadi", today),
      task("takip", "planlandi", today),
      task("takip", "planlandi", today, "15:00"),
      task("takip", "planlandi", today, "10:00"),
    ]);
    expect(sorted.map((t) => `${t.task.reason}${t.task.dueTime ?? ""}`)).toEqual([
      "planlandi10:00",
      "planlandi15:00",
      "planlandi",
      "ulasilamadi",
      "gunluk_liste",
    ]);
  });

  it("bugün yapılanlar: işletme başına son kayıt", () => {
    const b = new Map([["a", biz("a")]]);
    const done = doneToday(
      [
        act("a", "2026-11-13T08:00:00Z", { callResult: "ulasilamadi" }),
        act("a", "2026-11-13T09:00:00Z", { callResult: "gorusuldu" }),
        act("a", "2026-11-12T09:00:00Z", { callResult: "gorusuldu" }),
      ],
      b,
      today,
    );
    expect(done).toHaveLength(1);
    expect(done[0].activity.callResult).toBe("gorusuldu");
  });
});

describe("gönderilecek mesajlar", () => {
  const today = "2026-11-13";
  const businesses = new Map(["v3", "v14", "sonra", "gonderildi", "ilgisiz", "r"].map((id) => [id, biz(id, id === "ilgisiz" ? { callStatus: "ilgilenmiyor" } : {})]));
  const history = [
    act("v3", "2026-11-10T09:00:00Z", { type: "ziyaret", visitResult: "demo_yapildi" }),
    act("v14", "2026-10-29T09:00:00Z", { type: "ziyaret", visitResult: "doktorla_gorusuldu" }),
    act("sonra", "2026-11-09T09:00:00Z", { type: "ziyaret", visitResult: "demo_yapildi" }),
    act("sonra", "2026-11-11T09:00:00Z", { callResult: "gorusuldu" }),
    act("gonderildi", "2026-11-09T09:00:00Z", { type: "ziyaret", visitResult: "demo_yapildi" }),
    act("ilgisiz", "2026-11-09T09:00:00Z", { type: "ziyaret", visitResult: "demo_yapildi" }),
  ];
  const sentNotes = [act("gonderildi", "2026-11-12T09:00:00Z", { type: "not", note: sentNote("takip3") })];
  const appointments = [{ id: "x", businessId: "r", startsAt: "2026-11-14T11:00:00Z", status: "planlandi", meetingType: "yuz_yuze", reminderMinutes: 30 } as Appointment];

  it("3. gün ve 2. hafta takibini, yarınki teyidi çıkarır; gönderilmiş ve ilgisizi çıkarmaz", () => {
    const due = messagesDue({ businesses, history, sentNotes, appointments, today });
    expect(due.map((m) => `${m.kind}:${m.business.id}`).sort()).toEqual(["takip14:v14", "takip3:v3", "teyit:r"]);
    expect(due.find((m) => m.kind === "takip3")?.text).toBeTruthy();
  });

  it("teyit gönderildiyse tekrar çıkmaz", () => {
    const due = messagesDue({
      businesses,
      history: [],
      sentNotes: [act("r", "2026-11-13T07:00:00Z", { type: "not", note: sentNote("teyit") })],
      appointments,
      today,
    });
    expect(due).toHaveLength(0);
  });
});

describe("teklif ve teyit yazısı", () => {
  const o: Offer = { c: "Örnek Estetik Kliniği", y: "Dr. Ayşe", p: "Growth", t: "sesli", k: 15000, a: 9500, v: false, n: "• Akşam bakan yok", d: "2026-11-13", g: 14 };

  it("linke yazar ve geri okur (Türkçe karakterler dahil)", () => {
    const t = encodeOffer(o);
    expect(t).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decodeOffer(t)).toEqual(o);
  });

  it("bozuk ya da kurala uymayan linki reddeder", () => {
    expect(decodeOffer("bozuk!!")).toBeUndefined();
    expect(decodeOffer(null)).toBeUndefined();
    const bad = btoa(JSON.stringify({ ...o, c: "Klinik", y: undefined, n: undefined, a: -5 })).replace(/=+$/, "");
    expect(decodeOffer(bad)).toBeUndefined();
  });

  it("tutar ve teklif no biçimi", () => {
    expect(formatTl(15000)).toBe("15.000 ₺");
    expect(offerNumber(o)).toMatch(/^CW-20261113-[0-9A-F]{4}$/);
  });

  it("teyit mesajında tarih açık yazılır", () => {
    expect(formatLongDateTime("2026-11-17T11:00:00Z")).toBe("17 Kasım Salı, saat 14:00");
  });
});

describe("haftayı planla", () => {
  it("pazarı atlar", async () => {
    const { planningDays } = await import("@/lib/domain/day-plan");
    // 13 Kasım 2026 cuma: cu, ct, (pz atlanır), pt, sa, ça, pe
    expect(planningDays("2026-11-13")).toEqual(["2026-11-13", "2026-11-14", "2026-11-16", "2026-11-17", "2026-11-18", "2026-11-19"]);
  });
});
