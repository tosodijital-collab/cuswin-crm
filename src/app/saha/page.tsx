"use client";

import Link from "next/link";
import { useCallback, useState, type ReactNode } from "react";
import { AppointmentQuickForm, CallOutcomeForm } from "@/components/call-outcome-form";
import { Badge, CallStatusBadge, EmptyState, LoadState, PageTitle, Panel, StageBadge } from "@/components/ui";
import { useData } from "@/lib/client/refresh";
import { getRepository } from "@/lib/data";
import { formatPhone, mapsHref, telHref } from "@/lib/domain/contact-info";
import {
  buildFieldRoute,
  dayDirectionsHref,
  hasOutcome,
  whatsappHref,
  type FieldDayView,
} from "@/lib/domain/field-route";
import { CATEGORY_LABELS } from "@/lib/domain/labels";
import { formatDateTime, toDateStr } from "@/lib/domain/time";
import type { Business } from "@/lib/domain/types";

type Segment = "estetik" | "dis";

const SEGMENTS: Record<Segment, { label: string; match: (b: Business) => boolean }> = {
  // Önce estetik ve saç: pilot klinik bu segmentte, rakamlar en güçlü burada.
  estetik: { label: "Estetik ve saç", match: (b) => !b.categories.includes("dis") || b.categories.length > 1 },
  dis: { label: "Diş (2. aşama)", match: (b) => b.categories.includes("dis") },
};

const VISIT_NOTE = "Yüz yüze ziyaret. ";
const FOLLOW_UP_TEXT =
  "Merhaba, bugün kliniğinize uğrayan Cuswin'den Özkan Toso. Konuştuğumuz tanıtım dosyasını gönderiyorum. Uygun olduğunuz bir gün 10 dakikada canlı gösterebilirim.";

export default function FieldPage() {
  const repo = getRepository();
  const { data, error } = useData(() => Promise.all([repo.listBusinesses({}), repo.listAppointments()]));
  const [segment, setSegment] = useState<Segment>("estetik");
  if (!data) return <LoadState error={error} />;
  const [businesses, appointments] = data;
  const today = toDateStr(new Date());
  const now = new Date();

  const nextAppointment = new Map<string, string>();
  for (const { appointment: a } of appointments) {
    if (a.status !== "planlandi" || new Date(a.startsAt) < now) continue;
    const prev = nextAppointment.get(a.businessId);
    if (!prev || a.startsAt < prev) nextAppointment.set(a.businessId, a.startsAt);
  }

  const route = buildFieldRoute(businesses, SEGMENTS[segment].match);
  const days = route.days.filter((d) => d.stops.length > 0);
  const total = days.reduce((n, d) => n + d.stops.length, 0);
  const done = days.reduce((n, d) => n + d.stops.filter((s) => hasOutcome(s.business)).length, 0);

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
        {total} durak, {done} tanesine sonuç girildi.
        {route.excluded > 0 && ` Müşteri olan, olumsuz ya da ilgilenmeyen ${route.excluded} kayıt listede yok.`}
      </p>

      <DoorScript />

      <nav aria-label="Günler" className="-mx-4 mb-5 flex gap-2 overflow-x-auto px-4 pb-1">
        {days.map(({ day, stops }) => (
          <a
            key={day.id}
            href={`#${day.id}`}
            className="shrink-0 rounded-full border border-line bg-surface px-3 py-1.5 text-sm font-medium"
          >
            {day.title.split(" · ")[0]} · {stops.length}
          </a>
        ))}
      </nav>

      <div className="grid gap-6">
        {days.length === 0 && route.unplaced.length === 0 && (
          <Panel>
            <EmptyState>Bu segmentte ziyaret edilecek kayıt yok.</EmptyState>
          </Panel>
        )}
        {days.map((d) => (
          <DaySection key={d.day.id} view={d} today={today} nextAppointment={nextAppointment} />
        ))}

        {route.unplaced.length > 0 && (
          <Panel className="overflow-hidden" aria-label="Rotaya girmeyenler">
            <h2 className="border-b border-line px-4 py-3 text-[17px] font-semibold">
              Rotaya girmeyenler <span className="font-normal text-muted">{route.unplaced.length}</span>
            </h2>
            <p className="px-4 pt-3 text-sm text-muted">Adresi eksik ya da rota bölgelerinin dışında. Adresi düzeltilirse doğru güne düşer.</p>
            <ul>
              {route.unplaced.map((b, i) => (
                <StopRow key={b.id} business={b} n={i + 1} today={today} appointmentAt={nextAppointment.get(b.id)} />
              ))}
            </ul>
          </Panel>
        )}
      </div>
    </div>
  );
}

function DoorScript() {
  return (
    <details className="mb-5 rounded-lg border border-line bg-surface">
      <summary className="cursor-pointer px-4 py-3 text-[15px] font-semibold">Kapıda ne diyeceğim?</summary>
      <div className="grid gap-3 border-t border-line px-4 py-3 text-[15px]">
        <dl className="grid grid-cols-2 gap-2 text-center">
          <Fact value="2.934" label="mesaj ve arama, 30 günde" />
          <Fact value="462/464" label="mesai dışı konuşma karşılandı" />
          <Fact value="174" label="randevu alındı" />
          <Fact value="%93" label="randevuya gelme" />
        </dl>
        <Script title="Sekretere">
          Merhaba, ben Özkan, Cuswin&apos;in kurucusuyum. Kliniklere gelen telefon, WhatsApp ve Instagram mesajlarına cevap
          veren bir sistem kurduk. Doktor bey/hanım müsait mi? Değilse 10 dakikalık bir randevu alabilir miyim?
        </Script>
        <Script title="Doktora açılış">
          Ankara&apos;da bir klinikte Cuswin&apos;i 1 aydır kullanıyoruz. 30 günde 2.934 mesaj ve arama gelmiş, yarısından fazlası
          mesai saatleri dışında. Sizde durum nasıl?
        </Script>
        <Script title="Canlı demo">
          Kendi telefonunuzdan şu hesaba hasta gibi yazın: &quot;Dolgu ne kadar?&quot; Cevap 3 saniyede gelir. Sonra paneli göster.
        </Script>
        <Script title="Kapanış">
          Kurulum 3 gün sürüyor. Hangi gün başlayalım, pazartesi mi çarşamba mı? Broşürü bırak, tarih koymadan çıkma.
        </Script>
        <p className="text-sm text-muted">Pilot kliniğin adını hiçbir koşulda söyleme.</p>
      </div>
    </details>
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

function DaySection({
  view: { day, stops },
  today,
  nextAppointment,
}: {
  view: FieldDayView;
  today: string;
  nextAppointment: Map<string, string>;
}) {
  const directions = dayDirectionsHref(stops);
  const done = stops.filter((s) => hasOutcome(s.business)).length;
  return (
    <Panel id={day.id} className="scroll-mt-4 overflow-hidden" aria-label={day.title}>
      <div className="border-b border-line px-4 py-3">
        <h2 className="flex items-baseline justify-between gap-3 text-[17px] font-semibold">
          {day.title}
          <span className="shrink-0 text-sm font-normal text-muted">
            {done}/{stops.length}
          </span>
        </h2>
        <p className="mt-0.5 text-sm text-muted">{day.area}</p>
        {day.note && <p className="mt-2 rounded-md bg-late-soft px-3 py-2 text-sm text-late">{day.note}</p>}
        {directions && (
          <a
            href={directions}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-md bg-ink px-4 text-[15px] font-medium text-white sm:w-auto"
          >
            Günün rotasını Haritalar&apos;da aç
          </a>
        )}
      </div>
      {stops.length ? (
        <ul>
          {stops.map((s, i) => (
            <StopRow
              key={s.business.id}
              business={s.business}
              n={i + 1}
              today={today}
              appointmentAt={nextAppointment.get(s.business.id)}
            />
          ))}
        </ul>
      ) : null}
    </Panel>
  );
}

function StopRow({
  business: b,
  n,
  today,
  appointmentAt,
}: {
  business: Business;
  n: number;
  today: string;
  appointmentAt?: string;
}) {
  const [open, setOpen] = useState<false | "sonuc" | "randevu">(false);
  const close = useCallback(() => setOpen(false), []);
  const tel = telHref(b.phone);
  const wa = whatsappHref(b.phone, FOLLOW_UP_TEXT);
  const visited = hasOutcome(b);
  const btn = "inline-flex min-h-11 items-center justify-center whitespace-nowrap rounded-md border border-line px-2 text-[15px] font-medium hover:bg-paper sm:px-3";

  return (
    <li className={`border-b border-line last:border-b-0 ${visited ? "bg-paper/50" : ""}`}>
      <div className="flex gap-3 px-4 py-3.5">
        <span
          aria-hidden
          className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${visited ? "bg-call text-white" : "bg-paper text-muted"}`}
        >
          {visited ? "✓" : n}
        </span>
        <div className="min-w-0 flex-1">
          <Link href={`/isletme?id=${b.id}`} className="block text-[16px] font-medium hover:underline">
            {b.name}
          </Link>
          <p className="mt-0.5 text-sm text-muted">{b.categories.map((c) => CATEGORY_LABELS[c]).join(", ")}</p>
          {b.address && <p className="mt-0.5 break-words text-sm">{b.address}</p>}
          {(visited || appointmentAt) && (
            <p className="mt-1.5 flex flex-wrap gap-1.5">
              {appointmentAt && <Badge tone="meet">Randevu: {formatDateTime(appointmentAt)}</Badge>}
              {visited && <CallStatusBadge status={b.callStatus} />}
              {visited && b.salesStage !== "yeni_aday" && <StageBadge stage={b.salesStage} />}
            </p>
          )}
          <div className="mt-3 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            <a href={mapsHref(b)} target="_blank" rel="noopener noreferrer" className={`${btn} border-ink bg-ink text-white hover:bg-ink/90`}>
              Yol tarifi
            </a>
            {tel ? (
              <a href={tel} className={`${btn} tabular-nums`}>
                {formatPhone(b.phone)}
              </a>
            ) : (
              <span className="self-center text-sm text-stop">Telefon yok</span>
            )}
            <button
              type="button"
              onClick={() => setOpen((v) => (v === "sonuc" ? false : "sonuc"))}
              aria-expanded={open === "sonuc"}
              className={`${btn} aria-expanded:bg-paper`}
            >
              Ziyaret sonucu
            </button>
            <button
              type="button"
              onClick={() => setOpen((v) => (v === "randevu" ? false : "randevu"))}
              aria-expanded={open === "randevu"}
              className={`${btn} border-meet/40 text-meet hover:bg-meet-soft aria-expanded:bg-meet-soft`}
            >
              Randevu aldım
            </button>
            {wa && (
              <a href={wa} target="_blank" rel="noopener noreferrer" className={`${btn} col-span-2 border-call/40 text-call hover:bg-call-soft`}>
                WhatsApp&apos;tan takip mesajı
              </a>
            )}
          </div>
        </div>
      </div>
      {open && (
        <div className="border-t border-dashed border-line bg-paper/60 px-4 py-4">
          {open === "randevu" ? (
            <AppointmentQuickForm businessId={b.id} currentStage={b.salesStage} today={today} onDone={close} />
          ) : (
            <CallOutcomeForm
              businessId={b.id}
              currentStage={b.salesStage}
              today={today}
              onDone={close}
              defaultNote={VISIT_NOTE}
              resultLabel="Sonuç"
            />
          )}
        </div>
      )}
    </li>
  );
}
