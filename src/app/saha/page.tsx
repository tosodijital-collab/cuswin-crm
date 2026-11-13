"use client";

import Link from "next/link";
import { useState } from "react";
import { AppointmentRow, CallTargetRow, VisitedRow } from "@/components/field-rows";
import { isHot } from "@/components/insights";
import { EmptyState, LoadState, PageTitle, Panel } from "@/components/ui";
import { useData } from "@/lib/client/refresh";
import { getRepository } from "@/lib/data";
import { buildFieldPlan, summarizeContacts, type ContactSummary, type FieldDayPlan } from "@/lib/domain/field-plan";
import { buildFieldRoute, dayDirectionsHref, type FieldStop } from "@/lib/domain/field-route";
import { dayLabel, SEGMENTS, type Segment } from "@/lib/domain/segments";
import { toDateStr } from "@/lib/domain/time";

/**
 * Saha planı: her gün için önce o günün randevuları, sonra o bölgede randevu için aranacaklar.
 * Akış (araştırma ve satış kiti): önce ara ve randevu al, sahaya randevuya göre çık.
 */
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
  const match = SEGMENTS[segment].match;

  const route = buildFieldRoute(businesses, match);
  const contacts = summarizeContacts(history);
  const plan = buildFieldPlan(route.days, appointments.filter((v) => match(v.business)), contacts, now);
  const days = plan.days.filter((d) => d.view.stops.length > 0 || d.appointments.length > 0);
  const totals = days.reduce(
    (t, d) => ({ appt: t.appt + d.appointments.length, call: t.call + d.toCall.length, visited: t.visited + d.visited.length }),
    { appt: 0, call: 0, visited: 0 },
  );
  const other: Segment = segment === "estetik" ? "dis" : "estetik";

  return (
    <div>
      <PageTitle
        aside={
          <Link href="/rehber" className="text-[15px] font-medium text-meet hover:underline">
            Ne diyeceğim?
          </Link>
        }
      >
        Saha{segment === "dis" && <span className="ml-2 text-base font-normal text-muted">Diş</span>}
      </PageTitle>

      <p className="mb-3 text-[15px]">
        <strong className="font-semibold">{totals.appt}</strong> randevu · <strong className="font-semibold">{totals.call}</strong> aranacak ·{" "}
        <strong className="font-semibold">{totals.visited}</strong> ziyaret
        <span className="block text-sm text-muted">Önce ara, o güne randevu al. Sahaya randevulara göre çık.</span>
      </p>

      <Link
        href="/harita"
        className="mb-4 flex min-h-14 items-center justify-center gap-2 rounded-lg bg-ink px-4 text-[17px] font-semibold text-white hover:bg-ink/90"
      >
        Haritada gör: yakınımdaki klinikler
      </Link>

      <nav
        aria-label="Günler"
        className="sticky top-0 z-10 -mx-4 mb-4 flex gap-2 overflow-x-auto border-b border-line bg-paper/95 px-4 py-2 backdrop-blur"
      >
        {days.map(({ view: { day }, appointments: a }) => (
          <a
            key={day.id}
            href={`#${day.id}`}
            aria-current={day.date === today ? "date" : undefined}
            className="inline-flex min-h-11 shrink-0 items-center rounded-full border border-line bg-surface px-3.5 text-[15px] font-medium aria-[current=date]:border-ink aria-[current=date]:bg-ink aria-[current=date]:text-white"
          >
            {dayLabel(day.date, "short")}
            <span className="ml-1.5 tabular-nums opacity-70">{a.length}</span>
          </a>
        ))}
      </nav>

      <div className="grid gap-6">
        {days.length === 0 && (
          <Panel>
            <EmptyState>Bu alanda saha kaydı yok.</EmptyState>
          </Panel>
        )}
        {days.map((d) => (
          <DaySection key={d.view.day.id} plan={d} today={today} contacts={contacts} />
        ))}

        {plan.otherAppointments.length > 0 && (
          <Panel className="overflow-hidden" aria-label="Saha günleri dışındaki randevular">
            <h2 className="border-b border-line px-4 py-3 text-[17px] font-semibold">
              Diğer günlerdeki randevular <span className="font-normal text-muted">{plan.otherAppointments.length}</span>
            </h2>
            <ul>
              {plan.otherAppointments.map((v) => (
                <AppointmentRow key={v.appointment.id} item={v} today={today} showDate />
              ))}
            </ul>
          </Panel>
        )}

        {route.unplaced.length > 0 && (
          <Panel className="overflow-hidden" aria-label="Tanıştırmalar ve rota dışındakiler">
            <h2 className="border-b border-line px-4 py-3 text-[17px] font-semibold">
              Tanıştırmalar ve rota dışındakiler <span className="font-normal text-muted">{route.unplaced.length}</span>
            </h2>
            <p className="px-4 pt-3 text-sm text-muted">Adres girilirse doğru güne düşer.</p>
            <ul>
              {route.unplaced.map((b) => (
                <CallTargetRow key={b.id} business={b} today={today} contact={contacts.get(b.id)} />
              ))}
            </ul>
          </Panel>
        )}

        <button
          type="button"
          onClick={() => {
            setSegment(other);
            window.scrollTo({ top: 0 });
          }}
          className="min-h-12 rounded-lg border border-dashed border-line text-[15px] text-muted hover:bg-surface"
        >
          {segment === "estetik" ? "Diş kliniklerini göster (2. aşama)" : "Estetik ve saç kliniklerine dön"}
        </button>
      </div>
    </div>
  );
}

function DaySection({ plan, today, contacts }: { plan: FieldDayPlan; today: string; contacts: Map<string, ContactSummary> }) {
  const { view, appointments, visited } = plan;
  // Telefonda sorunu söylemiş (sıcak) klinikler önce aranır.
  const hot = (id: string) => isHot([contacts.get(id)?.lastCall?.note, contacts.get(id)?.lastVisit?.note]);
  const toCall = [...plan.toCall].sort((x, y) => Number(hot(y.business.id)) - Number(hot(x.business.id)));
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
      className={`scroll-mt-16 overflow-hidden ${isToday ? "border-ink ring-1 ring-ink" : ""}`}
      aria-label={`${dayLabel(day.date, "long")}: ${day.title}`}
    >
      <div className="border-b border-line px-4 py-3">
        <p className="text-sm font-medium text-muted">
          {dayLabel(day.date, "long")}
          {isToday && <span className="ml-2 rounded bg-ink px-1.5 py-0.5 text-xs text-white">Bugün</span>}
        </p>
        <h2 className="mt-0.5 text-[18px] font-semibold">{day.title}</h2>
        {day.note && <p className="mt-2 rounded-md bg-late-soft px-3 py-2 text-sm text-late">{day.note}</p>}
        {directions && appointments.length > 0 && (
          <a
            href={directions}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex min-h-12 w-full items-center justify-center rounded-md bg-ink px-4 text-[16px] font-semibold text-white sm:w-auto"
          >
            Randevu rotasını aç
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
        <EmptyState>Henüz randevu yok. Aşağıdakileri ara, {dayLabel(day.date, "long")} için randevu al.</EmptyState>
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
          <summary className="flex min-h-11 cursor-pointer items-center border-t border-line bg-paper/70 px-4 text-sm font-medium text-muted">
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
    <h3 className="flex justify-between border-b border-t border-line bg-paper/70 px-4 py-2 text-sm font-semibold text-muted first:border-t-0">
      {title}
      <span>{count}</span>
    </h3>
  );
}
