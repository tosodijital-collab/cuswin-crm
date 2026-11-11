// Arama sırasında kartta gösterilen konuşma. Metinler sales-playbook.ts'teki senaryodan gelir;
// burada yalnızca kime (sekreter/doktor), hangi klinik türüne ve hangi saha gününe göre seçilir.

import { CLINIC_TYPE_LINES, PHONE_OBJECTIONS, PHONE_SCENARIOS } from "./sales-playbook";
import type { Business, Category } from "./types";

export type ScriptWho = "sekreter" | "doktor";
export type CallScriptView = {
  opening: string;
  hook?: string;
  close: string;
  replies: { q: string; a: string; app?: string }[];
};

const TYPE_OF: Record<Category, string> = {
  estetik: "estetik",
  sac_ekim: "sac",
  sac_sagligi: "sac",
  dis: "dis",
};

/** Saha gününün adı ("Perşembe"); senaryodaki örnek gün bununla değiştirilir. */
export function weekdayName(date: string): string {
  return new Date(`${date}T12:00:00+03:00`).toLocaleDateString("tr-TR", {
    timeZone: "Europe/Istanbul",
    weekday: "long",
  });
}

export function callScriptFor(business: Pick<Business, "categories">, who: ScriptWho, fieldDate?: string): CallScriptView {
  const day = fieldDate ? weekdayName(fieldDate) : undefined;
  const say = (t: string) => (day ? t.replaceAll("Perşembe", day) : t);
  const type = CLINIC_TYPE_LINES.find((l) => business.categories.some((c) => TYPE_OF[c] === l.id));
  const scenario = PHONE_SCENARIOS.find((s) => s.id === who)!;
  const objections = PHONE_OBJECTIONS.map((o) => ({
    q: o.q,
    a: say(o.a),
    app: o.app,
  }));

  if (who === "doktor") {
    return {
      opening: say(scenario.opening.text),
      hook: type?.question,
      close: say(scenario.branches[0].lines[0].text),
      replies: objections,
    };
  }
  const branches = scenario.branches.map((b) => ({
    q: b.title,
    a: say(b.lines.map((l) => (l.who === "Sen" ? l.text : `${l.who}: ${l.text}`)).join(" ")),
    app: b.tip ? say(b.tip) : undefined,
  }));
  return {
    opening: say(scenario.opening.text),
    hook: "Akşam ve hafta sonu gelen mesajlara şu an kim bakıyor?",
    close: say("Doktor bey/hanıma 10 dakika yüz yüze göstermek istiyorum. Perşembe o bölgedeyim: 14:00 mü daha uygun, 16:00 mı?"),
    replies: [...branches, ...objections.filter((o) => !branches.some((b) => b.q.includes(o.q)))],
  };
}
