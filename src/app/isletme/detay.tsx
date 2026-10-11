"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { AppointmentControls, CalendarStatus, NewAppointmentToggle } from "@/components/appointment-forms";
import { NoteForm, StageForm, VoidActivityButton } from "@/components/business-forms";
import { CallOutcomeForm } from "@/components/call-outcome-form";
import { CallStatusBadge, EmptyState, LoadState, Panel, StageBadge } from "@/components/ui";
import { useData } from "@/lib/client/refresh";
import { getRepository } from "@/lib/data";
import { formatPhone, mapsHref, telHref, websiteHref } from "@/lib/domain/contact-info";
import {
  APPOINTMENT_STATUS_LABELS,
  CALL_STATUS_LABELS,
  CATEGORY_LABELS,
  MEETING_TYPE_LABELS,
  SALES_STAGE_LABELS,
  SOURCE_LABELS,
} from "@/lib/domain/labels";
import { MAX_FAILED_STREAK } from "@/lib/domain/rules";
import { addDays, formatDateTime, formatShortDate, relativeDay, toDateStr, toTimeStr } from "@/lib/domain/time";
import type { Activity } from "@/lib/domain/types";

export function BusinessDetailScreen({ id }: { id: string }) {
  const repo = getRepository();
  const { data, error } = useData(() => Promise.all([repo.getBusiness(id), repo.getSettings()]), id);
  if (!data) return <LoadState error={error} />;
  const [detail, settings] = data;
  if (!detail) return <LoadState error="İşletme bulunamadı." />;
  const { business: b, openTask, activities, appointments } = detail;
  const now = new Date();
  const today = toDateStr(now);
  const tel = telHref(b.phone);

  return (
    <div>
      <Link href="/kayitlar" className="text-sm text-muted hover:text-ink">
        Tüm kayıtlar
      </Link>
      <div className="mb-5 mt-1 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{b.name}</h1>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <CallStatusBadge status={b.callStatus} />
            <StageBadge stage={b.salesStage} />
          </div>
        </div>
        <Link href={`/isletme/duzenle?id=${b.id}`} className="text-[15px] font-medium text-meet hover:underline">
          Bilgileri düzenle
        </Link>
      </div>

      {b.reviewReason && (
        <p className="mb-5 rounded-md border border-late/30 bg-late-soft px-4 py-3 text-[15px] text-late">
          <strong className="font-semibold">Eksik bilgi / Kontrol gerekli:</strong> {b.reviewReason}. Bu kayıt
          düzeltilene kadar günlük listeye alınmaz.
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="grid content-start gap-6">
          <Panel className="p-4">
            <h2 className="mb-1 text-[17px] font-semibold">Arama sonucu</h2>
            <p className="mb-4 text-sm text-muted">
              {openTask
                ? `Açık görev: ${relativeDay(openTask.dueDate, today)}${openTask.dueTime ? `, ${openTask.dueTime}` : ""}.`
                : "Açık arama görevi yok."}
              {b.failedStreak > 0 && ` Ardışık ulaşılamama: ${b.failedStreak}/${MAX_FAILED_STREAK}.`}
            </p>
            <CallOutcomeForm businessId={b.id} currentStage={b.salesStage} today={today} />
          </Panel>

          <Panel className="grid gap-5 p-4">
            <StageForm businessId={b.id} stage={b.salesStage} />
            <NoteForm businessId={b.id} />
          </Panel>

          <Panel>
            <h2 className="border-b border-line px-4 py-3 text-[17px] font-semibold">Geçmiş</h2>
            {activities.length ? (
              <ol>
                {activities.map((a) => (
                  <li key={a.id} className="border-b border-line px-4 py-3 last:border-b-0">
                    <div className={a.voidedAt ? "text-muted line-through" : ""}>
                      <p className="flex flex-wrap justify-between gap-x-3 text-sm text-muted">
                        <span>{formatDateTime(a.at)}</span>
                        <span>{activityTitle(a)}</span>
                      </p>
                      {a.note && <p className="mt-1 whitespace-pre-line text-[15px]">{a.note}</p>}
                    </div>
                    {a.voidedAt ? (
                      <p className="mt-1 text-sm text-muted">Hatalı olarak işaretlendi, {formatDateTime(a.voidedAt)}.</p>
                    ) : (
                      (a.type === "arama" || a.type === "not") && (
                        <div className="mt-1">
                          <VoidActivityButton businessId={b.id} activityId={a.id} />
                        </div>
                      )
                    )}
                  </li>
                ))}
              </ol>
            ) : (
              <EmptyState>Henüz kayıt yok.</EmptyState>
            )}
          </Panel>
        </div>

        <div className="order-first grid content-start gap-6 lg:order-none">
          <Panel className="p-4">
            {tel ? (
              <a
                href={tel}
                className="mb-4 flex min-h-12 items-center justify-center rounded-md bg-call text-lg font-semibold tabular-nums text-white hover:bg-call/90"
              >
                Ara: {formatPhone(b.phone)}
              </a>
            ) : (
              <p className="mb-4 rounded-md bg-stop-soft px-3 py-2 text-sm text-stop">Kayıtlı telefon yok.</p>
            )}
            <dl className="grid gap-3 text-[15px]">
              <Info label="Kategoriler">
                {b.categories.length ? b.categories.map((c) => CATEGORY_LABELS[c]).join(", ") : "Belirsiz"}
              </Info>
              <Info label="Adres">
                {[b.address, b.district].filter(Boolean).join(", ") || "Yok"}
                <a href={mapsHref(b)} target="_blank" rel="noreferrer" className="mt-0.5 block text-meet hover:underline">
                  Google Maps&apos;te aç
                </a>
              </Info>
              {b.website && (
                <Info label="Web sitesi">
                  <a href={websiteHref(b.website)} target="_blank" rel="noreferrer" className="break-all text-meet hover:underline">
                    {b.website}
                  </a>
                </Info>
              )}
              {b.email && (
                <Info label="E-posta">
                  <a href={`mailto:${b.email}`} className="break-all text-meet hover:underline">
                    {b.email}
                  </a>
                </Info>
              )}
              {b.contacts.length > 0 && (
                <Info label="Kişiler">
                  <ul>
                    {b.contacts.map((c) => (
                      <li key={c.id}>
                        {c.name}
                        {c.role && <span className="text-muted">, {c.role}</span>}
                      </li>
                    ))}
                  </ul>
                </Info>
              )}
              <Info label="Sonraki işlem">
                {b.nextActionDate
                  ? `${relativeDay(b.nextActionDate, today)}${b.nextActionTime ? `, ${b.nextActionTime}` : ""}`
                  : "Planlanmadı"}
              </Info>
              <Info label="Kaynak">
                {SOURCE_LABELS[b.source]}
                <span className="block text-sm text-muted">
                  Bulundu {formatShortDate(toDateStr(new Date(b.foundAt)))}
                  {b.verifiedAt && `, son doğrulama ${formatShortDate(toDateStr(new Date(b.verifiedAt)))}`}
                </span>
              </Info>
            </dl>
          </Panel>

          <Panel>
            <h2 className="border-b border-line px-4 py-3 text-[17px] font-semibold">Randevular</h2>
            {appointments.map((a) => {
              const isPast = new Date(a.startsAt) < now;
              const start = new Date(a.startsAt);
              return (
                <div key={a.id} className="border-b border-line px-4 py-3">
                  <p className={`font-medium ${a.status === "iptal" ? "text-muted line-through" : ""}`}>
                    {formatDateTime(a.startsAt)}
                  </p>
                  <p className="text-sm text-muted">
                    {[a.contactName, MEETING_TYPE_LABELS[a.meetingType], APPOINTMENT_STATUS_LABELS[a.status]]
                      .filter(Boolean)
                      .join(", ")}
                  </p>
                  {a.location && <p className="break-words text-sm text-muted">{a.location}</p>}
                  {a.outcome && <p className="mt-1 text-[15px]">{a.outcome}</p>}
                  <CalendarStatus appointment={a} />
                  <AppointmentControls
                    appointment={a}
                    isPast={isPast}
                    defaults={{ date: toDateStr(start), time: toTimeStr(start) }}
                  />
                </div>
              );
            })}
            <div className="px-4 py-3">
              <NewAppointmentToggle
                businessId={b.id}
                defaults={{ date: addDays(today, 1), time: "11:00" }}
                defaultReminder={settings.reminderMinutes}
              />
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function Info({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-sm text-muted">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function activityTitle(a: Activity): string {
  switch (a.type) {
    case "arama":
      return `Arama: ${a.callResult ? CALL_STATUS_LABELS[a.callResult] : ""}`;
    case "asama":
      return `Aşama: ${a.stage ? SALES_STAGE_LABELS[a.stage] : ""}`;
    case "not":
      return "Not";
    case "randevu":
      return "Randevu";
    case "duzeltme":
      return "Düzeltme";
    case "sistem":
      return "Sistem";
  }
}
