"use client";

// Kliniğe PDF linki ve hazır mesaj: ekrandaki numarayla doğrudan WhatsApp sohbeti açılır.
// Telefonun paylaşım penceresi yalnızca rehberdeki kişileri gösterdiği için kullanılmaz; numara kaydetmek gerekmez.

import { startTransition, useActionState, useEffect, useId, useState } from "react";
import { recordCallAction, saveWhatsappAction, type ActionState } from "@/lib/actions";
import { formatPhone, normalizePhone, whatsappChatHref, whatsappNumberOf } from "@/lib/domain/contact-info";
import { getMaterial, type MaterialId } from "@/lib/domain/materials";
import { pitchDate } from "@/lib/domain/call-script";
import { addDays } from "@/lib/domain/time";
import type { Business } from "@/lib/domain/types";
import { useMaterialMessage } from "./share-material";
import { useInsightLine } from "./insights";
import { showToast } from "./toast";
import { FieldLabel, FormMessage, inputClass } from "./ui";

const CHOICES: { id: MaterialId; label: string }[] = [
  { id: "tanitim", label: "Tanıtım" },
  { id: "brosur", label: "Broşür" },
  { id: "teklif", label: "Teklif" },
];

export function SendWhatsapp({
  business: b,
  today,
  initial = "tanitim",
  record,
  onDone,
}: {
  business: Business;
  today: string;
  initial?: MaterialId;
  /** true: arama sonucu "bilgi istedi" olarak kaydedilir ve 2 gün sonra (hafta sonu atlanır) tekrar arama planlanır. */
  record?: boolean;
  onDone?: () => void;
}) {
  const uid = useId();
  const [materialId, setMaterialId] = useState<MaterialId>(initial);
  const [number, setNumber] = useState(() => formatPhone(whatsappNumberOf(b) ?? b.phone) ?? "");
  const [state, action] = useActionState<ActionState, FormData>(record ? recordCallAction : saveWhatsappAction, { ok: false });
  const material = getMaterial(materialId);
  const message = useMaterialMessage(material);
  const insights = useInsightLine();
  useEffect(() => {
    if (!state.ok) return;
    if (record) showToast("Gönderildi. Takip araması 2 iş günü içinde listende.");
    onDone?.();
  }, [state, record, onDone]);

  const e164 = normalizePhone(number);
  const href = message ? whatsappChatHref(number, message) : undefined;
  const landline = Boolean(e164 && !e164.startsWith("+905"));

  const save = () => {
    const f = new FormData();
    f.set("businessId", b.id);
    f.set("whatsapp", number);
    if (record) {
      f.set("result", "tekrar_aranacak");
      // 2 gün sonra; hafta sonuna düşerse pazartesi.
      f.set("nextDate", pitchDate(addDays(today, 1)));
      f.set("nextTime", "11:00");
      f.set("note", `${material.title} WhatsApp'tan gönderildi (${formatPhone(number)}).`);
      if (insights) f.set("insights", insights);
    } else if (!e164 || e164 === normalizePhone(b.phone)) {
      onDone?.();
      return;
    }
    startTransition(() => action(f));
  };

  return (
    <div className="grid gap-3">
      <div role="tablist" aria-label="Hangi dosya?" className="grid grid-cols-3 gap-1 rounded-lg border border-line bg-surface p-1">
        {CHOICES.map((c) => (
          <button
            key={c.id}
            type="button"
            role="tab"
            aria-selected={materialId === c.id}
            onClick={() => setMaterialId(c.id)}
            className="min-h-11 rounded-md text-[15px] font-medium text-muted aria-selected:bg-ink aria-selected:text-white"
          >
            {c.label}
          </button>
        ))}
      </div>
      <div>
        <FieldLabel htmlFor={`${uid}-wa`}>WhatsApp numarası</FieldLabel>
        <input
          id={`${uid}-wa`}
          type="tel"
          inputMode="tel"
          autoComplete="off"
          value={number}
          onChange={(e) => setNumber(e.target.value)}
          placeholder="05xx xxx xx xx"
          className={`${inputClass} text-[17px] tabular-nums`}
        />
        <p className={`mt-1 text-sm ${landline ? "text-late" : "text-muted"}`}>
          {!number
            ? "Sekreterden cep ya da WhatsApp numarasını al, buraya yaz."
            : !e164
              ? "Numara eksik ya da hatalı."
              : landline
                ? "Sabit hat: WhatsApp'ı yoksa açılmaz. Cep numarası varsa onu yaz."
                : "Rehbere kaydetmen gerekmez; sohbet doğrudan açılır."}
        </p>
      </div>
      <details className="rounded-md border border-line bg-surface px-3 py-2">
        <summary className="cursor-pointer text-[15px] text-muted">Gidecek mesaj</summary>
        <p className="mt-2 whitespace-pre-line text-[15px]">{message}</p>
      </details>
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          onClick={save}
          className="inline-flex min-h-14 items-center justify-center gap-2 rounded-md bg-call px-4 text-[17px] font-semibold text-white hover:bg-call/90"
        >
          WhatsApp&apos;ta gönder
        </a>
      ) : (
        <button type="button" disabled className="min-h-14 rounded-md bg-call/40 px-4 text-[17px] font-semibold text-white">
          WhatsApp&apos;ta gönder
        </button>
      )}
      <p className="text-sm text-muted">PDF mesajın içinde link olarak gider; dokununca açılır. WhatsApp&apos;ta sadece &quot;Gönder&quot;e bas.</p>
      <FormMessage state={state} />
    </div>
  );
}

/** Hazır bir mesajı seçilen numaraya WhatsApp'tan açar; yeni numarayı kliniğe kaydeder. */
export function WhatsappTo({
  business: b,
  message,
  label = "WhatsApp'ta aç",
  onSent,
}: {
  business: Business;
  message: string;
  label?: string;
  onSent?: () => void;
}) {
  const uid = useId();
  const [number, setNumber] = useState(() => formatPhone(whatsappNumberOf(b) ?? b.phone) ?? "");
  const [, action] = useActionState<ActionState, FormData>(saveWhatsappAction, { ok: false });
  const e164 = normalizePhone(number);
  const href = whatsappChatHref(number, message);
  const landline = Boolean(e164 && !e164.startsWith("+905"));
  const send = () => {
    if (e164 && e164 !== normalizePhone(b.phone)) {
      const f = new FormData();
      f.set("businessId", b.id);
      f.set("whatsapp", number);
      startTransition(() => action(f));
    }
    onSent?.();
  };
  return (
    <div className="grid gap-3">
      <div>
        <FieldLabel htmlFor={`${uid}-to`}>WhatsApp numarası</FieldLabel>
        <input
          id={`${uid}-to`}
          type="tel"
          inputMode="tel"
          autoComplete="off"
          value={number}
          onChange={(e) => setNumber(e.target.value)}
          placeholder="05xx xxx xx xx"
          className={`${inputClass} text-[17px] tabular-nums`}
        />
        {landline && <p className="mt-1 text-sm text-late">Sabit hat: WhatsApp&apos;ı yoksa açılmaz. Cep numarası varsa onu yaz.</p>}
      </div>
      <p className="whitespace-pre-line rounded-md border border-line bg-surface px-3 py-2 text-[15px]">{message}</p>
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          onClick={send}
          className="inline-flex min-h-14 items-center justify-center rounded-md bg-call px-4 text-[17px] font-semibold text-white hover:bg-call/90"
        >
          {label}
        </a>
      ) : (
        <p className="text-sm text-muted">Numarayı yaz.</p>
      )}
    </div>
  );
}
