import type { CallOutcomeInput } from "@/lib/domain/rules";
import type {
  Activity,
  Appointment,
  Business,
  CalendarSync,
  CallStatus,
  CallTask,
  Category,
  DailyRun,
  DateStr,
  ImportResult,
  MeetingType,
  PlaceInput,
  SalesStage,
  ScanRun,
  Settings,
  Source,
} from "@/lib/domain/types";

export type TaskView = { task: CallTask; business: Business; lastCall?: Activity };
export type AppointmentView = { appointment: Appointment; business: Business };

export type HomeData = {
  today: DateStr;
  run?: DailyRun;
  newTasks: TaskView[];
  dundenKalanlar: TaskView[];
  gecikenler: TaskView[];
  planlananlar: TaskView[];
  appointmentsToday: AppointmentView[];
  counts: {
    newRemaining: number;
    newTotal: number;
    callsToday: number;
    openFollowUps: number;
    appointmentsToday: number;
    customers: number;
  };
};

export type BusinessDetail = {
  business: Business;
  openTask?: CallTask;
  activities: Activity[];
  appointments: Appointment[];
};

export type BusinessFilters = {
  q?: string;
  category?: Category;
  district?: string;
  callStatus?: CallStatus;
  salesStage?: SalesStage;
  source?: Source;
  needsReview?: boolean;
};

export type BusinessInput = {
  name: string;
  categories: Category[];
  phone?: string;
  email?: string;
  website?: string;
  district?: string;
  address?: string;
  contacts: { name: string; role?: string }[];
};

export type AppointmentInput = {
  startsAt: string;
  contactName?: string;
  meetingType: MeetingType;
  location?: string;
  note?: string;
  reminderMinutes: number;
};

export type Integrations = {
  scanner: boolean;
  calendar: boolean;
  notifications: boolean;
  /** Zamanlanmış işin son çalıştığı an (ISO). */
  lastHeartbeat?: string;
};

/** created: yeni liste açıldı; added: bu çalışmada listeye eklenen işletme (eksik gün tamamlanınca da > 0). */
export type DailyRunResult = { run: DailyRun; created: boolean; added: number };

export type EditableSettings = Omit<Settings, "notificationsConfigured" | "calendarConfigured" | "scannerConfigured">;

export interface CrmRepository {
  /** "demo": uydurma kayıtlar, kalıcı değil. "yerel": gerçek kayıtlar, yerel dosyada. */
  readonly mode: "demo" | "yerel";

  getHome(): Promise<HomeData>;
  getBusiness(id: string): Promise<BusinessDetail | undefined>;
  listBusinesses(filters: BusinessFilters): Promise<Business[]>;
  listDistricts(): Promise<string[]>;

  recordCall(businessId: string, input: CallOutcomeInput): Promise<void>;
  setSalesStage(businessId: string, stage: SalesStage, note?: string): Promise<void>;
  addNote(businessId: string, note: string): Promise<void>;
  voidActivity(businessId: string, activityId: string): Promise<void>;

  createBusiness(input: BusinessInput): Promise<string>;
  updateBusiness(id: string, input: BusinessInput): Promise<void>;

  listAppointments(): Promise<AppointmentView[]>;
  getAppointment(id: string): Promise<AppointmentView | undefined>;
  createAppointment(businessId: string, input: AppointmentInput): Promise<string>;
  setCalendarSync(id: string, sync: CalendarSync): Promise<void>;
  updateAppointment(id: string, input: AppointmentInput): Promise<void>;
  cancelAppointment(id: string): Promise<void>;
  completeAppointment(id: string, outcome: string): Promise<void>;

  getSettings(): Promise<Settings>;
  updateSettings(input: EditableSettings): Promise<void>;
  listRuns(limit: number): Promise<DailyRun[]>;
  runDailyList(trigger: DailyRun["trigger"]): Promise<DailyRunResult>;

  /** Arayüzden tarama isteği bırakır; zamanlanmış iş birkaç dakika içinde çalıştırır. */
  requestScan(): Promise<{ queued: boolean; message: string }>;
  /** Randevunun takvim eşitlemesini yeniden kuyruğa alır. */
  queueCalendarSync(appointmentId: string): Promise<void>;

  importPlaces(places: PlaceInput[], maxNew: number): Promise<ImportResult>;
  saveScan(scan: ScanRun): Promise<void>;
  listScans(limit: number): Promise<ScanRun[]>;
  getScanCursor(): Promise<number>;
  setScanCursor(cursor: number): Promise<void>;
}
