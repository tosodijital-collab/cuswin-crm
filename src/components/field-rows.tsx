"use client";

// Saha ve Bugün ekranlarındaki klinik kartları. Her kartta en fazla üç düğme; gerisi "Sonuç" altında.
// Araştırmadaki satış akışı: ara → randevu al → git, demo yap → aynı gün tanıtım → tarih koy → tanıştırma iste.

import Link from "next/link";
import { useActionState, useCallback, useEffect, useState, type ReactNode } from "react";
import { recordCallAction, type ActionState } from "@/lib/actions";
import { formatPhone, mapsHref, telHref } from "@/lib/domain/contact-info";
import type { AppointmentItem, ContactSummary } from "@/lib/domain/field-plan";
import { whatsappHref } from "@/lib/domain/field-route";
import { CALL_STATUS_LABELS, CATEGORY_LABELS, VISIT_RESULT_LABELS } from "@/lib/domain/labels";
import { getMaterial } from "@/lib/domain/materials";
import { confirmationText, FOLLOW_UPS, MISSED_CALL_TEXT } from "@/lib/domain/sales-playbook";
import { addDays, formatDateTime, formatTime, relativeDay, toDateStr } from "@/lib/domain/time";
import type { Business, VisitResult } from "@/lib/domain/types";
import { AppointmentQuickForm, CallOutcomeForm } from "./call-outcome-form";
import { ShareMaterialButton } from "./share-material";
import { showToast } from "./toast";
import { Badge, FieldLabel, FormMessage, inputClass, StageBadge } from "./ui";
import { VisitForm } from "./visit-form";

const tanitim = getMaterial("tanitim");

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
function AfterVisit({ business: b, result, onClose }: { business: Business; result: VisitResult; onClose: () => void }) {
  if (result === "ilgilenmiyor" || result === "kapali") return null;
  const wa = whatsappHref(b.phone, tanitim.message);
  return (
    <Panelish>
      <p className="font-semibold">Sıradaki adım: tanıtımı şimdi gönder</p>
      <p className="mb-3 text-sm text-muted">Satış kuralı: görüşmeden sonra aynı gün. {VISIT_RESULT_LABELS[result]}.</p>
      <div className="grid grid-cols-2 gap-2">
        <ShareMaterialButton material={tanitim} label="Tanıtımı gönder" className={`${primaryBtn} col-span-2 bg-call hover:bg-call/90`} />
        {wa && (
          <a href={wa} target="_blank" rel="noopener noreferrer" className={btn}>
            WhatsApp&apos;ı aç
          </a>
        )}
        <button type="button" onClick={onClose} className={`${btn} ${wa ? "" : "col-span-2"}`}>
          Tamam
        </button>
      </div>
    </Panelish>
  );
}

/** Randevulu ziyaret: önce yol, sonra sonuç. */
export function AppointmentRow({ item: { appointment: a, business: b }, today, showDate }: { item: AppointmentItem; today: string; showDate?: boolean }) {
  const [open, setOpen] = useState<false | "sonuc" | "sonra">(false);
  const [saved, setSaved] = useState<VisitResult>();
  const close = useCallback(() => setOpen((v) => (v === "sonuc" ? false : v)), []);
  const done = a.status === "yapildi";
  const tel = telHref(b.phone);
  const confirm = whatsappHref(b.phone, confirmationText(formatDateTime(a.startsAt)));

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
      {saved && <AfterVisit business={b} result={saved} onClose={() => setSaved(undefined)} />}
    </li>
  );
}

function lastCallLabel(contact: ContactSummary | undefined, today: string): string | undefined {
  const c = contact?.lastCall;
  if (!c?.callResult) return undefined;
  return `Son arama ${relativeDay(toDateStr(new Date(c.at)), today).toLocaleLowerCase("tr-TR")}: ${CALL_STATUS_LABELS[c.callResult].toLocaleLowerCase("tr-TR")}`;
}

/** Tek dokunuşla arama sonucu (ulaşılamadı, ilgilenmiyor) ya da tarihli "sonra ara". */
function QuickResult({ businessId, result, label, className }: { businessId: string; result: string; label: string; className: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(recordCallAction, { ok: false });
  useEffect(() => {
    if (state.ok) showToast(`${label}: kaydedildi.`);
  }, [state, label]);
  return (
    <form action={action} className="contents">
      <input type="hidden" name="businessId" value={businessId} />
      <input type="hidden" name="result" value={result} />
      <button type="submit" disabled={pending} className={`${className} disabled:opacity-50`}>
        {label}
      </button>
      {!state.ok && state.message && (
        <span className="col-span-2">
          <FormMessage state={state} />
        </span>
      )}
    </form>
  );
}

function CallLaterForm({ businessId, today, onDone }: { businessId: string; today: string; onDone: () => void }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(recordCallAction, { ok: false });
  useEffect(() => {
    if (state.ok) {
      showToast("Tekrar arama planlandı.");
      onDone();
    }
  }, [state, onDone]);
  return (
    <form action={action} className="grid gap-2">
      <input type="hidden" name="businessId" value={businessId} />
      <input type="hidden" name="result" value="tekrar_aranacak" />
      <div className="grid grid-cols-[1fr_7rem] gap-2">
        <div>
          <FieldLabel htmlFor={`later-${businessId}`}>Ne zaman arayayım?</FieldLabel>
          <input id={`later-${businessId}`} type="date" name="nextDate" min={today} defaultValue={addDays(today, 1)} required className={inputClass} />
        </div>
        <div>
          <FieldLabel htmlFor={`later-t-${businessId}`}>Saat</FieldLabel>
          <input id={`later-t-${businessId}`} type="time" name="nextTime" defaultValue="11:00" className={inputClass} />
        </div>
      </div>
      <input name="note" maxLength={500} placeholder="Not (kiminle konuştun?)" aria-label="Not" className={inputClass} />
      <button type="submit" disabled={pending} className={`${primaryBtn} bg-ink hover:bg-ink/90 disabled:opacity-50`}>
        {pending ? "Kaydediliyor" : "Kaydet"}
      </button>
      <FormMessage state={state} />
    </form>
  );
}

type CallPanel = "randevu" | "sonuc" | "sonra" | "ziyaret" | "diger";

/**
 * Randevu almak için aranacak klinik. Üç düğme: Ara · Randevu aldım · Sonuç.
 * "Sonuç" açılınca tek dokunuşluk seçenekler; ayrıntılı form en sonda.
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
  const wa = whatsappHref(b.phone, MISSED_CALL_TEXT);
  const last = lastCallLabel(contact, today);
  const option = `${btn} w-full`;

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
            <a href={tel} className={`${primaryBtn} col-span-2 bg-call tabular-nums hover:bg-call/90`}>
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
            aria-expanded={open !== false && open !== "randevu"}
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
      {open === "sonuc" && (
        <Panelish>
          <div className="grid grid-cols-2 gap-2">
            <QuickResult businessId={b.id} result="ulasilamadi" label="Ulaşılamadı" className={option} />
            <button type="button" onClick={() => setOpen("sonra")} className={option}>
              Konuştum, sonra ara
            </button>
            <QuickResult businessId={b.id} result="ilgilenmiyor" label="İlgilenmiyor" className={option} />
            <button type="button" onClick={() => setOpen("ziyaret")} className={option}>
              Randevusuz uğradım
            </button>
            {wa && (
              <a href={wa} target="_blank" rel="noopener noreferrer" className={`${option} border-call/40 text-call`}>
                WhatsApp mesajı
              </a>
            )}
            <ShareMaterialButton material={tanitim} label="Tanıtımı gönder" className={`${option} border-call/40 text-call`} />
            <button type="button" onClick={() => setOpen("diger")} className={`${option} ${wa ? "col-span-2" : ""} text-muted`}>
              Diğer sonuç
            </button>
          </div>
          <p className="mt-2 text-sm text-muted">
            &quot;Bilgi gönderin&quot; derse Tanıtımı gönder, ama tarih iste. Ne diyeceğin: Rehber → Telefon.
          </p>
        </Panelish>
      )}
      {open === "sonra" && (
        <Panelish>
          <CallLaterForm businessId={b.id} today={today} onDone={close} />
        </Panelish>
      )}
      {open === "ziyaret" && (
        <Panelish>
          <VisitForm businessId={b.id} currentStage={b.salesStage} today={today} onDone={close} onSaved={setSaved} />
        </Panelish>
      )}
      {open === "diger" && (
        <Panelish>
          <CallOutcomeForm businessId={b.id} currentStage={b.salesStage} today={today} onDone={close} autoFocus />
        </Panelish>
      )}
      {saved && <AfterVisit business={b} result={saved} onClose={() => setSaved(undefined)} />}
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
            const href = whatsappHref(b.phone, f.text);
            return href ? (
              <a key={f.id} href={href} target="_blank" rel="noopener noreferrer" title={f.when} className={`${btn} border-call/40 text-call`}>
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
