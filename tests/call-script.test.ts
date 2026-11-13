import { describe, expect, it } from "vitest";
import { callScriptFor, pitchDate, weekdayName } from "@/lib/domain/call-script";
import { PHONE_OBJECTIONS, PHONE_SCENARIOS } from "@/lib/domain/sales-playbook";

describe("arama sırasında konuşma", () => {
  it("saha gününün adını kullanır, {gün} kalmaz", () => {
    expect(weekdayName("2026-11-13")).toBe("Cuma");
    const s = callScriptFor({ categories: ["estetik"] }, "sekreter", "2026-11-12", "2026-11-13");
    expect(s.close).toContain("Cuma");
    expect(s.confirm).toContain("Cuma");
    expect([s.close, s.confirm, ...s.replies.map((r) => r.a + (r.app ?? ""))].join(" ")).not.toContain("{gün}");
  });

  it("saha günü yoksa ya da geçtiyse sonraki iş gününü ister (hafta sonu atlanır)", () => {
    expect(pitchDate("2026-11-12")).toBe("2026-11-13");
    expect(pitchDate("2026-11-13")).toBe("2026-11-16");
    expect(pitchDate("2026-11-16", "2026-11-12")).toBe("2026-11-17");
    expect(callScriptFor({ categories: ["estetik"] }, "sekreter", "2026-11-13").close).toContain("Pazartesi");
  });

  it("sekreterde 3 soru, önce sekreter durumları sonra itirazlar", () => {
    const s = callScriptFor({ categories: ["estetik"] }, "sekreter", "2026-11-12");
    expect(s.questions).toHaveLength(3);
    expect(s.questions.every((q) => q.text.endsWith("?") && q.listen.length > 0)).toBe(true);
    expect(s.replies[0].q).toContain("Konu nedir");
    expect(s.replies.some((r) => r.q === "İlgilenmiyoruz.")).toBe(true);
  });

  it("doktorda klinik türüne göre soru sorar ve iki saat seçeneği verir", () => {
    const q = (c: "sac_ekim" | "dis" | "estetik") => callScriptFor({ categories: [c] }, "doktor", "2026-11-12").questions.map((x) => x.text).join(" ");
    expect(q("sac_ekim")).toContain("greft");
    expect(q("dis")).toContain("cevapsız");
    expect(q("estetik")).toContain("dolgu");
    expect(callScriptFor({ categories: ["estetik"] }, "doktor", "2026-11-12").close).toMatch(/14:00.*16:00/);
  });

  it("uygulama ipuçları gerçek düğme adlarını kullanır", () => {
    const tips = [...PHONE_OBJECTIONS.map((o) => o.app ?? ""), ...PHONE_SCENARIOS.flatMap((s) => s.branches.map((b) => b.tip ?? ""))].join(" ");
    expect(tips).not.toMatch(/Konuştum, sonra ara|Tanıtımı gönder|Diğer sonuç/);
  });
});

describe("bilgi istedi: takip günü", () => {
  it("2 gün sonrası hafta sonuna düşerse pazartesi", () => {
    // send-whatsapp.tsx: pitchDate(addDays(today, 1))
    expect(pitchDate("2026-11-14")).toBe("2026-11-16"); // cuma + 1 = cumartesi → pazartesi
    expect(pitchDate("2026-11-11")).toBe("2026-11-12"); // salı + 1 = çarşamba → perşembe
  });
});
