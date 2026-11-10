"use client";

import Link from "next/link";
import { useState } from "react";
import { Funnel } from "@/components/funnel";
import { CopyMessageButton } from "@/components/share-material";
import { LoadState, PageTitle, Panel } from "@/components/ui";
import { useData } from "@/lib/client/refresh";
import { getRepository } from "@/lib/data";
import { VISIT_RESULT_LABELS } from "@/lib/domain/labels";
import {
  buildActivityReport,
  goalProgress,
  reportText,
  SALES_GOAL,
  weekStart,
  type ActivityReport,
} from "@/lib/domain/report";
import { addDays, formatTime, istanbulToUtc, toDateStr } from "@/lib/domain/time";
import { VISIT_RESULTS, type Business } from "@/lib/domain/types";

// Huni yalnızca klinikleri sayar (ileride eklenecek ajanslar ayrı tutulur).
const isClinic = (b: Business) => b.categories.length > 0;

type Period = "bugun" | "hafta" | "hedef";

export default function ReportPage() {
  const repo = getRepository();
  const today = toDateStr(new Date());
  const earliest = [SALES_GOAL.from, weekStart(today)].sort()[0];
  const { data, error } = useData(() =>
    Promise.all([
      repo.listActivitiesSince(istanbulToUtc(earliest, "00:00").toISOString()),
      repo.listBusinesses({}),
      repo.listAppointments(),
    ]),
  );
  const [period, setPeriod] = useState<Period>("bugun");
  if (!data) return <LoadState error={error} />;
  const [activities, businesses, appointments] = data;

  const periods: Record<Period, { label: string; title: string; from: string; to: string }> = {
    bugun: { label: "Bugün", title: "bugün", from: today, to: today },
    hafta: { label: "Bu hafta", title: "bu hafta", from: weekStart(today), to: today },
    hedef: { label: "30 gün", title: "ilk 30 gün", from: SALES_GOAL.from, to: today < SALES_GOAL.to ? today : SALES_GOAL.to },
  };
  const p = periods[period];
  const report = buildActivityReport(activities, p.from, p.to);
  const goal = goalProgress(businesses, today);
  const tomorrow = addDays(today, 1);
  const tomorrowAppointments = appointments
    .filter((v) => v.appointment.status === "planlandi" && toDateStr(new Date(v.appointment.startsAt)) === tomorrow)
    .sort((a, b) => a.appointment.startsAt.localeCompare(b.appointment.startsAt));
  const tomorrowCalls = businesses.filter((b) => b.nextActionDate === tomorrow);

  return (
    <div>
      <PageTitle
        aside={
          <Link href="/saha" className="text-[15px] font-medium text-meet hover:underline">
            Saha
          </Link>
        }
      >
        Gün sonu
      </PageTitle>

      <Goal goal={goal} />

      <div role="tablist" aria-label="Dönem" className="mb-4 grid grid-cols-3 gap-1 rounded-lg border border-line bg-surface p-1">
        {(Object.keys(periods) as Period[]).map((k) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={period === k}
            onClick={() => setPeriod(k)}
            className="min-h-11 rounded-md text-[15px] text-muted aria-selected:bg-ink aria-selected:font-medium aria-selected:text-white"
          >
            {periods[k].label}
          </button>
        ))}
      </div>

      <Numbers report={report} />

      <div className="mt-4">
        <CopyMessageButton
          text={reportText(p.title, report, goal)}
          label="Özeti kopyala"
          className="inline-flex min-h-12 w-full items-center justify-center rounded-md border border-line bg-surface px-4 text-[16px] font-medium hover:bg-paper"
        />
        <p className="mt-1.5 text-sm text-muted">Özeti kopyalayıp WhatsApp&apos;ta ekibe ya da kendine gönderebilirsin.</p>
      </div>

      <div className="mt-6">
        <Funnel businesses={businesses.filter(isClinic)} />
      </div>

      <Panel className="p-4">
        <h2 className="text-[17px] font-semibold">Yarın</h2>
        {tomorrowAppointments.length === 0 && tomorrowCalls.length === 0 ? (
          <p className="mt-1 text-[15px] text-muted">Yarın için randevu ya da planlı arama yok. Saha&apos;dan arayıp randevu al.</p>
        ) : (
          <ul className="mt-2 grid gap-2 text-[15px]">
            {tomorrowAppointments.map(({ appointment: a, business: b }) => (
              <li key={a.id} className="flex gap-3">
                <span className="w-12 shrink-0 font-semibold tabular-nums text-meet">{formatTime(a.startsAt)}</span>
                <Link href={`/isletme?id=${b.id}`} className="hover:underline">
                  {b.name}
                </Link>
              </li>
            ))}
            {tomorrowCalls.length > 0 && (
              <li className="text-muted">{tomorrowCalls.length} takip araması planlı (Bugün ekranında çıkar).</li>
            )}
          </ul>
        )}
      </Panel>
    </div>
  );
}

function Goal({ goal }: { goal: ReturnType<typeof goalProgress> }) {
  const pct = Math.min(100, Math.round((goal.customers / goal.target) * 100));
  return (
    <Panel className="mb-5 p-4">
      <p className="flex items-baseline justify-between gap-3">
        <span className="text-[15px] font-medium">{SALES_GOAL.label}</span>
        <span className="text-sm text-muted">{goal.started ? `${goal.daysLeft} gün kaldı` : "12 Kasım'da başlıyor"}</span>
      </p>
      <p className="mt-1 text-3xl font-semibold tabular-nums">
        {goal.customers}
        <span className="text-xl text-muted">/{goal.target}</span>
      </p>
      <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-paper" role="progressbar" aria-valuenow={goal.customers} aria-valuemin={0} aria-valuemax={goal.target}>
        <div className="h-full rounded-full bg-call" style={{ width: `${pct}%` }} />
      </div>
    </Panel>
  );
}

function Numbers({ report: r }: { report: ActivityReport }) {
  const items: [string, number, string?][] = [
    ["Arama", r.calls, `${r.reached} ulaşıldı · ${r.unreachable} ulaşılamadı`],
    ["Randevu alındı", r.appointmentsBooked],
    ["Ziyaret", r.visits],
    ["Demo", r.demos],
    ["Tanıştırma", r.referrals],
    ["Teklif", r.offers],
    ["Yeni müşteri", r.newCustomers],
  ];
  return (
    <>
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {items.map(([label, value, sub]) => (
          <div key={label} className={`rounded-lg border border-line bg-surface px-3 py-3 ${sub ? "col-span-2" : ""}`}>
            <dt className="text-sm text-muted">{label}</dt>
            <dd className="text-2xl font-semibold tabular-nums">{value}</dd>
            {sub && <dd className="text-sm text-muted">{sub}</dd>}
          </div>
        ))}
      </dl>
      {r.visits > 0 && (
        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
          {VISIT_RESULTS.filter((v) => r.visitsBy[v]).map((v) => (
            <li key={v}>
              {VISIT_RESULT_LABELS[v]}: <span className="font-medium text-ink">{r.visitsBy[v]}</span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
