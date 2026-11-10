"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { CallRow, type CallRowData } from "@/components/call-row";
import { AppointmentRow } from "@/components/field-rows";
import { EmptyState, LoadState, Panel } from "@/components/ui";
import { useData } from "@/lib/client/refresh";
import { getRepository, type TaskView } from "@/lib/data";
import { buildFieldPlan, summarizeContacts } from "@/lib/domain/field-plan";
import { buildFieldRoute } from "@/lib/domain/field-route";
import { CALL_STATUS_LABELS } from "@/lib/domain/labels";
import { goalProgress, SALES_GOAL } from "@/lib/domain/report";
import { isPausedOn } from "@/lib/domain/rules";
import { dayLabel, SEGMENTS } from "@/lib/domain/segments";
import { formatLongDate, formatTime, relativeDay, toDateStr } from "@/lib/domain/time";

/**
 * Bugün: sırasıyla yapılacaklar. 1) bugünün randevuları, 2) bugünkü takip aramaları,
 * 3) sıradaki saha günü için randevu araması, 4) otomatik günlük liste (açıksa).
 */
export default function HomePage() {
  const repo = getRepository();
  const { data, error } = useData(() =>
    Promise.all([repo.getHome(), repo.getSettings(), repo.listBusinesses({}), repo.listAppointments(), repo.listContactHistory()]),
  );
  if (!data) return <LoadState error={error} />;
  const [home, settings, businesses, appointments, history] = data;
  const { today, counts, run } = home;
  const now = new Date();
  const pausedToday = isPausedOn(settings.pause, today);

  const todaysAppointments = appointments
    .filter((v) => v.appointment.status !== "iptal" && toDateStr(new Date(v.appointment.startsAt)) === today)
    .sort((a, b) => a.appointment.startsAt.localeCompare(b.appointment.startsAt));

  // Sıradaki saha günü (bugün dahil) ve o bölgede randevu için aranacak klinik sayısı.
  const match = SEGMENTS.estetik.match;
  const plan = buildFieldPlan(
    buildFieldRoute(businesses, match).days,
    appointments.filter((v) => match(v.business)),
    summarizeContacts(history),
    now,
  );
  const nextDay = plan.days
    .filter((d) => d.view.day.date >= today)
    .sort((a, b) => a.view.day.date.localeCompare(b.view.day.date))[0];
  const goal = goalProgress(businesses, today);

  const toRow = (v: TaskView, dueLabel?: string): CallRowData => ({
    ...v,
    dueLabel,
    lastCallLabel: v.lastCall?.callResult
      ? `Son arama: ${relativeDay(toDateStr(new Date(v.lastCall.at)), today)}, ${CALL_STATUS_LABELS[v.lastCall.callResult].toLocaleLowerCase("tr-TR")}`
      : undefined,
  });
  const daysLate = (due: string) => {
    const diff = Math.round((Date.parse(today) - Date.parse(due)) / 86_400_000);
    return diff === 1 ? "1 gün gecikti" : `${diff} gün gecikti`;
  };
  const followUps: { row: CallRowData; late: boolean }[] = [
    ...home.gecikenler.map((v) => ({ row: toRow(v, daysLate(v.task.dueDate)), late: true })),
    ...home.dundenKalanlar.map((v) => ({ row: toRow(v, "Dün ulaşılamadı"), late: false })),
    ...home.planlananlar.map((v) => ({ row: toRow(v, v.task.dueTime ? `Saat ${v.task.dueTime}` : "Gün içinde"), late: false })),
  ];

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">{formatLongDate(today)}</h1>

      <Link href="/rapor" className="mb-5 mt-3 flex items-center justify-between gap-3 rounded-lg border border-line bg-surface px-4 py-3">
        <span>
          <span className="block text-sm text-muted">{SALES_GOAL.label}</span>
          <span className="text-xl font-semibold tabular-nums">
            {goal.customers}
            <span className="text-base font-normal text-muted">/{goal.target} müşteri</span>
          </span>
        </span>
        <span className="text-right text-sm text-muted">
          Bugün {counts.callsToday} arama
          <span className="block font-medium text-meet">Gün sonu ›</span>
        </span>
      </Link>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section n={1} title="Bugünkü randevular" count={todaysAppointments.length}>
          {todaysAppointments.length ? (
            <ul>
              {todaysAppointments.map((v) => (
                <AppointmentRow key={v.appointment.id} item={v} today={today} />
              ))}
            </ul>
          ) : (
            <EmptyState>Bugün randevu yok.</EmptyState>
          )}
        </Section>

        <Section n={2} title="Bugünkü takip aramaları" count={followUps.length}>
          {followUps.length ? (
            <ul>
              {followUps.map(({ row, late }) => (
                <CallRow key={row.task.id} row={row} today={today} tone={late ? "late" : undefined} />
              ))}
            </ul>
          ) : (
            <EmptyState>Bugün için takip araması yok.</EmptyState>
          )}
        </Section>

        {nextDay && (
          <Section n={3} title="Randevu için ara" count={nextDay.toCall.length}>
            <Link href={`/saha#${nextDay.view.day.id}`} className="flex items-center justify-between gap-3 px-4 py-4 hover:bg-paper">
              <span>
                <span className="block text-sm text-muted">
                  {nextDay.view.day.date === today ? "Bugünün saha bölgesi" : `Sıradaki saha günü: ${dayLabel(nextDay.view.day.date, "long")}`}
                </span>
                <span className="block text-[17px] font-semibold">{nextDay.view.day.title}</span>
                <span className="text-sm">
                  {nextDay.appointments.length} randevu var · {nextDay.toCall.length} klinik aranacak
                </span>
              </span>
              <span aria-hidden className="text-2xl text-muted">
                ›
              </span>
            </Link>
          </Section>
        )}

        {(home.newTasks.length > 0 || !pausedToday) && (
          <Section n={4} title="Günün otomatik listesi" count={home.newTasks.length}>
            {home.newTasks.length ? (
              <ul>
                {home.newTasks.map((v) => (
                  <CallRow key={v.task.id} row={toRow(v)} today={today} />
                ))}
              </ul>
            ) : (
              <EmptyState>
                {run ? `Liste ${formatTime(run.startedAt)}'te hazırlandı, hepsi arandı.` : "Liste her sabah 08.30'da hazırlanır."}
              </EmptyState>
            )}
          </Section>
        )}
      </div>

      {pausedToday && (
        <p className="mt-6 text-sm text-muted">
          Otomatik günlük liste kapalı. Açmak için{" "}
          <Link href="/ayarlar" className="font-medium text-meet hover:underline">
            Ayarlar
          </Link>
          .
        </p>
      )}
    </div>
  );
}

function Section({ n, title, count, children }: { n: number; title: string; count: number; children: ReactNode }) {
  return (
    <Panel className="self-start overflow-hidden" aria-label={title}>
      <h2 className="flex items-center gap-2.5 border-b border-line px-4 py-3 text-[17px] font-semibold">
        <span className="flex size-6 items-center justify-center rounded-full bg-ink text-xs text-white">{n}</span>
        {title}
        <span className="ml-auto text-[15px] font-normal text-muted">{count}</span>
      </h2>
      {children}
    </Panel>
  );
}
