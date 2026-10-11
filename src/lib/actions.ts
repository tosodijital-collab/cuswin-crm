"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getRepository } from "@/lib/data";
import { RuleError } from "@/lib/domain/rules";
import { istanbulToUtc } from "@/lib/domain/time";
import { syncAppointmentToCalendar } from "@/lib/integrations/google-calendar";
import { startScan } from "@/lib/scan";
import {
  CALL_STATUSES,
  CATEGORIES,
  MEETING_TYPES,
  SALES_STAGES,
} from "@/lib/domain/types";

export type ActionState = { ok: boolean; message?: string };

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => v || undefined);
const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Geçersiz tarih.");
const timeStr = z.string().regex(/^\d{2}:\d{2}$/, "Geçersiz saat.");
const optionalDate = z.union([dateStr, z.literal("")]).optional().transform((v) => v || undefined);
const optionalTime = z.union([timeStr, z.literal("")]).optional().transform((v) => v || undefined);
const id = z.string().min(1).max(64);

/** Giriş ve yetki kontrolü backend aşamasında buraya eklenecek; her action bu fonksiyondan geçer. */
async function guard() {}

function fields(formData: FormData) {
  return Object.fromEntries([...formData.keys()].map((k) => [k, formData.get(k) ?? undefined]));
}

async function run(fn: () => Promise<string | void>): Promise<ActionState> {
  await guard();
  try {
    const message = await fn();
    refresh();
    return { ok: true, message: message || undefined };
  } catch (e) {
    if (e instanceof z.ZodError) return { ok: false, message: e.issues[0]?.message ?? "Geçersiz giriş." };
    if (e instanceof RuleError) return { ok: false, message: e.message };
    throw e;
  }
}

const callSchema = z.object({
  businessId: id,
  result: z.enum(CALL_STATUSES, "Sonuç seçin."),
  note: optionalText(2000),
  stage: z.union([z.enum(SALES_STAGES), z.literal("")]).optional().transform((v) => v || undefined),
  nextDate: optionalDate,
  nextTime: optionalTime,
});

export async function recordCallAction(_: ActionState, formData: FormData): Promise<ActionState> {
  return run(async () => {
    const { businessId, ...input } = callSchema.parse(fields(formData));
    await getRepository().recordCall(businessId, input);
    return "Kaydedildi.";
  });
}

export async function setStageAction(_: ActionState, formData: FormData): Promise<ActionState> {
  return run(async () => {
    const { businessId, stage, note } = z
      .object({ businessId: id, stage: z.enum(SALES_STAGES), note: optionalText(2000) })
      .parse(fields(formData));
    await getRepository().setSalesStage(businessId, stage, note);
    return "Satış aşaması güncellendi.";
  });
}

export async function addNoteAction(_: ActionState, formData: FormData): Promise<ActionState> {
  return run(async () => {
    const { businessId, note } = z
      .object({ businessId: id, note: z.string().trim().min(1, "Not boş olamaz.").max(2000) })
      .parse(fields(formData));
    await getRepository().addNote(businessId, note);
    return "Not eklendi.";
  });
}

export async function voidActivityAction(_: ActionState, formData: FormData): Promise<ActionState> {
  return run(async () => {
    const { businessId, activityId } = z.object({ businessId: id, activityId: id }).parse(fields(formData));
    await getRepository().voidActivity(businessId, activityId);
    return "Kayıt hatalı olarak işaretlendi.";
  });
}

const businessSchema = z.object({
  name: z.string().trim().min(2, "İşletme adı en az 2 karakter olmalı.").max(200),
  categories: z.array(z.enum(CATEGORIES)).max(CATEGORIES.length),
  phone: optionalText(40),
  email: z.union([z.email("Geçersiz e-posta."), z.literal("")]).optional().transform((v) => v || undefined),
  website: optionalText(300),
  district: optionalText(60),
  address: optionalText(400),
  contacts: z
    .array(z.object({ name: z.string().trim().min(1).max(120), role: optionalText(80) }))
    .max(20),
});

export async function saveBusinessAction(_: ActionState, formData: FormData): Promise<ActionState> {
  await guard();
  let target: string;
  try {
    const existingId = formData.get("id");
    const names = formData.getAll("contactName").map(String);
    const roles = formData.getAll("contactRole").map(String);
    const input = businessSchema.parse({
      ...fields(formData),
      categories: formData.getAll("categories"),
      contacts: names
        .map((name, i) => ({ name, role: roles[i] }))
        .filter((c) => c.name.trim()),
    });
    const repo = getRepository();
    if (typeof existingId === "string" && existingId) {
      await repo.updateBusiness(existingId, input);
      target = existingId;
    } else {
      target = await repo.createBusiness(input);
    }
  } catch (e) {
    if (e instanceof z.ZodError) return { ok: false, message: e.issues[0]?.message ?? "Geçersiz giriş." };
    if (e instanceof RuleError) return { ok: false, message: e.message };
    throw e;
  }
  redirect(`/isletme/${target}`);
}

const appointmentSchema = z.object({
  date: dateStr,
  time: timeStr,
  contactName: optionalText(120),
  meetingType: z.enum(MEETING_TYPES, "Görüşme türü seçin."),
  location: optionalText(400),
  note: optionalText(1000),
  reminderMinutes: z.coerce.number().int().min(0).max(1440),
});

function appointmentInput(formData: FormData) {
  const { date, time, ...rest } = appointmentSchema.parse(fields(formData));
  return { ...rest, startsAt: istanbulToUtc(date, time).toISOString() };
}

/** Randevuyu Google Takvim ile eşitler ve sonucu kullanıcıya okunur metin olarak döner. */
async function syncCalendar(appointmentId: string): Promise<string> {
  const repo = getRepository();
  const view = await repo.getAppointment(appointmentId);
  if (!view) return "";
  const sync = await syncAppointmentToCalendar(view.appointment, view.business);
  await repo.setCalendarSync(appointmentId, sync);
  switch (sync.status) {
    case "eklendi":
      return " Google Takvim'e yazıldı.";
    case "kaldirildi":
      return " Google Takvim'den kaldırıldı.";
    case "hata":
      return ` Google Takvim'e yazılamadı: ${sync.error}`;
    case "kapali":
      return "";
  }
}

export async function createAppointmentAction(_: ActionState, formData: FormData): Promise<ActionState> {
  return run(async () => {
    const businessId = id.parse(formData.get("businessId"));
    const appointmentId = await getRepository().createAppointment(businessId, appointmentInput(formData));
    return "Randevu kaydedildi." + (await syncCalendar(appointmentId));
  });
}

export async function updateAppointmentAction(_: ActionState, formData: FormData): Promise<ActionState> {
  return run(async () => {
    const appointmentId = id.parse(formData.get("appointmentId"));
    await getRepository().updateAppointment(appointmentId, appointmentInput(formData));
    return "Randevu güncellendi. Hatırlatma yeni saate göre ayarlandı." + (await syncCalendar(appointmentId));
  });
}

export async function cancelAppointmentAction(_: ActionState, formData: FormData): Promise<ActionState> {
  return run(async () => {
    const appointmentId = id.parse(formData.get("appointmentId"));
    await getRepository().cancelAppointment(appointmentId);
    return "Randevu iptal edildi. Hatırlatma gönderilmeyecek." + (await syncCalendar(appointmentId));
  });
}

export async function retryCalendarAction(_: ActionState, formData: FormData): Promise<ActionState> {
  return run(async () => {
    const appointmentId = id.parse(formData.get("appointmentId"));
    return (await syncCalendar(appointmentId)).trim() || "Google Takvim bağlı değil.";
  });
}

export async function completeAppointmentAction(_: ActionState, formData: FormData): Promise<ActionState> {
  return run(async () => {
    const { appointmentId, outcome } = z
      .object({ appointmentId: id, outcome: z.string().trim().min(1, "Görüşme sonucunu yazın.").max(1000) })
      .parse(fields(formData));
    await getRepository().completeAppointment(appointmentId, outcome);
    return "Görüşme sonucu kaydedildi.";
  });
}

export async function saveSettingsAction(_: ActionState, formData: FormData): Promise<ActionState> {
  return run(async () => {
    const input = z
      .object({
        dailyTarget: z.coerce.number().int().min(1, "Hedef en az 1 olmalı.").max(100, "Hedef en fazla 100 olabilir."),
        categories: z.array(z.enum(CATEGORIES)).min(1, "En az bir kategori seçin."),
        districts: z.array(z.string().trim().min(1).max(60)).max(30),
        reminderMinutes: z.coerce.number().int().min(0).max(1440),
        scanLimit: z.coerce.number().int().min(1, "Tarama limiti en az 1 olmalı.").max(200, "Tarama limiti en fazla 200 olabilir."),
      })
      .parse({
        ...fields(formData),
        categories: formData.getAll("categories"),
        districts: formData.getAll("districts"),
      });
    await getRepository().updateSettings(input);
    return "Ayarlar kaydedildi.";
  });
}

export async function runDailyListAction(): Promise<ActionState> {
  return run(async () => {
    const { run: r, created, added } = await getRepository().runDailyList("manuel");
    if (!created && added > 0) return `Eksik liste tamamlandı: ${added} işletme eklendi, listede ${r.selected} işletme var.`;
    if (!created) return `Bugünün listesi zaten hazır (${r.selected} işletme). Yeni liste oluşturulmadı.`;
    return r.shortfallReason ?? `${r.selected} işletme bugünün listesine eklendi.`;
  });
}

export async function startScanAction(): Promise<ActionState> {
  await guard();
  const res = await startScan();
  refresh();
  return { ok: res.started, message: res.message };
}
