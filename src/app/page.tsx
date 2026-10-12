"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { CallRow, type CallRowData } from "@/components/call-row";
import { PauseControl } from "@/components/pause-control";
import { RunNowButton } from "@/components/settings-forms";
import { EmptyState, LoadState, Panel } from "@/components/ui";
import { useData } from "@/lib/client/refresh";
import { getRepository, type TaskView } from "@/lib/data";
import { CALL_STATUS_LABELS, MEETING_TYPE_LABELS } from "@/lib/domain/labels";
import { isPausedOn } from "@/lib/domain/rules";
import { formatLongDate, formatTime, relativeDay, toDateStr } from "@/lib/domain/time";

export default function HomePage() {
  const repo = getRepository();
  const { data, error } = useData(() => Promise.all([repo.getHome(), repo.getSettings()]));
  if (!data) return <LoadState error={error} />;
  const [home, settings] = data;
  const { today, counts, run } = home;
  const pausedToday = isPausedOn(settings.pause, today);

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
  const followUpCount = home.dundenKalanlar.length + home.gecikenler.length + home.planlananlar.length;

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-2xl font-semibold tracking-tight">{formatLongDate(today)}</h1>
        <p className="mt-1 text-[15px] text-muted">
          {run
            ? `Günün listesi ${formatTime(run.startedAt)} itibarıyla hazır, ${run.selected} yeni işletme.`
            : pausedToday
              ? "Bugün ara verdin; otomatik liste hazırlanmadı."
              : "Günün listesi henüz hazırlanmadı. Her sabah 08.30'da kendiliğinden hazırlanır."}
        </p>
        {run?.shortfallReason && (
          <p className="mt-2 rounded-md bg-late-soft px-3 py-2 text-sm text-late">{run.shortfallReason}</p>
        )}
        {(!run || run.selected < run.target) && (
          <div className="mt-3">
            <RunNowButton primary />
          </div>
        )}
        {run?.error && <p className="mt-2 rounded-md bg-stop-soft px-3 py-2 text-sm text-stop">Hata: {run.error}</p>}
        <div className="mt-3">
          <PauseControl pause={settings.pause} today={today} compact />
        </div>
      </div>

      <dl className="mb-6 grid grid-cols-5 gap-px overflow-hidden rounded-lg border border-line bg-line">
        <Stat short="Yeni" label="Kalan yeni aday" value={`${counts.newRemaining}/${counts.newTotal}`} />
        <Stat short="Arama" label="Bugün yapılan arama" value={counts.callsToday} />
        <Stat short="Takip" label="Bekleyen takip" value={counts.openFollowUps} />
        <Stat short="Randevu" label="Bugünkü randevu" value={counts.appointmentsToday} />
        <Stat short="Müşteri" label="Kazanılan müşteri" value={counts.customers} />
      </dl>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="grid gap-6">
          <Section title="Bugün aranacak yeni işletmeler" count={home.newTasks.length}>
            {home.newTasks.length ? (
              <ul>
                {home.newTasks.map((v) => (
                  <CallRow key={v.task.id} row={toRow(v)} today={today} />
                ))}
              </ul>
            ) : (
              <EmptyState>
                {counts.newTotal
                  ? "Bugünün yeni listesi tamamlandı."
                  : "Bugün için yeni işletme yok. Ayarlar ekranından listeyi elle hazırlayabilirsiniz."}
              </EmptyState>
            )}
          </Section>

          <Section title="Takip aramaları" count={followUpCount}>
            {followUpCount === 0 && <EmptyState>Bugün için bekleyen takip yok.</EmptyState>}
            <Group title="Gecikenler" items={home.gecikenler}>
              {(v) => <CallRow key={v.task.id} row={toRow(v, daysLate(v.task.dueDate))} today={today} tone="late" />}
            </Group>
            <Group title="Dünden kalanlar" items={home.dundenKalanlar}>
              {(v) => <CallRow key={v.task.id} row={toRow(v)} today={today} />}
            </Group>
            <Group title="Bugüne planlananlar" items={home.planlananlar}>
              {(v) => (
                <CallRow key={v.task.id} row={toRow(v, v.task.dueTime ? `Saat ${v.task.dueTime}` : "Gün içinde")} today={today} />
              )}
            </Group>
          </Section>
        </div>

        <Section
          title="Bugünkü randevular"
          count={home.appointmentsToday.length}
          className={home.appointmentsToday.length ? "order-first lg:order-none" : ""}
        >
          {home.appointmentsToday.length ? (
            <ul>
              {home.appointmentsToday.map(({ appointment: a, business: b }) => (
                <li key={a.id} className="border-b border-line px-4 py-3 last:border-b-0">
                  <p className="text-lg font-semibold text-meet">{formatTime(a.startsAt)}</p>
                  <Link href={`/isletme?id=${b.id}`} className="block font-medium hover:underline">
                    {b.name}
                  </Link>
                  <p className="text-sm text-muted">
                    {[a.contactName, MEETING_TYPE_LABELS[a.meetingType]].filter(Boolean).join(", ")}
                  </p>
                  {a.location && <p className="mt-0.5 break-words text-sm text-muted">{a.location}</p>}
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState>Bugün randevu yok.</EmptyState>
          )}
          <div className="border-t border-line px-4 py-2.5">
            <Link href="/randevular" className="text-sm font-medium text-meet hover:underline">
              Tüm randevular
            </Link>
          </div>
        </Section>
      </div>
    </div>
  );
}

function Stat({ label, short, value }: { label: string; short: string; value: ReactNode }) {
  return (
    <div className="bg-surface px-2 py-2.5 text-center sm:px-4 sm:py-3 sm:text-left">
      <dt className="text-xs text-muted sm:text-sm">
        <span className="sm:hidden">{short}</span>
        <span className="hidden sm:inline">{label}</span>
      </dt>
      <dd className="text-lg font-semibold tabular-nums sm:text-xl">{value}</dd>
    </div>
  );
}

function Section({ title, count, children, className = "" }: { title: string; count: number; children: ReactNode; className?: string }) {
  return (
    <Panel className={`self-start overflow-hidden ${className}`} aria-label={title}>
      <h2 className="flex items-baseline justify-between border-b border-line px-4 py-3 text-[17px] font-semibold">
        {title}
        <span className="text-[15px] font-normal text-muted">{count}</span>
      </h2>
      {children}
    </Panel>
  );
}

function Group({
  title,
  items,
  children,
}: {
  title: string;
  items: TaskView[];
  children: (v: TaskView) => ReactNode;
}) {
  if (items.length === 0) return null;
  return (
    <div>
      <h3 className="border-b border-line bg-paper/70 px-4 py-1.5 text-sm font-medium text-muted">
        {title} ({items.length})
      </h3>
      <ul>{items.map(children)}</ul>
    </div>
  );
}
