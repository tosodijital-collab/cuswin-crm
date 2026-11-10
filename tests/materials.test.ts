import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MATERIALS } from "@/lib/domain/materials";

describe("gönderilecek dosyalar", () => {
  it("her PDF yayın klasöründe var ve boş değil", () => {
    for (const m of MATERIALS) {
      const file = join(process.cwd(), "public", m.path);
      expect(existsSync(file), m.path).toBe(true);
      expect(statSync(file).size).toBeGreaterThan(10_000);
    }
  });

  it("mesajlarda iç kullanım ya da yanlış süre yok", () => {
    for (const m of MATERIALS) {
      expect(m.message).not.toMatch(/11 sn|11 saniye|test/i);
      expect(m.message.length).toBeLessThan(500);
    }
  });
});
