// Arama sırasında kartta gösterilen konuşma. Metinler sales-playbook.ts'teki senaryodan gelir;
// burada yalnızca kime (sekreter/doktor), hangi klinik türüne ve hangi güne göre seçilir.

import { CLINIC_TYPE_LINES, PHONE_OBJECTIONS, PHONE_SCENARIOS, withDay, type Question } from "./sales-playbook";
import { addDays } from "./time";
import type { Business, Category } from "./types";

export type ScriptWho = "sekreter" | "doktor";
export type CallScriptView = {
  opening: string;
  note: string;
  questions: Question[];
  bridge: string;
  close: string;
  confirm: string;
  replies: { q: string; a: string; app?: string }[];
};

const TYPE_OF: Record<Category, string> = {
  estetik: "estetik",
  sac_ekim: "sac",
  sac_sagligi: "sac",
  dis: "dis",
};

/** Günün adı ("Perşembe"). */
export function weekdayName(date: string): string {
  return new Date(`${date}T12:00:00+03:00`).toLocaleDateString("tr-TR", {
    timeZone: "Europe/Istanbul",
    weekday: "long",
  });
}

/** Randevu istenecek gün: saha günü bugün ya da ileride ise o gün, yoksa sonraki iş günü (hafta sonu atlanır). */
export function pitchDate(today: string, fieldDate?: string): string {
  if (fieldDate && fieldDate >= today) return fieldDate;
  let d = addDays(today, 1);
  while (["Cumartesi", "Pazar"].includes(weekdayName(d))) d = addDays(d, 1);
  return d;
}

export function callScriptFor(business: Pick<Business, "categories">, who: ScriptWho, today: string, fieldDate?: string): CallScriptView {
  const day = weekdayName(pitchDate(today, fieldDate));
  const say = (t: string) => withDay(t, day);
  const s = PHONE_SCENARIOS.find((x) => x.id === who)!;
  const objections = PHONE_OBJECTIONS.map((o) => ({ q: o.q, a: say(o.a), app: o.app }));
  const branches = s.branches.map((b) => ({
    q: b.title,
    a: say(b.lines.map((l) => (l.who === "Sen" ? l.text : `${l.who}: ${l.text}`)).join(" ")),
    app: b.tip ? say(b.tip) : undefined,
  }));

  let questions = s.questions;
  if (who === "doktor") {
    const type = CLINIC_TYPE_LINES.find((l) => business.categories.some((c) => TYPE_OF[c] === l.id)) ?? CLINIC_TYPE_LINES[0];
    questions = [questions[0], { text: type.question, listen: "Cevabı bekle. Sorunu anlatırsa: \"Ayda kaç hasta böyle gidiyordur sizce?\"" }, ...questions.slice(1)];
  }

  return {
    opening: s.opening,
    note: s.note,
    questions,
    bridge: s.bridge,
    close: say(s.close),
    confirm: say(s.confirm),
    replies: [...branches, ...objections],
  };
}
