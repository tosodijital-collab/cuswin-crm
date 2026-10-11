import type { DateStr, TimeStr } from "./types";

export const TZ = "Europe/Istanbul";

const dateFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const timeFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: TZ,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** Verilen anın Türkiye saatine göre takvim günü. */
export function toDateStr(d: Date): DateStr {
  return dateFmt.format(d);
}

export function toTimeStr(d: Date): TimeStr {
  return timeFmt.format(d);
}

export function addDays(date: DateStr, days: number): DateStr {
  const [y, m, d] = date.split("-").map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d + days));
  return utc.toISOString().slice(0, 10);
}

/** Türkiye'de UTC+3 sabittir (2016'dan beri yaz saati yok); yine de dönüşüm tek yerde. */
export function istanbulToUtc(date: DateStr, time: TimeStr): Date {
  return new Date(`${date}T${time}:00+03:00`);
}

const longDate = new Intl.DateTimeFormat("tr-TR", {
  timeZone: TZ,
  day: "numeric",
  month: "long",
  weekday: "long",
});

const shortDate = new Intl.DateTimeFormat("tr-TR", {
  timeZone: TZ,
  day: "numeric",
  month: "short",
});

const dateTime = new Intl.DateTimeFormat("tr-TR", {
  timeZone: TZ,
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatLongDate(date: DateStr): string {
  return longDate.format(istanbulToUtc(date, "12:00"));
}

export function formatShortDate(date: DateStr): string {
  return shortDate.format(istanbulToUtc(date, "12:00"));
}

export function formatDateTime(iso: string): string {
  return dateTime.format(new Date(iso));
}

export function formatTime(iso: string): string {
  return toTimeStr(new Date(iso));
}

/** "Bugün", "Dün", "Yarın" ya da kısa tarih. */
export function relativeDay(date: DateStr, today: DateStr): string {
  if (date === today) return "Bugün";
  if (date === addDays(today, -1)) return "Dün";
  if (date === addDays(today, 1)) return "Yarın";
  return formatShortDate(date);
}
