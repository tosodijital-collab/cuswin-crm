import type {
  AppointmentStatus,
  CallStatus,
  Category,
  MeetingType,
  SalesStage,
  Source,
} from "./types";

export const CATEGORY_LABELS: Record<Category, string> = {
  estetik: "Estetik",
  dis: "Diş",
  sac_sagligi: "Saç sağlığı",
  sac_ekim: "Saç ekimi",
};

export const CALL_STATUS_LABELS: Record<CallStatus, string> = {
  aranacak: "Aranacak",
  ulasilamadi: "Ulaşılamadı",
  tekrar_aranacak: "Tekrar aranacak",
  gorusuldu: "Görüşüldü",
  ilgilenmiyor: "İlgilenmiyor",
  beklemede: "Beklemeye alındı",
  iletisim_kurma: "Tekrar iletişim kurma",
};

export const SALES_STAGE_LABELS: Record<SalesStage, string> = {
  yeni_aday: "Yeni aday",
  iletisim_kuruldu: "İletişim kuruldu",
  randevu_alindi: "Randevu alındı",
  gorusme_yapildi: "Görüşme yapıldı",
  teklif_gonderildi: "Teklif gönderildi",
  musteri_oldu: "Müşteri oldu",
  olumsuz: "Olumsuz sonuçlandı",
};

export const SOURCE_LABELS: Record<Source, string> = {
  google_maps: "Google Maps",
  overture: "Overture Maps",
  manuel: "Manuel",
  demo: "Demo",
};

export const MEETING_TYPE_LABELS: Record<MeetingType, string> = {
  telefon: "Telefon",
  cevrimici: "Çevrim içi",
  yuz_yuze: "Yüz yüze",
};

export const APPOINTMENT_STATUS_LABELS: Record<AppointmentStatus, string> = {
  planlandi: "Planlandı",
  yapildi: "Yapıldı",
  iptal: "İptal edildi",
};

export const ANKARA_DISTRICTS = [
  "Akyurt",
  "Altındağ",
  "Ayaş",
  "Bala",
  "Beypazarı",
  "Çamlıdere",
  "Çankaya",
  "Çubuk",
  "Elmadağ",
  "Etimesgut",
  "Evren",
  "Gölbaşı",
  "Güdül",
  "Haymana",
  "Kahramankazan",
  "Kalecik",
  "Keçiören",
  "Kızılcahamam",
  "Mamak",
  "Nallıhan",
  "Polatlı",
  "Pursaklar",
  "Sincan",
  "Şereflikoçhisar",
  "Yenimahalle",
] as const;
