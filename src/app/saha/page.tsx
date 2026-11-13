"use client";

import Link from "next/link";
import { FieldMap } from "@/components/field-map";
import { AppointmentRow } from "@/components/field-rows";
import { EmptyState, LoadState, PageTitle, Panel } from "@/components/ui";
import { useData } from "@/lib/client/refresh";
import { getRepository } from "@/lib/data";
import { dayDirectionsHref } from "@/lib/domain/field-route";
import { formatLongDate, toDateStr } from "@/lib/domain/time";

/**
 * Saha: dışarıdayken tek ekran. Üstte bugünün yüz yüze randevuları ve rotası, altında harita:
 * konumum, yakınımdaki klinikler, "Uğradım". Kimi arayacağın Bugün ekranındaki takvimde.
 */
export default function FieldPage() {
  const repo = getRepository();
  const { data, error } = useData(() => repo.listAppointments());
  if (!data) return <LoadState error={error} />;
  const today = toDateStr(new Date());
  const todays = data
    .filter((v) => v.appointment.status !== "iptal" && v.appointment.meetingType === "yuz_yuze" && toDateStr(new Date(v.appointment.startsAt)) === today)
    .sort((a, b) => a.appointment.startsAt.localeCompare(b.appointment.startsAt));
  const planned = todays.filter((v) => v.appointment.status === "planlandi");
  const route = dayDirectionsHref(planned.map((v, i) => ({ business: v.business, order: i })));
  const next = data
    .filter((v) => v.appointment.status === "planlandi" && v.appointment.meetingType === "yuz_yuze" && toDateStr(new Date(v.appointment.startsAt)) > today)
    .sort((a, b) => a.appointment.startsAt.localeCompare(b.appointment.startsAt))[0];

  return (
    <div className="grid gap-4">
      <PageTitle
        aside={
          <Link href="/rehber" className="text-[15px] font-medium text-meet hover:underline">
            Kapıda ne diyeceğim?
          </Link>
        }
      >
        Saha
      </PageTitle>

      <Panel className="overflow-hidden">
        <div className="border-b border-line px-4 py-3">
          <h2 className="flex items-center justify-between text-[17px] font-semibold">
            Bugünün randevuları <span className="text-[15px] font-normal text-muted">{planned.length}</span>
          </h2>
          <p className="text-sm text-muted">{formatLongDate(today)}</p>
          {route && planned.length > 0 && (
            <a
              href={route}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 flex min-h-12 items-center justify-center rounded-md bg-ink px-4 text-[16px] font-semibold text-white"
            >
              Randevu rotasını aç ({planned.length} durak)
            </a>
          )}
        </div>
        {todays.length ? (
          <ul>
            {todays.map((v) => (
              <AppointmentRow key={v.appointment.id} item={v} today={today} />
            ))}
          </ul>
        ) : (
          <EmptyState>
            Bugün yüz yüze randevu yok.
            {next && (
              <>
                {" "}
                Sıradaki: <strong className="font-semibold">{next.business.name}</strong>, {formatLongDate(toDateStr(new Date(next.appointment.startsAt)))}.
              </>
            )}{" "}
            Aşağıdaki haritadan yakınındaki kliniklere uğrayabilirsin.
          </EmptyState>
        )}
      </Panel>

      <div>
        <h2 className="mb-2 text-[17px] font-semibold">Yakınımdaki klinikler</h2>
        <FieldMap />
      </div>
    </div>
  );
}
