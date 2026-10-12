"use client";

import Link from "next/link";
import { useActionState, useCallback, useState } from "react";
import { recordCallAction, type ActionState } from "@/lib/actions";
import { formatPhone, telHref } from "@/lib/domain/contact-info";
import { CALL_STATUS_LABELS, CATEGORY_LABELS } from "@/lib/domain/labels";
import { MAX_FAILED_STREAK } from "@/lib/domain/rules";
import type { Activity, Business, CallTask } from "@/lib/domain/types";
import { AppointmentQuickForm, CallOutcomeForm } from "./call-outcome-form";
import { FormMessage } from "./ui";

export type CallRowData = {
  task: CallTask;
  business: Business;
  lastCall?: Activity;
  /** Önceden hesaplanmış görüntü metinleri (sunucuda, Türkiye saatiyle). */
  dueLabel?: string;
  lastCallLabel?: string;
};

export function CallRow({ row, today, tone }: { row: CallRowData; today: string; tone?: "late" }) {
  const { business: b } = row;
  const [open, setOpen] = useState<false | "sonuc" | "randevu">(false);
  const close = useCallback(() => setOpen(false), []);
  const [quick, quickAction, quickPending] = useActionState<ActionState, FormData>(recordCallAction, { ok: false });
  const tel = telHref(b.phone);

  return (
    <li className="border-b border-line last:border-b-0">
      <div className="flex flex-col gap-3 px-4 py-3.5 xl:flex-row xl:items-center">
        <div className="min-w-0 flex-1">
          <Link href={`/isletme?id=${b.id}`} className="block truncate text-[16px] font-medium hover:underline">
            {b.name}
          </Link>
          <p className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-sm text-muted">
            <span>{b.categories.map((c) => CATEGORY_LABELS[c]).join(", ")}</span>
            {b.district && <span>{b.district}</span>}
            {row.dueLabel && <span className={tone === "late" ? "font-medium text-late" : "font-medium text-meet"}>{row.dueLabel}</span>}
            {row.lastCallLabel && <span>{row.lastCallLabel}</span>}
            {b.failedStreak > 0 && (
              <span className="text-late">
                {b.failedStreak}/{MAX_FAILED_STREAK} ulaşılamadı
              </span>
            )}
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap sm:items-center xl:shrink-0 xl:flex-nowrap">
          {tel ? (
            <a
              href={tel}
              className="col-span-3 inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-md bg-call px-3.5 text-[15px] font-semibold tabular-nums text-white hover:bg-call/90"
            >
              <PhoneIcon />
              {formatPhone(b.phone)}
            </a>
          ) : (
            <span className="col-span-3 text-sm text-stop">Telefon yok</span>
          )}
          <form action={quickAction} className="contents">
            <input type="hidden" name="businessId" value={b.id} />
            <input type="hidden" name="result" value="ulasilamadi" />
            <button
              type="submit"
              disabled={quickPending}
              className="min-h-11 w-full rounded-md leading-tight sm:whitespace-nowrap border border-line px-2 text-[15px] hover:bg-late-soft hover:text-late disabled:opacity-50 sm:w-auto sm:px-3"
              title="Ulaşılamadı olarak kaydet; yarın tekrar listeye gelir"
            >
              {CALL_STATUS_LABELS.ulasilamadi}
            </button>
          </form>
          <button
            type="button"
            onClick={() => setOpen((v) => (v === "randevu" ? false : "randevu"))}
            aria-expanded={open === "randevu"}
            className="min-h-11 rounded-md border border-meet/40 leading-tight sm:whitespace-nowrap px-2 text-[15px] font-medium text-meet hover:bg-meet-soft aria-expanded:bg-meet-soft sm:px-3"
          >
            Randevu aldım
          </button>
          <button
            type="button"
            onClick={() => setOpen((v) => (v === "sonuc" ? false : "sonuc"))}
            aria-expanded={open === "sonuc"}
            className="min-h-11 rounded-md border border-line px-2 text-[15px] font-medium leading-tight sm:whitespace-nowrap hover:bg-paper aria-expanded:bg-paper sm:px-3"
          >
            Sonuç gir
          </button>
        </div>
      </div>
      {!quick.ok && quick.message && (
        <div className="px-4 pb-3">
          <FormMessage state={quick} />
        </div>
      )}
      {open && (
        <div className="border-t border-dashed border-line bg-paper/60 px-4 py-4">
          {open === "randevu" ? (
            <AppointmentQuickForm businessId={b.id} currentStage={b.salesStage} today={today} onDone={close} />
          ) : (
            <CallOutcomeForm businessId={b.id} currentStage={b.salesStage} today={today} onDone={close} autoFocus />
          )}
        </div>
      )}
    </li>
  );
}

function PhoneIcon() {
  return (
    <svg aria-hidden width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z" />
    </svg>
  );
}
