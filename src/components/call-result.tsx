"use client";

// "Nasıl bitti?": aramadan sonra tek ekran. Beş net sonuç; her biri ya tek dokunuşla kaydedilir
// ya da tek bir küçük form açar. Satış aşaması ve durum kuralları sunucu tarafında otomatik belirlenir.

import { useActionState, useCallback, useEffect, useState } from "react";
import { recordCallAction, type ActionState } from "@/lib/actions";
import { whatsappChatHref, whatsappNumberOf } from "@/lib/domain/contact-info";
import { MISSED_CALL_TEXT } from "@/lib/domain/sales-playbook";
import { addDays } from "@/lib/domain/time";
import type { Business, VisitResult } from "@/lib/domain/types";
import { AppointmentQuickForm, CallOutcomeForm } from "./call-outcome-form";
import { SendWhatsapp } from "./send-whatsapp";
import { showToast } from "./toast";
import { FieldLabel, FormMessage, inputClass } from "./ui";
import { VisitForm } from "./visit-form";

const option =
  "inline-flex min-h-12 w-full items-center justify-center rounded-md border border-line bg-surface px-3 text-[15px] font-medium hover:bg-paper disabled:opacity-50";
const strong = "inline-flex min-h-13 w-full items-center justify-center rounded-md px-4 text-[16px] font-semibold text-white";

type Panel = "randevu" | "bilgi" | "sonra" | "diger" | "ziyaret" | "acmadi";

/** Tek dokunuşla kaydedilen sonuç (açmadı, ilgilenmiyor). */
function QuickResult({
  businessId,
  result,
  label,
  className,
  onSaved,
}: {
  businessId: string;
  result: string;
  label: string;
  className: string;
  onSaved?: () => void;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(recordCallAction, { ok: false });
  useEffect(() => {
    if (!state.ok) return;
    showToast(`${label}: kaydedildi.`);
    onSaved?.();
  }, [state, label, onSaved]);
  return (
    <form action={action} className="contents">
      <input type="hidden" name="businessId" value={businessId} />
      <input type="hidden" name="result" value={result} />
      <button type="submit" disabled={pending} className={className}>
        {pending ? "Kaydediliyor" : label}
      </button>
      {!state.ok && state.message && (
        <span className="col-span-2">
          <FormMessage state={state} />
        </span>
      )}
    </form>
  );
}

export function CallLaterForm({ businessId, today, onDone }: { businessId: string; today: string; onDone: () => void }) {
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
      <p className="text-sm text-muted">Tarihsiz kapatma: &quot;Hangi gün, saat kaçta arayayım?&quot; diye sor, onu yaz.</p>
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
      <input name="note" maxLength={500} placeholder="Kiminle konuştun? (isteğe bağlı)" aria-label="Not" className={inputClass} />
      <button type="submit" disabled={pending} className={`${strong} bg-ink hover:bg-ink/90 disabled:opacity-50`}>
        {pending ? "Kaydediliyor" : "Kaydet"}
      </button>
      <FormMessage state={state} />
    </form>
  );
}

export function CallResult({
  business: b,
  today,
  fieldDate,
  onDone,
  allowVisit,
  onVisitSaved,
}: {
  business: Business;
  today: string;
  /** Saha gününden açıldıysa randevu tarihi o gün gelir. */
  fieldDate?: string;
  onDone: () => void;
  /** Saha ekranında "Randevusuz uğradım" da gösterilir. */
  allowVisit?: boolean;
  onVisitSaved?: (r: VisitResult) => void;
}) {
  const [panel, setPanel] = useState<Panel>();
  const back = useCallback(() => setPanel(undefined), []);
  const missedOnWhatsapp = whatsappChatHref(whatsappNumberOf(b), MISSED_CALL_TEXT);
  const afterMissed = useCallback(() => (missedOnWhatsapp ? setPanel("acmadi") : onDone()), [missedOnWhatsapp, onDone]);
  const address = [b.address, b.district].filter(Boolean).join(", ") || undefined;

  if (panel) {
    return (
      <div className="grid gap-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[17px] font-semibold">{PANEL_TITLES[panel]}</p>
          <button type="button" onClick={panel === "acmadi" ? onDone : back} className="min-h-11 px-2 text-[15px] text-muted">
            {panel === "acmadi" ? "Kapat" : "‹ Geri"}
          </button>
        </div>
        {panel === "randevu" && (
          <AppointmentQuickForm
            businessId={b.id}
            currentStage={b.salesStage}
            today={today}
            defaultDate={fieldDate}
            defaultLocation={address}
            onDone={onDone}
          />
        )}
        {panel === "bilgi" && <SendWhatsapp business={b} today={today} record onDone={onDone} />}
        {panel === "sonra" && <CallLaterForm businessId={b.id} today={today} onDone={onDone} />}
        {panel === "diger" && <CallOutcomeForm businessId={b.id} currentStage={b.salesStage} today={today} onDone={onDone} autoFocus />}
        {panel === "ziyaret" && (
          <VisitForm businessId={b.id} currentStage={b.salesStage} today={today} onDone={onDone} onSaved={onVisitSaved} />
        )}
        {panel === "acmadi" && missedOnWhatsapp && (
          <>
            <p className="text-[15px] text-muted">Kaydedildi, yarın tekrar listende. İstersen şimdi kısa bir mesaj bırak:</p>
            <a
              href={missedOnWhatsapp}
              target="_blank"
              rel="noopener noreferrer"
              onClick={onDone}
              className={`${strong} bg-call hover:bg-call/90`}
            >
              WhatsApp&apos;tan &quot;ulaşamadım&quot; yaz
            </a>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-2">
      <button type="button" onClick={() => setPanel("randevu")} className={`${strong} col-span-2 bg-meet hover:bg-meet/90`}>
        Randevu aldım
      </button>
      <button type="button" onClick={() => setPanel("bilgi")} className={`${strong} col-span-2 bg-call hover:bg-call/90`}>
        Bilgi istedi: WhatsApp&apos;tan gönder
      </button>
      <QuickResult businessId={b.id} result="ulasilamadi" label="Açmadı" className={option} onSaved={afterMissed} />
      <button type="button" onClick={() => setPanel("sonra")} className={option}>
        Sonra ara dedi
      </button>
      <QuickResult businessId={b.id} result="ilgilenmiyor" label="İlgilenmiyor" className={option} onSaved={onDone} />
      <button type="button" onClick={() => setPanel("diger")} className={`${option} text-muted`}>
        Diğer
      </button>
      {allowVisit && (
        <button type="button" onClick={() => setPanel("ziyaret")} className="col-span-2 min-h-11 text-[15px] font-medium text-meet">
          Telefon değil, randevusuz uğradım →
        </button>
      )}
    </div>
  );
}

const PANEL_TITLES: Record<Panel, string> = {
  randevu: "Randevu tarihi",
  bilgi: "WhatsApp'tan gönder",
  sonra: "Ne zaman arayayım?",
  diger: "Diğer sonuç",
  ziyaret: "Ziyaret sonucu",
  acmadi: "Açmadı",
};
