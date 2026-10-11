"use client";

import Link from "next/link";
import { AppointmentControls, CalendarStatus } from "@/components/appointment-forms";
import { EmptyState, LoadState, PageTitle, Panel } from "@/components/ui";
import { useData } from "@/lib/client/refresh";
import { getRepository, type AppointmentView } from "@/lib/data";
import { APPOINTMENT_STATUS_LABELS, MEETING_TYPE_LABELS } from "@/lib/domain/labels";
import { formatDateTime, toDateStr, toTimeStr } from "@/lib/domain/time";

export default function AppointmentsPage() {
  const { data: all, error } = useData(() => getRepository().listAppointments());
  if (!all) return <LoadState error={error} />;
  const now = new Date();
  const isPast = (v: AppointmentView) => new Date(v.appointment.startsAt) < now;
  const upcoming = all.filter((v) => v.appointment.status === "planlandi" && !isPast(v));
  const awaiting = all.filter((v) => v.appointment.status === "planlandi" && isPast(v));
  const closed = all.filter((v) => v.appointment.status !== "planlandi").reverse();

  return (
    <div>
      <PageTitle>Randevular</PageTitle>
      <p className="mb-5 max-w-2xl text-[15px] text-muted">
        Yeni randevu, işletmenin sayfasından eklenir. Hatırlatma randevudan belirlenen süre önce telefonunuza gönderilir.
      </p>
      <div className="grid gap-6">
        {awaiting.length > 0 && <List title="Sonuç bekleyenler" items={awaiting} past />}
        <List title="Yaklaşan" items={upcoming} empty="Yaklaşan randevu yok." />
        {closed.length > 0 && <List title="Geçmiş" items={closed} past />}
      </div>
    </div>
  );
}

function List({ title, items, past, empty }: { title: string; items: AppointmentView[]; past?: boolean; empty?: string }) {
  return (
    <Panel>
      <h2 className="flex items-baseline justify-between border-b border-line px-4 py-3 text-[17px] font-semibold">
        {title}
        <span className="text-[15px] font-normal text-muted">{items.length}</span>
      </h2>
      {items.length === 0 && empty && <EmptyState>{empty}</EmptyState>}
      <ul>
        {items.map(({ appointment: a, business: b }) => {
          const start = new Date(a.startsAt);
          return (
            <li key={a.id} className="border-b border-line px-4 py-3 last:border-b-0">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4">
                <p className={`font-semibold ${a.status === "iptal" ? "text-muted line-through" : "text-meet"}`}>
                  {formatDateTime(a.startsAt)}
                </p>
                <p className="text-sm text-muted">{APPOINTMENT_STATUS_LABELS[a.status]}</p>
              </div>
              <Link href={`/isletme?id=${b.id}`} className="font-medium hover:underline">
                {b.name}
              </Link>
              <p className="text-sm text-muted">
                {[a.contactName, MEETING_TYPE_LABELS[a.meetingType], `${a.reminderMinutes} dk önce hatırlatma`]
                  .filter(Boolean)
                  .join(", ")}
              </p>
              {a.location && <p className="break-words text-sm text-muted">{a.location}</p>}
              {a.note && <p className="text-[15px]">{a.note}</p>}
              {a.outcome && <p className="mt-1 text-[15px]">Sonuç: {a.outcome}</p>}
              <CalendarStatus appointment={a} />
              <AppointmentControls
                appointment={a}
                isPast={!!past}
                defaults={{ date: toDateStr(start), time: toTimeStr(start) }}
              />
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
