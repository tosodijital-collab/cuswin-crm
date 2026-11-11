import { describe, expect, it } from "vitest";
import { callScriptFor, weekdayName } from "@/lib/domain/call-script";

describe("arama sırasında konuşma", () => {
  it("saha gününün adını kullanır", () => {
    expect(weekdayName("2026-11-13")).toBe("Cuma");
    const s = callScriptFor({ categories: ["estetik"] }, "sekreter", "2026-11-13");
    expect(s.close).toContain("Cuma");
    expect(s.close).not.toContain("Perşembe");
    expect(s.replies.every((r) => !r.a.includes("Perşembe"))).toBe(true);
  });

  it("sekreterde önce sekreter cevapları, sonra itirazlar gelir", () => {
    const s = callScriptFor({ categories: ["estetik"] }, "sekreter");
    expect(s.replies[0].q).toContain("Konu nedir");
    expect(s.replies.some((r) => r.q === "İlgilenmiyoruz.")).toBe(true);
    expect(s.close).toContain("Perşembe");
  });

  it("doktorda klinik türüne göre soru sorar", () => {
    expect(callScriptFor({ categories: ["sac_ekim"] }, "doktor").hook).toContain("Operasyondan sonra");
    expect(callScriptFor({ categories: ["dis"] }, "doktor").hook).toContain("cevapsız");
    expect(callScriptFor({ categories: ["estetik"] }, "doktor").close).toContain("14:00");
  });
});
