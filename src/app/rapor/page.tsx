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
  conversionRates,
  dailyBreakdown,
  goalProgress,
  periodRange,
  reportText,
  SALES_GOAL,
  type ActivityReport,
  type PeriodKind,
} from "@/lib/domain/report";
import { addDays, formatTime, istanbulToUtc, toDateStr } from "@/lib/domain/time";
import { VISIT_RESULTS, type Business } from "@/lib/domain/types";

// Huni yalnızca klinikleri sayar (ileride eklenecek ajanslar ayrı tutulur).
const isClinic = (b: Business) => b.categories.length > 0;

const KINDS: { id: PeriodKind; label: string }[] = [
  { id: "gun", label: "Bugün" },
  { id: "hafta", label: "Bu hafta" },
  { id: "ay", label: "Bu ay" },
  { id: "hedef", label: "30 gün" },
];

/** Rapor: günlük, haftalık, aylık ne yaptık; önceki dönemle kıyas, dönüşüm oranları ve gün gün tablo. */
export default function ReportPage() {
  const repo = getRepository();
  const today = toDateStr(new Date());
  const earliest = [periodRange("ay", today).prevFrom, periodRange("hafta", today).prevFrom, SALES_GOAL.from].sort()[0];
  const { data, error } = useData(() =>
    Promise.all([repo.listActivitiesSince(istanbulToUtc(earliest, "00:00").toISOString()), repo.listBusinesses({}), repo.listAppointments()]),
  );
  const [kind, setKind] = useState<PeriodKind>("gun");
  if (!data) return <LoadState error={error} />;
  const [activities, businesses, appointments] = data;

  const p = periodRange(kind, today);
  const report = buildActivityReport(activities, p.from, p.to);
  const prev = buildActivityReport(activities, p.prevFrom, p.prevTo);
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
          <Link href="/" className="text-[15px] font-medium text-meet hover:underline">
            Bugün
          </Link>
        }
      >
        Rapor
      </PageTitle>

      <Goal goal={goal} />

      <div role="tablist" aria-label="Dönem" className="mb-4 grid grid-cols-4 gap-1 rounded-lg border border-line bg-surface p-1">
        {KINDS.map((k) => (
          <button
            key={k.id}
            type="button"
            role="tab"
            aria-selected={kind === k.id}
            onClick={() => setKind(k.id)}
            className="min-h-11 rounded-md text-[15px] text-muted aria-selected:bg-ink aria-selected:font-medium aria-selected:text-white"
          >
            {k.label}
          </button>
        ))}
      </div>

      <Numbers report={report} prev={prev} vs={p.vs} />
      <Rates report={report} />

      {kind !== "gun" && <Daily rows={dailyBreakdown(activities, p.from, p.to)} />}

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
          <p className="mt-1 text-[15px] text-muted">Yarın için randevu ya da planlı arama yok.</p>
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
            {tomorrowCalls.length > 0 && <li className="text-muted">{tomorrowCalls.length} arama planlı (Bugün ekranında çıkar).</li>}
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

function Delta({ now, before, vs }: { now: number; before: number; vs: string }) {
  const d = now - before;
  if (d === 0) return <span className="text-sm text-muted">Değişmedi ({vs})</span>;
  return (
    <span className={`text-sm font-medium ${d > 0 ? "text-call" : "text-late"}`}>
      {d > 0 ? "▲" : "▼"} {Math.abs(d)} <span className="font-normal text-muted">{vs}</span>
    </span>
  );
}

function Numbers({ report: r, prev, vs }: { report: ActivityReport; prev: ActivityReport; vs: string }) {
  const items: { label: string; value: number; before: number; sub?: string; wide?: boolean }[] = [
    { label: "Arama", value: r.calls, before: prev.calls, sub: `${r.reached} ulaşıldı · ${r.unreachable} açmadı`, wide: true },
    { label: "Randevu alındı", value: r.appointmentsBooked, before: prev.appointmentsBooked },
    { label: "Ziyaret", value: r.visits, before: prev.visits },
    { label: "Demo", value: r.demos, before: prev.demos },
    { label: "Mesaj gönderildi", value: r.messages, before: prev.messages },
    { label: "Tanıştırma", value: r.referrals, before: prev.referrals },
    { label: "Teklif verildi", value: r.offers, before: prev.offers },
    { label: "Yeni müşteri", value: r.newCustomers, before: prev.newCustomers, wide: true },
  ];
  return (
    <>
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {items.map((it) => (
          <div key={it.label} className={`rounded-lg border border-line bg-surface px-3 py-3 ${it.wide ? "col-span-2" : ""}`}>
            <dt className="text-sm text-muted">{it.label}</dt>
            <dd className="text-2xl font-semibold tabular-nums">{it.value}</dd>
            {it.sub && <dd className="text-sm text-muted">{it.sub}</dd>}
            <dd>
              <Delta now={it.value} before={it.before} vs={vs} />
            </dd>
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

function Rates({ report }: { report: ActivityReport }) {
  return (
    <Panel className="mt-4 p-4">
      <h2 className="text-[17px] font-semibold">Dönüşüm</h2>
      <p className="text-sm text-muted">Hangi adımda kaybettiğini gösterir; en düşük oran üzerinde çalış.</p>
      <ul className="mt-3 grid gap-2.5">
        {conversionRates(report).map((c) => (
          <li key={c.label}>
            <p className="flex items-baseline justify-between text-[15px]">
              <span>{c.label}</span>
              <span className="tabular-nums">
                <strong className="font-semibold">{c.value === undefined ? "–" : `%${c.value}`}</strong>{" "}
                <span className="text-sm text-muted">({c.detail})</span>
              </span>
            </p>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-paper" aria-hidden>
              <div className="h-full rounded-full bg-meet" style={{ width: `${Math.min(100, c.value ?? 0)}%` }} />
            </div>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function Daily({ rows }: { rows: ReturnType<typeof dailyBreakdown> }) {
  const max = Math.max(1, ...rows.map((r) => r.calls));
  return (
    <Panel className="mt-4 overflow-hidden">
      <h2 className="border-b border-line px-4 py-3 text-[17px] font-semibold">Gün gün</h2>
      <table className="w-full text-[14px]">
        <thead>
          <tr className="text-left text-[12px] text-muted">
            <th className="px-4 py-2 font-medium">Gün</th>
            <th className="px-1 py-2 font-medium">Arama</th>
            <th className="px-1 py-2 text-right font-medium">Ulaş.</th>
            <th className="px-1 py-2 text-right font-medium">Rnd.</th>
            <th className="px-4 py-2 text-right font-medium">Ziy.</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.date} className="border-t border-line">
              <td className="whitespace-nowrap px-4 py-2">
                {new Date(`${r.date}T12:00:00+03:00`).toLocaleDateString("tr-TR", { timeZone: "Europe/Istanbul", day: "numeric", month: "short", weekday: "short" })}
              </td>
              <td className="w-full px-1 py-2">
                <span className="flex items-center gap-2">
                  <span className="h-2 rounded-full bg-call" style={{ width: `${(r.calls / max) * 100}%`, minWidth: r.calls ? 4 : 0 }} aria-hidden />
                  <span className="tabular-nums">{r.calls}</span>
                </span>
              </td>
              <td className="px-1 py-2 text-right tabular-nums">{r.reached}</td>
              <td className="px-1 py-2 text-right tabular-nums">{r.appointments}</td>
              <td className="px-4 py-2 text-right tabular-nums">
                {r.visits}
                {r.demos > 0 && <span className="text-muted"> ({r.demos} demo)</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  );
}
