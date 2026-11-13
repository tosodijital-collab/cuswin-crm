import { describe, expect, it } from "vitest";
import { daysBetween, doneToday, messagesDue, orderToday, sentNote, taskLabel, weekDays } from "@/lib/domain/day-plan";
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

describe("teyit yazısı", () => {
  it("teyit mesajında tarih açık yazılır", () => {
    expect(formatLongDateTime("2026-11-17T11:00:00Z")).toBe("17 Kasım Salı, saat 14:00");
  });
});

describe("haftayı planla", () => {
  it("pazarı atlar", async () => {
    const { planningDays } = await import("@/lib/domain/day-plan");
    // 13 Kasım 2026 cuma → gelecek cumartesi 21 Kasım; pazar (15) atlanır
    expect(planningDays("2026-11-13")).toEqual([
      "2026-11-13", "2026-11-14", "2026-11-16", "2026-11-17", "2026-11-18", "2026-11-19", "2026-11-20", "2026-11-21",
    ]);
    // pazartesi → aynı haftanın cumartesisi
    expect(planningDays("2026-11-16").at(-1)).toBe("2026-11-21");
  });
});

describe("dosya gönderildi, dönüş yok", () => {
  const today = "2026-11-13";
  const sent = (id: string, at: string) => act(id, at, { callResult: "tekrar_aranacak", note: "Tanıtım dosyası WhatsApp'tan gönderildi (0532 000 00 00)." });

  it("gönderimden sonra yalnızca 'açmadı' varsa dönüş bekleniyor sayılır", async () => {
    const { awaitingFile } = await import("@/lib/domain/day-plan");
    const w = awaitingFile([
      sent("a", "2026-11-11T09:00:00Z"),
      act("a", "2026-11-12T09:00:00Z", { callResult: "ulasilamadi" }),
      sent("b", "2026-11-11T09:00:00Z"),
      act("b", "2026-11-12T09:00:00Z", { callResult: "gorusuldu" }),
      act("c", "2026-11-11T09:00:00Z", { callResult: "tekrar_aranacak", note: "Doktor yoktu" }),
    ]);
    expect([...w.keys()]).toEqual(["a"]);
  });

  it("2. gün hatırlatma, 7. gün son mesaj; gönderildiyse çıkmaz", async () => {
    const { messagesDue, sentNote } = await import("@/lib/domain/day-plan");
    const businesses = new Map(["d2", "d7", "gitti"].map((id) => [id, biz(id, { callStatus: "tekrar_aranacak", salesStage: "iletisim_kuruldu" })]));
    const history = [sent("d2", "2026-11-11T09:00:00Z"), sent("d7", "2026-11-06T09:00:00Z"), sent("gitti", "2026-11-11T09:00:00Z")];
    const sentNotes = [act("gitti", "2026-11-13T07:00:00Z", { type: "not", note: sentNote("dosya2") })];
    const due = messagesDue({ businesses, history, sentNotes, appointments: [], today });
    expect(due.map((m) => `${m.kind}:${m.business.id}`).sort()).toEqual(["dosya2:d2", "dosya7:d7"]);
    expect(due.find((m) => m.kind === "dosya7")?.text).toContain("0850 510 09 46");
  });

  it("arama açılışı dosyaya göre değişir", async () => {
    const { callScriptFor } = await import("@/lib/domain/call-script");
    expect(callScriptFor({ categories: ["estetik"] }, "sekreter", today, undefined, { afterFile: true }).opening).toContain("tanıtım dosyamızı göndermiştim");
    expect(callScriptFor({ categories: ["estetik"] }, "sekreter", today).opening).not.toContain("göndermiştim");
  });
});

describe("planı yarından başlat", () => {
  it("yeni klinikleri günde hedef kadar dağıtır, pazarı atlar; geçmiş takipleri ilk güne alır, ileri tarihli takibe dokunmaz", async () => {
    const { repackFrom } = await import("@/lib/domain/day-plan");
    const t = (id: string, kind: "yeni" | "takip", dueDate: string) => ({ id, kind, dueDate, createdAt: `${dueDate}T05:00:00Z`, businessId: `b${id}` });
    const tasks = [
      t("1", "yeni", "2026-11-13"),
      t("2", "yeni", "2026-11-13"),
      t("3", "yeni", "2026-11-13"),
      t("4", "yeni", "2026-11-14"),
      t("5", "takip", "2026-11-12"),
      t("6", "takip", "2026-11-18"),
    ];
    // 14 Kasım cumartesi; hedef 2 → ct: 1,2 · (pazar atlanır) pt: 3,4
    const r = repackFrom(tasks, "2026-11-14", 2);
    expect(Object.fromEntries(r.moves.map((m) => [m.id, m.dueDate]))).toEqual({
      "5": "2026-11-14",
      "1": "2026-11-14",
      "2": "2026-11-14",
      "3": "2026-11-16",
      "4": "2026-11-16",
    });
    expect([...r.perDay]).toEqual([
      ["2026-11-14", 2],
      ["2026-11-16", 2],
    ]);
    expect(r.followUpBusinessIds).toEqual(["b5"]);
  });
});
