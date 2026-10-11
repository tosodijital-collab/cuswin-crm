// Alan modeli. Frontend demo deposu ve ileride PostgreSQL deposu aynı tipleri kullanır.

export const CATEGORIES = ["estetik", "dis", "sac_sagligi", "sac_ekim"] as const;
export type Category = (typeof CATEGORIES)[number];

export const CALL_STATUSES = [
  "aranacak",
  "ulasilamadi",
  "tekrar_aranacak",
  "gorusuldu",
  "ilgilenmiyor",
  "beklemede",
  "iletisim_kurma",
] as const;
export type CallStatus = (typeof CALL_STATUSES)[number];

export const SALES_STAGES = [
  "yeni_aday",
  "iletisim_kuruldu",
  "randevu_alindi",
  "gorusme_yapildi",
  "teklif_gonderildi",
  "musteri_oldu",
  "olumsuz",
] as const;
export type SalesStage = (typeof SALES_STAGES)[number];

export const SOURCES = ["google_maps", "overture", "manuel", "demo"] as const;
export type Source = (typeof SOURCES)[number];

export const MEETING_TYPES = ["telefon", "cevrimici", "yuz_yuze"] as const;
export type MeetingType = (typeof MEETING_TYPES)[number];

export const APPOINTMENT_STATUSES = ["planlandi", "yapildi", "iptal"] as const;
export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];

/** Takvim günü, Europe/Istanbul: "YYYY-MM-DD". */
export type DateStr = string;
/** Saat, Europe/Istanbul: "HH:mm". */
export type TimeStr = string;

export type Contact = {
  id: string;
  name: string;
  role?: string;
};

export type Business = {
  id: string;
  name: string;
  categories: Category[];
  phone?: string;
  email?: string;
  website?: string;
  district?: string;
  address?: string;
  /** Kaynaktan gelen doğrudan Maps linki; yoksa ad + adresle arama linki üretilir. */
  mapsUrl?: string;
  source: Source;
  sourceId?: string;
  foundAt: string;
  verifiedAt?: string;
  contacts: Contact[];

  callStatus: CallStatus;
  salesStage: SalesStage;
  /** Ardışık başarısız arama sayısı; başarılı iletişimde sıfırlanır. */
  failedStreak: number;
  /** Doluysa kayıt "Eksik bilgi / Kontrol gerekli" sayılır ve günlük hedefe girmez. */
  reviewReason?: string;
  nextActionDate?: DateStr;
  nextActionTime?: TimeStr;
};

export type TaskKind = "yeni" | "takip";
/** Takip görevinin neden açıldığı; ana ekrandaki gruplamayı belirler. */
export type TaskReason = "gunluk_liste" | "ulasilamadi" | "planlandi";
export type TaskStatus = "acik" | "tamamlandi" | "iptal";

export type CallTask = {
  id: string;
  businessId: string;
  kind: TaskKind;
  reason: TaskReason;
  dueDate: DateStr;
  dueTime?: TimeStr;
  status: TaskStatus;
  createdAt: string;
  closedAt?: string;
};

export type ActivityType = "arama" | "asama" | "not" | "randevu" | "duzeltme" | "sistem";

export type Activity = {
  id: string;
  businessId: string;
  at: string;
  type: ActivityType;
  callResult?: CallStatus;
  stage?: SalesStage;
  note?: string;
  /** Hatalı girilmiş kayıt: silinmez, üstü çizili gösterilir ve hesaplamalara katılmaz. */
  voidedAt?: string;
};

export type Appointment = {
  id: string;
  businessId: string;
  /** ISO zaman damgası (UTC). */
  startsAt: string;
  contactName?: string;
  meetingType: MeetingType;
  location?: string;
  note?: string;
  status: AppointmentStatus;
  reminderMinutes: number;
  outcome?: string;
  calendar?: CalendarSync;
};

export type CalendarSync = {
  status: "eklendi" | "kaldirildi" | "hata" | "kapali";
  at: string;
  error?: string;
};

/** Google Maps taramasından gelen, işletmeye dönüştürülmüş kayıt. */
export type PlaceInput = {
  name: string;
  categories: Category[];
  phone?: string;
  email?: string;
  website?: string;
  district?: string;
  address?: string;
  mapsUrl?: string;
  source: Source;
  sourceId: string;
};

/** skipped: içe alınamayan; overLimit: tarama limiti dolduğu için sonraki taramaya bırakılan. */
export type ImportResult = { added: number; updated: number; flagged: number; skipped: number; overLimit: number };

export type ScanRun = {
  id: string;
  startedAt: string;
  finishedAt?: string;
  status: "calisiyor" | "tamam" | "hata";
  limit: number;
  queries: string[];
  found: number;
  added: number;
  updated: number;
  flagged: number;
  skipped: number;
  overLimit: number;
  /** Bilgi notu (ör. hedefin altında kalındıysa nedeni). */
  note?: string;
  error?: string;
};

export type DailyRun = {
  date: DateStr;
  startedAt: string;
  finishedAt?: string;
  target: number;
  selected: number;
  shortfallReason?: string;
  error?: string;
  trigger: "zamanlanmis" | "manuel" | "telafi";
};

export type Settings = {
  dailyTarget: number;
  categories: Category[];
  /** Boş dizi: Ankara geneli. */
  districts: string[];
  reminderMinutes: number;
  /** Bir taramada eklenecek en fazla yeni işletme. */
  scanLimit: number;
  /** ntfy sunucusu ve konu ayarlı mı (sunucu tarafı ortam değişkenleri). */
  notificationsConfigured: boolean;
  calendarConfigured: boolean;
  scannerConfigured: boolean;
};
