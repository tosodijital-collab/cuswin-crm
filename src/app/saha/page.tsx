"use client";

import Link from "next/link";
import { useActionState, useCallback, useState, type ReactNode } from "react";
import { AppointmentQuickForm, CallOutcomeForm } from "@/components/call-outcome-form";
import { ShareMaterialButton } from "@/components/share-material";
import { Badge, EmptyState, FormMessage, LoadState, PageTitle, Panel, StageBadge } from "@/components/ui";
import { VisitForm } from "@/components/visit-form";
import { recordCallAction, type ActionState } from "@/lib/actions";
import { useData } from "@/lib/client/refresh";
import { getRepository } from "@/lib/data";
import { formatPhone, mapsHref, telHref } from "@/lib/domain/contact-info";
import {
  buildFieldPlan,
  summarizeContacts,
  type AppointmentItem,
  type ContactSummary,
  type FieldDayPlan,
} from "@/lib/domain/field-plan";
import { buildFieldRoute, dayDirectionsHref, whatsappHref, type FieldStop } from "@/lib/domain/field-route";
import { CALL_STATUS_LABELS, CATEGORY_LABELS, VISIT_RESULT_LABELS } from "@/lib/domain/labels";
import { getMaterial } from "@/lib/domain/materials";
import { formatDateTime, formatTime, relativeDay, toDateStr } from "@/lib/domain/time";
import type { Business } from "@/lib/domain/types";

type Segment = "estetik" | "dis";

const SEGMENTS: Record<Segment, { label: string; match: (b: Business) => boolean }> = {
  // Önce estetik ve saç: pilot klinik bu segmentte, rakamlar en güçlü burada.
  estetik: { label: "Estetik ve saç", match: (b) => !b.categories.includes("dis") || b.categories.length > 1 },
  dis: { label: "Diş (2. aşama)", match: (b) => b.categories.includes("dis") },
};

const tanitim = getMaterial("tanitim");
const btn =
  "inline-flex min-h-11 items-center justify-center whitespace-nowrap rounded-md border border-line px-2 text-[15px] font-medium hover:bg-paper sm:px-3";

export default function FieldPage() {
  const repo = getRepository();
  const { data, error } = useData(() =>
    Promise.all([repo.listBusinesses({}), repo.listAppointments(), repo.listContactHistory()]),
  );
  const [segment, setSegment] = useState<Segment>("estetik");
  if (!data) return <LoadState error={error} />;
  const [businesses, appointments, history] = data;
  const now = new Date();
  const today = toDateStr(now);

  const route = buildFieldRoute(businesses, SEGMENTS[segment].match);
  const contacts = summarizeContacts(history);
  const segmentAppointments = appointments.filter((v) => SEGMENTS[segment].match(v.business));
  const plan = buildFieldPlan(route.days, segmentAppointments, contacts, now);
  const days = plan.days.filter((d) => d.view.stops.length > 0 || d.appointments.length > 0);
  const totals = days.reduce(
    (t, d) => ({ appt: t.appt + d.appointments.length, call: t.call + d.toCall.length, visited: t.visited + d.visited.length }),
    { appt: 0, call: 0, visited: 0 },
  );

  return (
    <div>
      <PageTitle>Saha</PageTitle>

      <div role="tablist" aria-label="Segment" className="mb-4 grid grid-cols-2 gap-1 rounded-lg border border-line bg-surface p-1">
        {(Object.keys(SEGMENTS) as Segment[]).map((s) => (
          <button
            key={s}
            type="button"
            role="tab"
            aria-selected={segment === s}
            onClick={() => setSegment(s)}
            className="min-h-10 rounded-md text-[15px] text-muted aria-selected:bg-ink aria-selected:font-medium aria-selected:text-white"
          >
            {SEGMENTS[s].label}
          </button>
        ))}
      </div>

      <p className="mb-4 text-[15px] text-muted">
        Önce ara ve o güne yüz yüze randevu al; sahaya randevulara göre çık, aradaki boşlukta yakındaki kliniklere uğra.{" "}
        <span className="text-ink">
          {totals.appt} randevu · {totals.call} aranacak · {totals.visited} ziyaret edildi.
        </span>
      </p>

      <Scripts />

      <nav aria-label="Günler" className="-mx-4 mb-5 flex gap-2 overflow-x-auto px-4 pb-1">
        {days.map(({ view: { day }, appointments: a }) => (
          <a
            key={day.id}
            href={`#${day.id}`}
            aria-current={day.date === today ? "date" : undefined}
            className="shrink-0 rounded-full border border-line bg-surface px-3 py-1.5 text-sm font-medium aria-[current=date]:border-ink aria-[current=date]:bg-ink aria-[current=date]:text-white"
          >
            {dayLabel(day.date, "short")} · {a.length} randevu
          </a>
        ))}
      </nav>

      <div className="grid gap-6">
        {days.length === 0 && (
          <Panel>
            <EmptyState>Bu segmentte saha kaydı yok.</EmptyState>
          </Panel>
        )}
        {days.map((d) => (
          <DaySection key={d.view.day.id} plan={d} today={today} contacts={contacts} />
        ))}

        {plan.otherAppointments.length > 0 && (
          <Panel className="overflow-hidden" aria-label="Saha günleri dışındaki randevular">
            <h2 className="border-b border-line px-4 py-3 text-[17px] font-semibold">
              Saha günleri dışındaki yüz yüze randevular <span className="font-normal text-muted">{plan.otherAppointments.length}</span>
            </h2>
            <ul>
              {plan.otherAppointments.map((v) => (
                <AppointmentRow key={v.appointment.id} item={v} today={today} showDate />
              ))}
            </ul>
          </Panel>
        )}

        {route.unplaced.length > 0 && (
          <Panel className="overflow-hidden" aria-label="Rotaya girmeyenler">
            <h2 className="border-b border-line px-4 py-3 text-[17px] font-semibold">
              Rotaya girmeyenler <span className="font-normal text-muted">{route.unplaced.length}</span>
            </h2>
            <p className="px-4 pt-3 text-sm text-muted">Adresi eksik ya da rota bölgelerinin dışında. Adresi düzeltilirse doğru güne düşer.</p>
            <ul>
              {route.unplaced.map((b) => (
                <CallTargetRow key={b.id} business={b} today={today} contact={contacts.get(b.id)} />
              ))}
            </ul>
          </Panel>
        )}
      </div>
    </div>
  );
}

/** "2026-11-12" → "12 Kas Per" (kısa) ya da "12 Kasım Perşembe" (uzun). Öğlen alınır: saat dilimi günü kaydırmasın. */
function dayLabel(date: string, style: "short" | "long"): string {
  const d = new Date(`${date}T12:00:00+03:00`);
  return d.toLocaleDateString("tr-TR", {
    timeZone: "Europe/Istanbul",
    day: "numeric",
    month: style === "short" ? "short" : "long",
    weekday: style === "short" ? "short" : "long",
  });
}

function Scripts() {
  return (
    <div className="mb-5 grid gap-2">
      <details className="rounded-lg border border-line bg-surface">
        <summary className="cursor-pointer px-4 py-3 text-[15px] font-semibold">Telefonda: randevu nasıl alınır?</summary>
        <div className="grid gap-3 border-t border-line px-4 py-3 text-[15px]">
          <Script title="Sekretere">
            Merhaba, ben [adın], Cuswin&apos;den. Kliniklere gelen telefon, WhatsApp ve Instagram mesajlarına cevap veren bir sistem
            kurduk. Ankara&apos;da bir klinikte 1 aydır çalışıyor. Doktor bey/hanıma kliniğinizde 10 dakika yüz yüze göstermek isterim.
          </Script>
          <Script title="İki seçenek sun">
            Perşembe 14:00 mü uygun, yoksa 16:00 mı? (Açık uçlu &quot;ne zaman uygun?&quot; diye sorma.)
          </Script>
          <Script title="&quot;Bilgi gönderin&quot; derse">
            Tabii, tanıtım dosyasını WhatsApp&apos;tan atıyorum. Ama asıl farkı 10 dakikada kendi telefonunuzdan görüyorsunuz; perşembe
            o bölgedeyim, 14:00&apos;te uğrayayım mı?
          </Script>
          <p className="text-sm text-muted">
            Randevu alınca &quot;Randevu aldım&quot;a bas: tarih o saha günü, adres kliniğin adresi olarak gelir, takvime yazılır.
          </p>
        </div>
      </details>
      <details className="rounded-lg border border-line bg-surface">
        <summary className="cursor-pointer px-4 py-3 text-[15px] font-semibold">Ziyarette: 10 dakikalık görüşme</summary>
        <div className="grid gap-3 border-t border-line px-4 py-3 text-[15px]">
          <dl className="grid grid-cols-2 gap-2 text-center">
            <Fact value="2.934" label="mesaj ve arama, 30 günde" />
            <Fact value="462/464" label="mesai dışı konuşma karşılandı" />
            <Fact value="174" label="randevu alındı" />
            <Fact value="%93" label="randevuya gelme" />
          </dl>
          <Script title="Açılış (30 sn)">
            Ankara&apos;da bir klinikte Cuswin&apos;i 1 aydır kullanıyoruz. 30 günde 2.934 mesaj ve arama gelmiş, yarısından fazlası mesai
            saatleri dışında. Sizde durum nasıl?
          </Script>
          <Script title="Sor ve dinle (2 dk)">
            Günde kaç mesaj geliyor? Akşam ve hafta sonu kim bakıyor? &quot;Düşüneyim&quot; diyen hastaya geri dönülüyor mu?
          </Script>
          <Script title="Canlı demo (3 dk)">
            Kendi telefonunuzdan şu hesaba hasta gibi yazın: &quot;Dolgu ne kadar?&quot; Cevap 3 saniyede gelir. Sonra paneli göster.
          </Script>
          <Script title="Kapanış (2 dk)">
            Kurulum 3 gün sürüyor. Hangi gün başlayalım, pazartesi mi çarşamba mı? Broşürü bırak, tarih koymadan çıkma.
          </Script>
          <p className="text-sm text-muted">Pilot kliniğin adını hiçbir koşulda söyleme.</p>
        </div>
      </details>
    </div>
  );
}

function Fact({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-md bg-paper px-2 py-2">
      <dt className="sr-only">{label}</dt>
      <dd className="text-lg font-semibold tabular-nums">{value}</dd>
      <dd className="text-xs text-muted">{label}</dd>
    </div>
  );
}

function Script({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <p className="text-sm font-medium text-muted">{title}</p>
      <p>{children}</p>
    </div>
  );
}

function DaySection({ plan, today, contacts }: { plan: FieldDayPlan; today: string; contacts: Map<string, ContactSummary> }) {
  const { view, appointments, toCall, visited } = plan;
  const { day } = view;
  // Randevu varsa rota randevu sırasıyla, yoksa bölgenin duraklarıyla çizilir.
  const routeStops: FieldStop[] = appointments.length
    ? appointments.filter((v) => v.appointment.status === "planlandi").map((v, i) => ({ business: v.business, order: i }))
    : view.stops;
  const directions = dayDirectionsHref(routeStops);
  const isToday = day.date === today;

  return (
    <Panel
      id={day.id}
      className={`scroll-mt-4 overflow-hidden ${isToday ? "border-ink ring-1 ring-ink" : ""}`}
      aria-label={`${dayLabel(day.date, "long")}: ${day.title}`}
    >
      <div className="border-b border-line px-4 py-3">
        <p className="text-sm font-medium text-muted">
          {dayLabel(day.date, "long")}
          {isToday && <span className="ml-2 rounded bg-ink px-1.5 py-0.5 text-xs text-white">Bugün</span>}
        </p>
        <h2 className="mt-0.5 text-[17px] font-semibold">{day.title}</h2>
        <p className="mt-0.5 text-sm text-muted">{day.area}</p>
        {day.note && <p className="mt-2 rounded-md bg-late-soft px-3 py-2 text-sm text-late">{day.note}</p>}
        {directions && (
          <a
            href={directions}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-md bg-ink px-4 text-[15px] font-medium text-white sm:w-auto"
          >
            {appointments.length ? "Randevu rotasını Haritalar'da aç" : "Bölgenin rotasını Haritalar'da aç"}
          </a>
        )}
      </div>

      <SubHeading title="Randevular" count={appointments.length} />
      {appointments.length ? (
        <ul>
          {appointments.map((v) => (
            <AppointmentRow key={v.appointment.id} item={v} today={today} />
          ))}
        </ul>
      ) : (
        <EmptyState>Bu güne henüz randevu yok. Aşağıdaki klinikleri arayıp {dayLabel(day.date, "long")} için randevu al.</EmptyState>
      )}

      <SubHeading title="Randevu için ara" count={toCall.length} />
      {toCall.length ? (
        <ul>
          {toCall.map((s) => (
            <CallTargetRow key={s.business.id} business={s.business} today={today} fieldDate={day.date} contact={contacts.get(s.business.id)} />
          ))}
        </ul>
      ) : (
        <EmptyState>Bu bölgede aranacak klinik kalmadı.</EmptyState>
      )}

      {visited.length > 0 && (
        <details>
          <summary className="cursor-pointer border-t border-line bg-paper/70 px-4 py-2 text-sm font-medium text-muted">
            Ziyaret edilenler ({visited.length})
          </summary>
          <ul>
            {visited.map((s) => (
              <VisitedRow key={s.business.id} business={s.business} today={today} contact={contacts.get(s.business.id)} />
            ))}
          </ul>
        </details>
      )}
    </Panel>
  );
}

function SubHeading({ title, count }: { title: string; count: number }) {
  return (
    <h3 className="flex justify-between border-b border-t border-line bg-paper/70 px-4 py-1.5 text-sm font-medium text-muted first:border-t-0">
      {title}
      <span>{count}</span>
    </h3>
  );
}

function BusinessHeader({ business: b, children }: { business: Business; children?: ReactNode }) {
  return (
    <>
      <Link href={`/isletme?id=${b.id}`} className="block text-[16px] font-medium hover:underline">
        {b.name}
      </Link>
      <p className="mt-0.5 text-sm text-muted">{b.categories.map((c) => CATEGORY_LABELS[c]).join(", ")}</p>
      {b.address && <p className="mt-0.5 break-words text-sm">{b.address}</p>}
      {children}
    </>
  );
}

function PhoneButton({ business: b }: { business: Business }) {
  const tel = telHref(b.phone);
  return tel ? (
    <a href={tel} className={`${btn} tabular-nums`}>
      {formatPhone(b.phone)}
    </a>
  ) : (
    <span className="self-center text-sm text-stop">Telefon yok</span>
  );
}

/** Randevulu ziyaret: saat, yol tarifi, ziyaret sonucu (randevuyu "yapıldı" yapar), tanıtım gönderme. */
function AppointmentRow({ item: { appointment: a, business: b }, today, showDate }: { item: AppointmentItem; today: string; showDate?: boolean }) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const done = a.status === "yapildi";
  return (
    <li className={`border-b border-line last:border-b-0 ${done ? "bg-paper/50" : ""}`}>
      <div className="flex gap-3 px-4 py-3.5">
        <div className="w-14 shrink-0">
          <p className={`text-lg font-semibold tabular-nums ${done ? "text-call" : "text-meet"}`}>{done ? "✓" : formatTime(a.startsAt)}</p>
          {done && <p className="text-xs text-muted tabular-nums">{formatTime(a.startsAt)}</p>}
        </div>
        <div className="min-w-0 flex-1">
          <BusinessHeader business={b}>
            <p className="mt-1.5 flex flex-wrap gap-1.5">
              {showDate && <Badge tone="meet">{formatDateTime(a.startsAt)}</Badge>}
              {a.contactName && <Badge>{a.contactName}</Badge>}
              {b.salesStage !== "yeni_aday" && <StageBadge stage={b.salesStage} />}
            </p>
            {done && a.outcome && <p className="mt-1 text-sm">{a.outcome}</p>}
          </BusinessHeader>
          {!done && (
            <div className="mt-3 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
              <a href={mapsHref(b)} target="_blank" rel="noopener noreferrer" className={`${btn} border-ink bg-ink text-white hover:bg-ink/90`}>
                Yol tarifi
              </a>
              <PhoneButton business={b} />
              <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className={`${btn} aria-expanded:bg-paper`}>
                Ziyaret sonucu
              </button>
              <ShareMaterialButton material={tanitim} label="Tanıtımı gönder" className={`${btn} border-call/40 text-call hover:bg-call-soft`} />
            </div>
          )}
        </div>
      </div>
      {open && (
        <div className="border-t border-dashed border-line bg-paper/60 px-4 py-4">
          <VisitForm businessId={b.id} currentStage={b.salesStage} today={today} appointmentId={a.id} onDone={close} />
        </div>
      )}
    </li>
  );
}

function lastCallLabel(contact: ContactSummary | undefined, today: string): string | undefined {
  const c = contact?.lastCall;
  if (!c?.callResult) return undefined;
  return `Son arama ${relativeDay(toDateStr(new Date(c.at)), today).toLocaleLowerCase("tr-TR")}: ${CALL_STATUS_LABELS[c.callResult].toLocaleLowerCase("tr-TR")}`;
}

/** Randevu almak için aranacak klinik: ara, randevu aldım (o saha günü), ulaşılamadı, sonuç; randevusuz uğrandıysa ziyaret. */
function CallTargetRow({
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
  const [open, setOpen] = useState<false | "randevu" | "sonuc" | "ziyaret">(false);
  const close = useCallback(() => setOpen(false), []);
  const [quick, quickAction, quickPending] = useActionState<ActionState, FormData>(recordCallAction, { ok: false });
  const toggle = (k: "randevu" | "sonuc" | "ziyaret") => setOpen((v) => (v === k ? false : k));
  const wa = whatsappHref(b.phone, tanitim.message);
  const last = lastCallLabel(contact, today);

  return (
    <li className="border-b border-line last:border-b-0">
      <div className="px-4 py-3.5">
        <BusinessHeader business={b}>
          {(last || b.failedStreak > 0) && (
            <p className="mt-1 text-sm text-late">
              {last}
              {b.failedStreak > 0 && ` (${b.failedStreak}/3 ulaşılamadı)`}
            </p>
          )}
        </BusinessHeader>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          <PhoneButton business={b} />
          <button
            type="button"
            onClick={() => toggle("randevu")}
            aria-expanded={open === "randevu"}
            className={`${btn} border-meet/40 text-meet hover:bg-meet-soft aria-expanded:bg-meet-soft`}
          >
            Randevu aldım
          </button>
          <form action={quickAction} className="contents">
            <input type="hidden" name="businessId" value={b.id} />
            <input type="hidden" name="result" value="ulasilamadi" />
            <button type="submit" disabled={quickPending} className={`${btn} hover:bg-late-soft hover:text-late disabled:opacity-50`}>
              {CALL_STATUS_LABELS.ulasilamadi}
            </button>
          </form>
          <button type="button" onClick={() => toggle("sonuc")} aria-expanded={open === "sonuc"} className={`${btn} aria-expanded:bg-paper`}>
            Arama sonucu
          </button>
          {wa && (
            <a href={wa} target="_blank" rel="noopener noreferrer" className={`${btn} border-call/40 text-call hover:bg-call-soft`}>
              WhatsApp mesajı
            </a>
          )}
          <button
            type="button"
            onClick={() => toggle("ziyaret")}
            aria-expanded={open === "ziyaret"}
            className={`${btn} ${wa ? "" : "col-span-2"} aria-expanded:bg-paper`}
          >
            Randevusuz uğradım
          </button>
        </div>
        {!quick.ok && quick.message && (
          <div className="mt-2">
            <FormMessage state={quick} />
          </div>
        )}
      </div>
      {open && (
        <div className="border-t border-dashed border-line bg-paper/60 px-4 py-4">
          {open === "randevu" ? (
            <AppointmentQuickForm
              businessId={b.id}
              currentStage={b.salesStage}
              today={today}
              defaultDate={fieldDate}
              defaultLocation={[b.address, b.district].filter(Boolean).join(", ") || undefined}
              onDone={close}
            />
          ) : open === "sonuc" ? (
            <CallOutcomeForm businessId={b.id} currentStage={b.salesStage} today={today} onDone={close} autoFocus />
          ) : (
            <VisitForm businessId={b.id} currentStage={b.salesStage} today={today} onDone={close} />
          )}
        </div>
      )}
    </li>
  );
}

function VisitedRow({ business: b, today, contact }: { business: Business; today: string; contact?: ContactSummary }) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const v = contact?.lastVisit;
  return (
    <li className="border-b border-line last:border-b-0">
      <div className="px-4 py-3">
        <BusinessHeader business={b}>
          {v && (
            <p className="mt-1 text-sm">
              <span className="text-muted">{relativeDay(toDateStr(new Date(v.at)), today)}: </span>
              {v.visitResult ? VISIT_RESULT_LABELS[v.visitResult] : "Ziyaret"}
              {v.note && <span className="text-muted">. {v.note}</span>}
            </p>
          )}
        </BusinessHeader>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:flex">
          <PhoneButton business={b} />
          <button type="button" onClick={() => setOpen((x) => !x)} aria-expanded={open} className={`${btn} border-meet/40 text-meet`}>
            Randevu aldım
          </button>
        </div>
      </div>
      {open && (
        <div className="border-t border-dashed border-line bg-paper/60 px-4 py-4">
          <AppointmentQuickForm
            businessId={b.id}
            currentStage={b.salesStage}
            today={today}
            defaultLocation={[b.address, b.district].filter(Boolean).join(", ") || undefined}
            onDone={close}
          />
        </div>
      )}
    </li>
  );
}
