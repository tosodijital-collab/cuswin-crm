"use client";

// Saha ve Bugün ekranlarındaki klinik kartları. Her kartta en fazla üç düğme; gerisi "Sonuç" altında.
// Araştırmadaki satış akışı: ara → randevu al → git, demo yap → aynı gün tanıtım → tarih koy → tanıştırma iste.

import Link from "next/link";
import { useCallback, useState, type ReactNode } from "react";
import { formatPhone, mapsHref, telHref, whatsappChatHref, whatsappNumberOf } from "@/lib/domain/contact-info";
import type { AppointmentItem, ContactSummary } from "@/lib/domain/field-plan";
import { CALL_STATUS_LABELS, CATEGORY_LABELS, VISIT_RESULT_LABELS } from "@/lib/domain/labels";
import { confirmationText, FOLLOW_UPS } from "@/lib/domain/sales-playbook";
import { formatDateTime, formatTime, relativeDay, toDateStr } from "@/lib/domain/time";
import type { Business, VisitResult } from "@/lib/domain/types";
import { AppointmentQuickForm } from "./call-outcome-form";
import { CallResult } from "./call-result";
import { CallScript } from "./call-script";
import { SendWhatsapp } from "./send-whatsapp";
import { Badge, StageBadge } from "./ui";
import { VisitForm } from "./visit-form";

export const btn =
  "inline-flex min-h-12 items-center justify-center whitespace-nowrap rounded-md border border-line bg-surface px-3 text-[15px] font-medium hover:bg-paper";
const primaryBtn =
  "inline-flex min-h-12 items-center justify-center gap-2 whitespace-nowrap rounded-md px-4 text-[16px] font-semibold text-white";

function addressOf(b: Business): string | undefined {
  return [b.address, b.district].filter(Boolean).join(", ") || undefined;
}

function BusinessHeader({ business: b, children }: { business: Business; children?: ReactNode }) {
  return (
    <>
      <Link href={`/isletme?id=${b.id}`} className="block text-[17px] font-semibold leading-snug hover:underline">
        {b.name}
      </Link>
      <p className="mt-0.5 text-sm text-muted">
        {[b.categories.map((c) => CATEGORY_LABELS[c]).join(", "), b.address].filter(Boolean).join(" · ")}
      </p>
      {children}
    </>
  );
}

function Panelish({ children }: { children: ReactNode }) {
  return <div className="border-t border-dashed border-line bg-paper/60 px-4 py-4">{children}</div>;
}

/**
 * Ziyaretten hemen sonra: satış kiti "aynı gün tanıtım gönder, tarih koy, tanıştırma iste".
 * Tarih ve tanıştırma ziyaret formunda alındı; burada yalnızca gönderme kalır.
 */
function AfterVisit({
  business: b,
  result,
  today,
  onClose,
}: {
  business: Business;
  result: VisitResult;
  today: string;
  onClose: () => void;
}) {
  if (result === "ilgilenmiyor" || result === "kapali") return null;
  return (
    <Panelish>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold">Sıradaki adım: tanıtımı şimdi gönder</p>
          <p className="text-sm text-muted">Satış kuralı: görüşmeden sonra aynı gün. {VISIT_RESULT_LABELS[result]}.</p>
        </div>
        <button type="button" onClick={onClose} className="min-h-11 shrink-0 px-2 text-[15px] text-muted">
          Sonra
        </button>
      </div>
      <SendWhatsapp business={b} today={today} onDone={onClose} />
    </Panelish>
  );
}

/** Randevulu ziyaret: önce yol, sonra sonuç. */
export function AppointmentRow({
  item: { appointment: a, business: b },
  today,
  showDate,
}: {
  item: AppointmentItem;
  today: string;
  showDate?: boolean;
}) {
  const [open, setOpen] = useState<false | "sonuc" | "sonra">(false);
  const [saved, setSaved] = useState<VisitResult>();
  const close = useCallback(() => setOpen((v) => (v === "sonuc" ? false : v)), []);
  const done = a.status === "yapildi";
  const tel = telHref(b.phone);
  const confirm = whatsappChatHref(whatsappNumberOf(b), confirmationText(formatDateTime(a.startsAt)));

  return (
    <li className={`border-b border-line last:border-b-0 ${done ? "bg-paper/50" : ""}`}>
      <div className="flex gap-3 px-4 py-4">
        <div className="w-14 shrink-0">
          <p className={`text-xl font-semibold tabular-nums ${done ? "text-call" : "text-meet"}`}>{done ? "✓" : formatTime(a.startsAt)}</p>
          {done && <p className="text-xs tabular-nums text-muted">{formatTime(a.startsAt)}</p>}
        </div>
        <div className="min-w-0 flex-1">
          <BusinessHeader business={b}>
            {(showDate || a.contactName || b.salesStage !== "yeni_aday") && (
              <p className="mt-1.5 flex flex-wrap gap-1.5">
                {showDate && <Badge tone="meet">{formatDateTime(a.startsAt)}</Badge>}
                {a.contactName && <Badge>{a.contactName}</Badge>}
                {b.salesStage !== "yeni_aday" && <StageBadge stage={b.salesStage} />}
              </p>
            )}
            {done && a.outcome && <p className="mt-1 text-sm">{a.outcome}</p>}
          </BusinessHeader>
          {!done && (
            <div className="mt-3 grid grid-cols-2 gap-2">
              <a href={mapsHref(b)} target="_blank" rel="noopener noreferrer" className={`${primaryBtn} bg-ink hover:bg-ink/90`}>
                Yol tarifi
              </a>
              <button
                type="button"
                onClick={() => setOpen((v) => (v === "sonuc" ? false : "sonuc"))}
                aria-expanded={open === "sonuc"}
                className={`${btn} aria-expanded:bg-paper`}
              >
                Ziyaret sonucu
              </button>
              <div className="col-span-2 flex flex-wrap gap-x-4 gap-y-1 text-[15px]">
                {tel && (
                  <a href={tel} className="font-medium tabular-nums text-call">
                    Ara · {formatPhone(b.phone)}
                  </a>
                )}
                {confirm && (
                  <a href={confirm} target="_blank" rel="noopener noreferrer" className="font-medium text-meet">
                    Teyit mesajı
                  </a>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      {open === "sonuc" && (
        <Panelish>
          <VisitForm businessId={b.id} currentStage={b.salesStage} today={today} appointmentId={a.id} onDone={close} onSaved={setSaved} />
        </Panelish>
      )}
      {saved && <AfterVisit business={b} result={saved} today={today} onClose={() => setSaved(undefined)} />}
    </li>
  );
}

function lastCallLabel(contact: ContactSummary | undefined, today: string): string | undefined {
  const c = contact?.lastCall;
  if (!c?.callResult) return undefined;
  return `Son arama ${relativeDay(toDateStr(new Date(c.at)), today).toLocaleLowerCase("tr-TR")}: ${CALL_STATUS_LABELS[c.callResult].toLocaleLowerCase("tr-TR")}`;
}

type CallPanel = "arama" | "randevu" | "sonuc";

/**
 * Randevu almak için aranacak klinik. Üç düğme: Ara · Randevu aldım · Sonuç.
 * "Ara"ya basınca numara çevrilir ve kartta konuşma açılır; altında "Nasıl bitti?" seçenekleri.
 */
export function CallTargetRow({
  business: b,
  today,
  fieldDate,
  contact,
}: {
  business: Business;
  today: string;
  fieldDate?: string;
  contact?: ContactSummary;
}) {
  const [open, setOpen] = useState<false | CallPanel>(false);
  const [saved, setSaved] = useState<VisitResult>();
  const close = useCallback(() => setOpen(false), []);
  const toggle = (k: CallPanel) => setOpen((v) => (v === k ? false : k));
  const tel = telHref(b.phone);
  const last = lastCallLabel(contact, today);

  return (
    <li className="border-b border-line last:border-b-0">
      <div className="px-4 py-4">
        <BusinessHeader business={b}>
          {(last || b.failedStreak > 0) && (
            <p className={`mt-1 text-sm ${b.failedStreak > 0 ? "text-late" : "text-muted"}`}>
              {last}
              {b.failedStreak > 0 && ` (${b.failedStreak}/3 ulaşılamadı)`}
            </p>
          )}
        </BusinessHeader>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {tel ? (
            <a
              href={tel}
              onClick={() => setOpen("arama")}
              className={`${primaryBtn} col-span-2 min-h-14 bg-call text-[17px] tabular-nums hover:bg-call/90`}
            >
              <PhoneIcon />
              Ara · {formatPhone(b.phone)}
            </a>
          ) : (
            <p className="col-span-2 text-sm text-stop">Telefon yok. Kayıttan ekle ya da uğra.</p>
          )}
          <button
            type="button"
            onClick={() => toggle("randevu")}
            aria-expanded={open === "randevu"}
            className={`${btn} border-meet/40 text-meet aria-expanded:bg-meet-soft`}
          >
            Randevu aldım
          </button>
          <button
            type="button"
            onClick={() => toggle("sonuc")}
            aria-expanded={open === "sonuc"}
            className={`${btn} aria-expanded:bg-paper`}
          >
            Sonuç
          </button>
        </div>
      </div>

      {open === "randevu" && (
        <Panelish>
          <AppointmentQuickForm
            businessId={b.id}
            currentStage={b.salesStage}
            today={today}
            defaultDate={fieldDate}
            defaultLocation={addressOf(b)}
            onDone={close}
          />
        </Panelish>
      )}
      {open === "arama" && (
        <Panelish>
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-[17px] font-semibold">Ne diyeceğim</p>
            <button type="button" onClick={close} className="min-h-11 px-2 text-[15px] text-muted">
              Kapat
            </button>
          </div>
          <CallScript business={b} fieldDate={fieldDate} today={today} />
          <p className="mb-2 mt-5 text-[17px] font-semibold">Nasıl bitti?</p>
          <CallResult business={b} today={today} fieldDate={fieldDate} onDone={close} allowVisit onVisitSaved={setSaved} />
        </Panelish>
      )}
      {open === "sonuc" && (
        <Panelish>
          <p className="mb-2 text-[17px] font-semibold">Nasıl bitti?</p>
          <CallResult business={b} today={today} fieldDate={fieldDate} onDone={close} allowVisit onVisitSaved={setSaved} />
        </Panelish>
      )}
      {saved && <AfterVisit business={b} result={saved} today={today} onClose={() => setSaved(undefined)} />}
    </li>
  );
}

/** Ziyaret edilmiş klinik: takip mesajları ve yeniden randevu. */
export function VisitedRow({ business: b, today, contact }: { business: Business; today: string; contact?: ContactSummary }) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const v = contact?.lastVisit;
  const tel = telHref(b.phone);
  return (
    <li className="border-b border-line last:border-b-0">
      <div className="px-4 py-4">
        <BusinessHeader business={b}>
          {v && (
            <p className="mt-1 text-sm">
              <span className="text-muted">{relativeDay(toDateStr(new Date(v.at)), today)}: </span>
              {v.visitResult ? VISIT_RESULT_LABELS[v.visitResult] : "Ziyaret"}
              {v.note && <span className="text-muted">. {v.note}</span>}
            </p>
          )}
        </BusinessHeader>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {tel ? (
            <a href={tel} className={`${btn} tabular-nums`}>
              Ara
            </a>
          ) : (
            <span />
          )}
          <button type="button" onClick={() => setOpen((x) => !x)} aria-expanded={open} className={`${btn} border-meet/40 text-meet`}>
            Randevu aldım
          </button>
          {FOLLOW_UPS.map((f) => {
            const href = whatsappChatHref(whatsappNumberOf(b), f.text);
            return href ? (
              <a
                key={f.id}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                title={f.when}
                className={`${btn} border-call/40 text-call`}
              >
                {f.label}
              </a>
            ) : null;
          })}
        </div>
      </div>
      {open && (
        <Panelish>
          <AppointmentQuickForm businessId={b.id} currentStage={b.salesStage} today={today} defaultLocation={addressOf(b)} onDone={close} />
        </Panelish>
      )}
    </li>
  );
}

function PhoneIcon() {
  return (
    <svg
      aria-hidden
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z" />
    </svg>
  );
}

type DoorPanel = "ziyaret" | "arama" | "randevu" | "sonuc";

/** Haritada seçilen klinik: kapıdayken önce "Uğradım", yoldayken yol tarifi ve arama. */
export function MapStopCard({
  business: b,
  today,
  contact,
  badge,
  onClose,
}: {
  business: Business;
  today: string;
  contact?: ContactSummary;
  /** Durum ve uzaklık ("Gidilmedi · 120 m"). */
  badge?: ReactNode;
  onClose: () => void;
}) {
  const [open, setOpen] = useState<DoorPanel>();
  const [saved, setSaved] = useState<VisitResult>();
  const close = useCallback(() => setOpen(undefined), []);
  const toggle = (k: DoorPanel) => setOpen((v) => (v === k ? undefined : k));
  const tel = telHref(b.phone);
  const last = lastCallLabel(contact, today);
  const v = contact?.lastVisit;

  return (
    <div>
      <div className="px-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <BusinessHeader business={b}>
              {badge && <p className="mt-1.5 flex flex-wrap gap-1.5">{badge}</p>}
              {v && (
                <p className="mt-1 text-sm">
                  <span className="text-muted">{relativeDay(toDateStr(new Date(v.at)), today)}: </span>
                  {v.visitResult ? VISIT_RESULT_LABELS[v.visitResult] : "Ziyaret"}
                </p>
              )}
              {last && <p className="mt-0.5 text-sm text-muted">{last}</p>}
            </BusinessHeader>
          </div>
          <button type="button" onClick={onClose} aria-label="Kapat" className="-mr-2 -mt-1 min-h-11 min-w-11 text-xl text-muted">
            ×
          </button>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => toggle("ziyaret")}
            aria-expanded={open === "ziyaret"}
            className={`${primaryBtn} col-span-2 min-h-14 bg-call text-[17px] hover:bg-call/90`}
          >
            Uğradım: sonucu yaz
          </button>
          <a href={mapsHref(b)} target="_blank" rel="noopener noreferrer" className={btn}>
            Yol tarifi
          </a>
          {tel ? (
            <a href={tel} onClick={() => setOpen("arama")} className={`${btn} tabular-nums`}>
              Ara
            </a>
          ) : (
            <span className={`${btn} text-muted`}>Telefon yok</span>
          )}
          <button
            type="button"
            onClick={() => toggle("randevu")}
            aria-expanded={open === "randevu"}
            className={`${btn} border-meet/40 text-meet aria-expanded:bg-meet-soft`}
          >
            Randevu aldım
          </button>
          <button type="button" onClick={() => toggle("sonuc")} aria-expanded={open === "sonuc"} className={`${btn} aria-expanded:bg-paper`}>
            Telefon sonucu
          </button>
        </div>
      </div>
      {open === "ziyaret" && (
        <Panelish>
          <VisitForm businessId={b.id} currentStage={b.salesStage} today={today} onDone={close} onSaved={setSaved} />
        </Panelish>
      )}
      {open === "randevu" && (
        <Panelish>
          <AppointmentQuickForm businessId={b.id} currentStage={b.salesStage} today={today} defaultLocation={addressOf(b)} onDone={close} />
        </Panelish>
      )}
      {open === "arama" && (
        <Panelish>
          <CallScript business={b} today={today} />
          <p className="mb-2 mt-5 text-[17px] font-semibold">Nasıl bitti?</p>
          <CallResult business={b} today={today} onDone={close} />
        </Panelish>
      )}
      {open === "sonuc" && (
        <Panelish>
          <CallResult business={b} today={today} onDone={close} />
        </Panelish>
      )}
      {saved && <AfterVisit business={b} result={saved} today={today} onClose={() => setSaved(undefined)} />}
    </div>
  );
}
