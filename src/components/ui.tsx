import type { ComponentProps, ReactNode } from "react";
import { CALL_STATUS_LABELS, SALES_STAGE_LABELS } from "@/lib/domain/labels";
import type { CallStatus, SalesStage } from "@/lib/domain/types";

type Tone = "neutral" | "call" | "late" | "stop" | "meet" | "quiet";

const TONES: Record<Tone, string> = {
  neutral: "bg-paper text-ink",
  call: "bg-call-soft text-call",
  late: "bg-late-soft text-late",
  stop: "bg-stop-soft text-stop",
  meet: "bg-meet-soft text-meet",
  quiet: "bg-paper text-muted",
};

export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[13px] font-medium ${TONES[tone]}`}>
      {children}
    </span>
  );
}

const CALL_TONES: Record<CallStatus, Tone> = {
  aranacak: "neutral",
  ulasilamadi: "late",
  tekrar_aranacak: "meet",
  gorusuldu: "call",
  ilgilenmiyor: "stop",
  beklemede: "quiet",
  iletisim_kurma: "stop",
};

const STAGE_TONES: Record<SalesStage, Tone> = {
  yeni_aday: "quiet",
  iletisim_kuruldu: "neutral",
  randevu_alindi: "meet",
  gorusme_yapildi: "meet",
  teklif_gonderildi: "late",
  musteri_oldu: "call",
  olumsuz: "stop",
};

export function CallStatusBadge({ status }: { status: CallStatus }) {
  return <Badge tone={CALL_TONES[status]}>{CALL_STATUS_LABELS[status]}</Badge>;
}

export function StageBadge({ stage }: { stage: SalesStage }) {
  return <Badge tone={STAGE_TONES[stage]}>{SALES_STAGE_LABELS[stage]}</Badge>;
}

export function PageTitle({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <h1 className="text-2xl font-semibold tracking-tight">{children}</h1>
      {aside}
    </div>
  );
}

export function Panel({ className = "", ...props }: ComponentProps<"section">) {
  return <section className={`rounded-lg border border-line bg-surface ${className}`} {...props} />;
}

export function FieldLabel({ children, htmlFor }: { children: ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1 block text-sm font-medium text-muted">
      {children}
    </label>
  );
}

export const inputClass =
  "w-full rounded-md border border-line bg-surface px-3 py-2 text-[15px] text-ink placeholder:text-muted/70 focus:border-meet focus:outline-none";

export const buttonClass = {
  primary:
    "inline-flex items-center justify-center rounded-md bg-ink px-4 py-2 text-[15px] font-medium text-white hover:bg-ink/90 disabled:opacity-50",
  secondary:
    "inline-flex items-center justify-center rounded-md border border-line bg-surface px-4 py-2 text-[15px] font-medium text-ink hover:bg-paper disabled:opacity-50",
  danger:
    "inline-flex items-center justify-center rounded-md border border-stop/30 bg-surface px-4 py-2 text-[15px] font-medium text-stop hover:bg-stop-soft disabled:opacity-50",
};

export function FormMessage({ state }: { state: { ok: boolean; message?: string } }) {
  if (!state.message) return null;
  return (
    <p role="status" className={`text-sm ${state.ok ? "text-call" : "text-stop"}`}>
      {state.message}
    </p>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="px-4 py-6 text-[15px] text-muted">{children}</p>;
}

export function LoadState({ error }: { error?: string }) {
  if (error) return <p className="rounded-md bg-stop-soft px-3 py-2 text-[15px] text-stop">{error}</p>;
  return <p className="text-[15px] text-muted">Yükleniyor</p>;
}
