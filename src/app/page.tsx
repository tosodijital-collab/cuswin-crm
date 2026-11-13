"use client";

import Link from "next/link";
import { useMemo, useState, useTransition, type ReactNode } from "react";
import { CallRow, type CallRowData } from "@/components/call-row";
import { openConfirmSheet } from "@/components/call-outcome-form";
import { CallSession } from "@/components/call-session";
import { AppointmentRow } from "@/components/field-rows";
import { WhatsappTo } from "@/components/send-whatsapp";
import { closeSheet, openSheet } from "@/components/sheet";
import { showToast } from "@/components/toast";
import { EmptyState, LoadState, Panel } from "@/components/ui";
import { runDailyListAction } from "@/lib/actions";
import { useData } from "@/lib/client/refresh";
import { markSent } from "@/lib/client/sent";
import { getRepository, type AppointmentView, type TaskView } from "@/lib/data";
import { doneToday, messagesDue, orderToday, SENT_PREFIX, taskLabel, weekDays, type MessageTask } from "@/lib/domain/day-plan";
import { CALL_STATUS_LABELS, VISIT_RESULT_LABELS } from "@/lib/domain/labels";
import { isPausedOn } from "@/lib/domain/rules";
import { addDays, formatLongDate, formatTime, relativeDay, toDateStr } from "@/lib/domain/time";
import type { Settings } from "@/lib/domain/types";

/**
 * Bugün: haftalık takvim ve günün planı. Ne yapılacağı sırayla:
 * randevular → aranacaklar (arka arkaya arama) → gönderilecek mesajlar → bugün yapılanlar.
 * Arama sonucuna göre tekrar aranacak klinik kendiliğinden ilgili güne (açmadıysa yarına) düşer.
 */
export default function HomePage() {
  const repo = getRepository();
  const { data, error } = useData(() => {
    const today = toDateStr(new Date());
    return Promise.all([
      repo.getHome(),
      repo.getSettings(),
      repo.listBusinesses({}),
      repo.listAppointments(),
      repo.listContactHistory(),
      repo.listUpcomingTasks(addDays(today, 1), addDays(today, 6)),
      repo.listNotesWithPrefix(SENT_PREFIX),
    ]);
  });
  const [selected, setSelected] = useState<string>();
  const [session, setSession] = useState(false);

  const plan = useMemo(() => {
    if (!data) return undefined;
    const [home, settings, businesses, appointments, history, upcoming, sentNotes] = data;
    const today = home.today;
    const byId = new Map(businesses.map((b) => [b.id, b]));
    const activeAppts = appointments.filter((v) => v.appointment.status !== "iptal");
    const apptsOn = (d: string) =>
      activeAppts
        .filter((v) => toDateStr(new Date(v.appointment.startsAt)) === d)
        .sort((a, b) => a.appointment.startsAt.localeCompare(b.appointment.startsAt));
    const todayTasks = orderToday([...home.gecikenler, ...home.planlananlar, ...home.dundenKalanlar, ...home.newTasks]);
    const tasksOn = (d: string) => (d === today ? todayTasks : upcoming.filter((v) => v.task.dueDate === d));
    const done = doneToday(history, byId, today);
    const messages = messagesDue({ businesses: byId, history, sentNotes, appointments: appointments.map((v) => v.appointment), today });
    return { home, settings, today, apptsOn, tasksOn, todayTasks, done, messages, callsToday: home.counts.callsToday };
  }, [data]);

  if (!plan) return <LoadState error={error} />;
  const { home, settings, today, todayTasks, done, messages } = plan;
  const day = selected ?? today;

  if (session) {
    return <CallSession rows={todayTasks} today={today} done={plan.callsToday} onExit={() => setSession(false)} />;
  }

  return (
    <div className="grid gap-4">
      <div className="flex items-baseline justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{formatLongDate(day)}</h1>
        <Link href="/rapor" className="shrink-0 text-[15px] font-medium text-meet">
          Gün sonu ›
        </Link>
      </div>

      <WeekStrip
        days={weekDays(today)}
        today={today}
        selected={day}
        onSelect={setSelected}
        countFor={(d) => ({
          calls: plan.tasksOn(d).length,
          appts: plan.apptsOn(d).filter((v) => v.appointment.status === "planlandi").length,
        })}
      />

      {day === today ? (
        <TodayPlan
          today={today}
          tasks={todayTasks}
          appointments={plan.apptsOn(today)}
          callsToday={plan.callsToday}
          done={done}
          messages={messages}
          settings={settings}
          hasRun={Boolean(home.run)}
          onStart={() => setSession(true)}
        />
      ) : (
        <FuturePlan day={day} today={today} tasks={plan.tasksOn(day)} appointments={plan.apptsOn(day)} settings={settings} />
      )}
    </div>
  );
}

function WeekStrip({
  days,
  today,
  selected,
  onSelect,
  countFor,
}: {
  days: string[];
  today: string;
  selected: string;
  onSelect: (d: string) => void;
  countFor: (d: string) => { calls: number; appts: number };
}) {
  return (
    <div role="tablist" aria-label="Hafta" className="grid grid-cols-7 gap-1">
      {days.map((d) => {
        const date = new Date(`${d}T12:00:00+03:00`);
        const { calls, appts } = countFor(d);
        return (
          <button
            key={d}
            type="button"
            role="tab"
            aria-selected={d === selected}
            onClick={() => onSelect(d)}
            className="flex min-h-[4.75rem] flex-col items-center justify-center rounded-lg border border-line bg-surface px-0.5 py-1.5 aria-selected:border-ink aria-selected:bg-ink aria-selected:text-white"
          >
            <span className="text-[12px] font-medium opacity-70">
              {d === today ? "Bugün" : date.toLocaleDateString("tr-TR", { timeZone: "Europe/Istanbul", weekday: "short" })}
            </span>
            <span className="text-lg font-semibold leading-tight tabular-nums">
              {date.toLocaleDateString("tr-TR", { timeZone: "Europe/Istanbul", day: "numeric" })}
            </span>
            <span className="mt-0.5 grid text-[11px] font-semibold leading-tight tabular-nums">
              {calls > 0 && <span>{calls} ara</span>}
              {appts > 0 && <span>{appts} rnd</span>}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function TodayPlan({
  today,
  tasks,
  appointments,
  callsToday,
  done,
  messages,
  settings,
  hasRun,
  onStart,
}: {
  today: string;
  tasks: TaskView[];
  appointments: AppointmentView[];
  callsToday: number;
  done: ReturnType<typeof doneToday>;
  messages: MessageTask[];
  settings: Settings;
  hasRun: boolean;
  onStart: () => void;
}) {
  const total = callsToday + tasks.length;
  const plannedAppts = appointments.filter((v) => v.appointment.status === "planlandi");
  const paused = isPausedOn(settings.pause, today);

  return (
    <>
      <Panel className="px-4 py-4">
        <p className="text-sm font-medium text-muted">Bugünün planı</p>
        <p className="mt-0.5 text-[17px]">
          <strong className="font-semibold">{tasks.length} arama</strong> kaldı
          {plannedAppts.length > 0 && (
            <>
              {" "}
              · <strong className="font-semibold">{plannedAppts.length} randevu</strong>
            </>
          )}
          {messages.length > 0 && (
            <>
              {" "}
              · <strong className="font-semibold">{messages.length} mesaj</strong>
            </>
          )}
        </p>
        <div className="mt-3 flex items-center gap-3">
          <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-line" aria-hidden>
            <div className="h-full rounded-full bg-call" style={{ width: `${total ? (callsToday / total) * 100 : 0}%` }} />
          </div>
          <span className="shrink-0 text-sm tabular-nums text-muted">
            {callsToday}/{total} arandı
          </span>
        </div>
        {tasks.length > 0 && (
          <button
            type="button"
            onClick={onStart}
            className="mt-4 flex min-h-14 w-full items-center justify-center gap-2 rounded-md bg-call px-4 text-[18px] font-semibold text-white hover:bg-call/90"
          >
            Aramaya başla ({tasks.length})
          </button>
        )}
        {!hasRun && !paused && <PrepareList target={settings.dailyTarget} />}
      </Panel>

      {appointments.length > 0 && (
        <Section title="Randevular" count={plannedAppts.length}>
          <ul>
            {appointments.map((v) => (
              <AppointmentRow key={v.appointment.id} item={v} today={today} />
            ))}
          </ul>
        </Section>
      )}

      <Section title="Aranacaklar" count={tasks.length} hint="Sıra: saatli takipler, takipler, dün açmayanlar, yeniler">
        {tasks.length ? (
          <ul>
            {tasks.map((v) => (
              <CallRow key={v.task.id} row={toRow(v, today)} today={today} tone={taskLabel(v.task, today).late ? "late" : undefined} />
            ))}
          </ul>
        ) : (
          <EmptyState>{callsToday > 0 ? "Bugünün aramaları bitti." : "Bugün aranacak klinik yok."}</EmptyState>
        )}
      </Section>

      {messages.length > 0 && (
        <Section title="Mesaj gönder" count={messages.length} hint="Takip ve randevu teyidi; gönderince listeden düşer">
          <ul>
            {messages.map((m) => (
              <MessageRow key={`${m.kind}-${m.business.id}`} m={m} />
            ))}
          </ul>
        </Section>
      )}

      {done.length > 0 && (
        <details className="rounded-lg border border-line bg-surface">
          <summary className="flex min-h-12 cursor-pointer items-center justify-between px-4 text-[16px] font-semibold">
            Bugün yapılanlar <span className="font-normal text-muted">{done.length}</span>
          </summary>
          <ul className="border-t border-line">
            {done.map(({ business: b, activity: a }) => (
              <li key={a.id} className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5 last:border-b-0">
                <Link href={`/isletme?id=${b.id}`} className="min-w-0 truncate text-[15px] font-medium hover:underline">
                  {b.name}
                </Link>
                <span className="shrink-0 text-sm text-muted">
                  {a.type === "ziyaret"
                    ? a.visitResult
                      ? VISIT_RESULT_LABELS[a.visitResult]
                      : "Ziyaret"
                    : a.callResult
                      ? CALL_STATUS_LABELS[a.callResult]
                      : "Arama"}{" "}
                  · {formatTime(a.at)}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </>
  );
}

function FuturePlan({
  day,
  today,
  tasks,
  appointments,
  settings,
}: {
  day: string;
  today: string;
  tasks: TaskView[];
  appointments: AppointmentView[];
  settings: Settings;
}) {
  const paused = isPausedOn(settings.pause, day);
  return (
    <>
      <Panel className="px-4 py-4">
        <p className="text-sm font-medium text-muted">{relativeDay(day, today)} için plan</p>
        <p className="mt-0.5 text-[17px]">
          <strong className="font-semibold">{tasks.length} arama</strong> planlı · <strong className="font-semibold">{appointments.length} randevu</strong>
        </p>
        <p className="mt-1 text-sm text-muted">
          Açmayanlar ve &quot;sonra ara&quot; dediklerin buraya kendiliğinden düşer.
          {!paused && ` O sabah ${settings.dailyTarget} yeni klinik daha eklenir.`}
        </p>
      </Panel>
      {appointments.length > 0 && (
        <Section title="Randevular" count={appointments.length}>
          <ul>
            {appointments.map((v) => (
              <AppointmentRow key={v.appointment.id} item={v} today={today} />
            ))}
          </ul>
        </Section>
      )}
      <Section title="Planlı aramalar" count={tasks.length}>
        {tasks.length ? (
          <ul>
            {tasks.map((v) => (
              <CallRow key={v.task.id} row={toRow(v, today)} today={today} />
            ))}
          </ul>
        ) : (
          <EmptyState>Bu güne planlı arama yok.</EmptyState>
        )}
      </Section>
    </>
  );
}

function toRow(v: TaskView, today: string): CallRowData {
  return {
    ...v,
    dueLabel: v.task.dueDate > today ? (v.task.dueTime ? `Saat ${v.task.dueTime}` : undefined) : taskLabel(v.task, today).text,
    lastCallLabel: v.lastCall?.callResult
      ? `Son arama: ${relativeDay(toDateStr(new Date(v.lastCall.at)), today)}, ${CALL_STATUS_LABELS[v.lastCall.callResult].toLocaleLowerCase("tr-TR")}`
      : undefined,
  };
}

function MessageRow({ m }: { m: MessageTask }) {
  const open = () => {
    if (m.kind === "teyit" && m.appointment) return openConfirmSheet(m.business, m.appointment.startsAt);
    openSheet(m.kind === "takip3" ? "3. gün takip mesajı" : "2. hafta takip mesajı", <FollowUpBody m={m} />);
  };
  return (
    <li className="flex items-center justify-between gap-3 border-b border-line px-4 py-3 last:border-b-0">
      <div className="min-w-0">
        <p className="truncate text-[16px] font-medium">{m.business.name}</p>
        <p className="text-sm text-muted">
          {m.kind === "teyit" ? "Randevu teyidi" : m.kind === "takip3" ? "3. gün takip" : "2. hafta takip"} · {m.why}
        </p>
      </div>
      <button type="button" onClick={open} className="min-h-11 shrink-0 rounded-md border border-call/40 px-4 text-[15px] font-semibold text-call">
        Gönder
      </button>
    </li>
  );
}

function FollowUpBody({ m }: { m: MessageTask }) {
  return (
    <WhatsappTo
      business={m.business}
      message={m.text ?? ""}
      label="WhatsApp'tan gönder"
      onSent={() => {
        markSent(m.business.id, m.kind);
        closeSheet();
      }}
    />
  );
}

function PrepareList({ target }: { target: number }) {
  const [pending, start] = useTransition();
  return (
    <div className="mt-3 rounded-md bg-paper px-3 py-3 text-[15px]">
      <p>Bugünün {target} yeni kliniği henüz eklenmedi (her sabah 08.30&apos;da eklenir).</p>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await runDailyListAction();
            if (r.message) showToast(r.message);
          })
        }
        className="mt-2 min-h-11 rounded-md bg-ink px-4 text-[15px] font-semibold text-white disabled:opacity-50"
      >
        {pending ? "Hazırlanıyor" : "Şimdi ekle"}
      </button>
    </div>
  );
}

function Section({ title, count, hint, children }: { title: string; count: number; hint?: string; children: ReactNode }) {
  return (
    <Panel className="overflow-hidden" aria-label={title}>
      <div className="border-b border-line px-4 py-3">
        <h2 className="flex items-center justify-between gap-2 text-[17px] font-semibold">
          {title}
          <span className="text-[15px] font-normal text-muted">{count}</span>
        </h2>
        {hint && <p className="text-sm text-muted">{hint}</p>}
      </div>
      {children}
    </Panel>
  );
}
