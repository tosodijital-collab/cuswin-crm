"use client";

import Link from "next/link";
import { useMemo, useState, useTransition, type ReactNode } from "react";
import { CallRow, type CallRowData } from "@/components/call-row";
import { openConfirmSheet } from "@/components/call-outcome-form";
import { CallSession } from "@/components/call-session";
import { UndoButton } from "@/components/undo-button";
import { AppointmentRow } from "@/components/field-rows";
import { WhatsappTo } from "@/components/send-whatsapp";
import { closeSheet, openSheet } from "@/components/sheet";
import { showToast } from "@/components/toast";
import { EmptyState, LoadState, Panel } from "@/components/ui";
import { planWeekAction, postponeAfterFileAction } from "@/lib/actions";
import { useData } from "@/lib/client/refresh";
import { markSent } from "@/lib/client/sent";
import { getRepository, type AppointmentView, type TaskView } from "@/lib/data";
import {
  awaitingFile,
  candidatePoolSize,
  MESSAGE_TITLES,
  doneToday,
  messagesDue,
  orderToday,
  planningDays,
  SENT_PREFIX,
  taskLabel,
  horizonDays,
  type MessageTask,
} from "@/lib/domain/day-plan";
import { CALL_STATUS_LABELS, VISIT_RESULT_LABELS } from "@/lib/domain/labels";
import { isPausedOn } from "@/lib/domain/rules";
import { buildActivityReport, goalProgress, weekStart, type ActivityReport, type GoalProgress } from "@/lib/domain/report";
import { addDays, formatLongDate, formatTime, istanbulToUtc, relativeDay, toDateStr } from "@/lib/domain/time";
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
      repo.listUpcomingTasks(addDays(today, 1), addDays(today, 13)),
      repo.listNotesWithPrefix(SENT_PREFIX),
      repo.listActivitiesSince(istanbulToUtc(weekStart(today), "00:00").toISOString()),
    ]);
  });
  const [selected, setSelected] = useState<string>();
  const [session, setSession] = useState(false);

  const plan = useMemo(() => {
    if (!data) return undefined;
    const [home, settings, businesses, appointments, history, upcoming, sentNotes, weekActivities] = data;
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
    const pool = candidatePoolSize(
      businesses,
      settings,
      new Set(history.filter((a) => a.type === "arama").map((a) => a.businessId)),
      new Set([...todayTasks, ...upcoming].map((v) => v.business.id)),
    );
    // Planı eksik iş günleri: o güne hiç yeni klinik atanmamış.
    const newOn = (d: string) => tasksOn(d).filter((v) => v.task.kind === "yeni").length;
    const unplanned = planningDays(today).filter((d) => newOn(d) < settings.dailyTarget).length;
    const fileIds = new Set(awaitingFile(history).keys());
    const week = buildActivityReport(weekActivities, weekStart(today), today);
    const goal = goalProgress(businesses, today);
    return { home, settings, today, apptsOn, tasksOn, todayTasks, done, messages, pool, unplanned, week, goal, fileIds, callsToday: home.counts.callsToday };
  }, [data]);

  if (!plan) return <LoadState error={error} />;
  const { settings, today, todayTasks, done, messages } = plan;
  const day = selected ?? today;

  if (session) {
    return <CallSession rows={todayTasks} today={today} done={plan.callsToday} fileIds={plan.fileIds} onExit={() => setSession(false)} />;
  }

  return (
    <div className="grid gap-4">
      <div className="flex items-baseline justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{formatLongDate(day)}</h1>
        <Link href="/rapor" className="shrink-0 text-[15px] font-medium text-meet">
          Rapor ›
        </Link>
      </div>

      <WeekStrip
        days={horizonDays(today)}
        today={today}
        selected={day}
        onSelect={setSelected}
        countFor={(d) => ({
          calls: plan.tasksOn(d).length,
          appts: plan.apptsOn(d).filter((v) => v.appointment.status === "planlandi").length,
        })}
      />

      <WeekSummary week={plan.week} goal={plan.goal} />

      <WeekPlanCard paused={isPausedOn(settings.pause, today)} pool={plan.pool} target={settings.dailyTarget} unplanned={plan.unplanned} />

      {day === today ? (
        <TodayPlan
          today={today}
          tasks={todayTasks}
          appointments={plan.apptsOn(today)}
          callsToday={plan.callsToday}
          done={done}
          messages={messages}
          fileIds={plan.fileIds}
          onStart={() => setSession(true)}
        />
      ) : (
        <FuturePlan
          day={day}
          today={today}
          tasks={plan.tasksOn(day)}
          appointments={plan.apptsOn(day)}
          settings={settings}
          fileIds={plan.fileIds}
        />
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
    <div role="tablist" aria-label="Takvim" className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-1">
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
            className="flex min-h-[4.75rem] w-[3.4rem] shrink-0 flex-col items-center justify-center rounded-lg border border-line bg-surface px-0.5 py-1.5 aria-selected:border-ink aria-selected:bg-ink aria-selected:text-white sm:flex-1"
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
  fileIds,
  onStart,
}: {
  today: string;
  tasks: TaskView[];
  appointments: AppointmentView[];
  callsToday: number;
  done: ReturnType<typeof doneToday>;
  messages: MessageTask[];
  fileIds: Set<string>;
  onStart: () => void;
}) {
  const total = callsToday + tasks.length;
  const plannedAppts = appointments.filter((v) => v.appointment.status === "planlandi");

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
              <CallRow
                key={v.task.id}
                row={toRow(v, today)}
                today={today}
                afterFile={fileIds.has(v.business.id)}
                tone={taskLabel(v.task, today).late ? "late" : undefined}
              />
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
                <span className="flex shrink-0 items-center gap-2 text-sm text-muted">
                  <span>
                  {a.type === "ziyaret"
                    ? a.visitResult
                      ? VISIT_RESULT_LABELS[a.visitResult]
                      : "Ziyaret"
                    : a.callResult
                      ? CALL_STATUS_LABELS[a.callResult]
                      : "Arama"}{" "}
                  · {formatTime(a.at)}
                  </span>
                  {a.type === "arama" && (
                    <UndoButton businessId={b.id} className="min-h-10 rounded-md border border-line px-2.5 text-[13px] font-medium text-stop disabled:opacity-50" />
                  )}
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
  fileIds,
}: {
  day: string;
  today: string;
  tasks: TaskView[];
  appointments: AppointmentView[];
  settings: Settings;
  fileIds: Set<string>;
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
          {tasks.length === 0 && !paused && " Bu güne henüz yeni klinik atanmadı: yukarıdan \"Cumartesiye kadar planla\"."}
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
              <CallRow key={v.task.id} row={toRow(v, today)} today={today} afterFile={fileIds.has(v.business.id)} />
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
    openSheet(`${MESSAGE_TITLES[m.kind]}: ${m.business.name}`, <FollowUpBody m={m} />);
  };
  return (
    <li className="flex items-center justify-between gap-3 border-b border-line px-4 py-3 last:border-b-0">
      <div className="min-w-0">
        <p className="truncate text-[16px] font-medium">{m.business.name}</p>
        <p className="text-sm text-muted">
          {MESSAGE_TITLES[m.kind]} · {m.why}
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
    <div className="grid gap-3">
      {m.kind === "dosya7" && (
        <p className="text-[15px] text-muted">Son mesaj. Gönderince klinik 1 ay sonra tekrar aranacaklara düşer; bu arada seni oyalamaz.</p>
      )}
      <WhatsappTo
        business={m.business}
        message={m.text ?? ""}
        label="WhatsApp'tan gönder"
        onSent={() => {
          markSent(m.business.id, m.kind);
          if (m.kind === "dosya7") void postponeAfterFileAction(m.business.id).then((r) => r.message && showToast(r.message));
          closeSheet();
        }}
      />
    </div>
  );
}

/** Haftanın planı: boş günlere yeni klinik atar; ara verildiyse ve aranacak klinik bittiyse açıkça söyler. */
function WeekPlanCard({ paused, pool, target, unplanned }: { paused: boolean; pool: number; target: number; unplanned: number }) {
  const [pending, start] = useTransition();
  if (!paused && unplanned === 0 && pool >= target) return null;
  return (
    <Panel className="grid gap-2 px-4 py-4">
      {paused && (
        <p className="rounded-md bg-late-soft px-3 py-2 text-[15px] text-late">
          Otomatik liste ve Google Maps taraması <strong className="font-semibold">kapalı (ara verildi)</strong>. Yeni klinik kendiliğinden
          gelmez.{" "}
          <Link href="/ayarlar" className="font-semibold underline">
            Ayarlar → Devam et
          </Link>
        </p>
      )}
      <p className="text-[15px]">
        Aranmamış <strong className="font-semibold">{pool}</strong> klinik var
        {pool > 0 && <span className="text-muted"> (günde {target} ile ~{Math.ceil(pool / target)} günlük)</span>}.
        {unplanned > 0 && pool > 0 && ` ${unplanned} günün listesi boş ya da eksik.`}
      </p>
      {pool < target * 5 && <p className="text-sm text-muted">Klinik azalıyor: Ayarlar → &quot;Şimdi tara&quot; ile Google Maps&apos;ten yenileri eklenir.</p>}
      {unplanned > 0 && pool > 0 && (
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await planWeekAction();
              if (r.message) showToast(r.message);
            })
          }
          className="min-h-12 rounded-md bg-ink px-4 text-[16px] font-semibold text-white disabled:opacity-50"
        >
          {pending ? "Planlanıyor" : `Cumartesiye kadar planla (günde ${target} klinik)`}
        </button>
      )}
    </Panel>
  );
}

/** Bu hafta ne yaptık: kısa sayılar ve 30 günlük hedef; ayrıntı Rapor'da. */
function WeekSummary({ week: w, goal }: { week: ActivityReport; goal: GoalProgress }) {
  const items: [string, number][] = [
    ["arama", w.calls],
    ["ulaşılan", w.reached],
    ["randevu", w.appointmentsBooked],
    ["ziyaret", w.visits],
    ["demo", w.demos],
    ["müşteri", w.newCustomers],
  ];
  return (
    <Link href="/rapor" className="block rounded-lg border border-line bg-surface px-4 py-3 hover:bg-paper">
      <p className="flex items-baseline justify-between gap-3 text-sm text-muted">
        <span className="font-medium">Bu hafta</span>
        <span>
          Hedef <strong className="font-semibold text-ink">{goal.customers}/{goal.target}</strong> müşteri · {goal.daysLeft} gün kaldı ›
        </span>
      </p>
      <p className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[15px]">
        {items.map(([label, n]) => (
          <span key={label}>
            <strong className="font-semibold tabular-nums">{n}</strong> {label}
          </span>
        ))}
      </p>
    </Link>
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
