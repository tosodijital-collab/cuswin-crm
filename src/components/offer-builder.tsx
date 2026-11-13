"use client";

// Demo sonrası kliniğe özel teklif: fiyatı yaz, link hazır mesajla WhatsApp'tan gider.

import { useId, useState } from "react";
import { setStageAction } from "@/lib/actions";
import { encodeOffer, formatTl, OFFER_TYPES, PACKAGES, type Offer } from "@/lib/domain/offer";
import { parseInsights } from "@/lib/domain/sales-playbook";
import type { Business, SalesStage } from "@/lib/domain/types";
import { WhatsappTo } from "./send-whatsapp";
import { closeSheet, openSheet } from "./sheet";
import { showToast } from "./toast";
import { FieldLabel, inputClass } from "./ui";

const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const BEFORE_OFFER: SalesStage[] = ["yeni_aday", "iletisim_kuruldu", "randevu_alindi", "gorusme_yapildi"];

function offerUrl(o: Offer): string {
  return `${window.location.origin}${base}/teklif/?t=${encodeOffer(o)}`;
}

const num = (s: string) => {
  const n = Number(s.replace(/[^\d]/g, ""));
  return Number.isFinite(n) ? n : 0;
};

function OfferForm({ business: b, today, notes }: { business: Business; today: string; notes: (string | undefined)[] }) {
  const uid = useId();
  const insight = notes.map(parseInsights).find((p) => p.labels.length);
  const [f, setF] = useState({
    y: b.contacts.find((c) => c.name !== "WhatsApp")?.name ?? "",
    p: "Growth" as Offer["p"],
    t: "sesli" as Offer["t"],
    k: "",
    a: "",
    e: "",
    v: false,
    n: insight ? insight.labels.map((l) => `• ${l}`).join("\n") : "",
    g: "14",
  });
  const [ready, setReady] = useState<string>();
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => {
    setF((x) => ({ ...x, [k]: v }));
    setReady(undefined);
  };
  const offer: Offer = {
    c: b.name,
    y: f.y.trim() || undefined,
    p: f.p,
    t: f.t,
    k: num(f.k),
    a: num(f.a),
    e: num(f.e) || undefined,
    v: f.v,
    n: f.n.trim() || undefined,
    d: today,
    g: Math.min(90, Math.max(1, num(f.g) || 14)),
  };
  const valid = offer.a > 0;

  if (ready) {
    const message = `Merhaba, Cuswin'den Özkan. Konuştuğumuz teklifi sizin için hazırladım:\n${ready}\n\nKurulum 3 gün sürüyor, siz onay vermeden hiçbir şey açılmıyor. Hangi gün başlayalım?`;
    return (
      <div className="grid gap-3">
        <a href={ready} target="_blank" rel="noopener noreferrer" className="text-[15px] font-medium text-meet underline">
          Teklifi önizle (kliniğin göreceği sayfa)
        </a>
        <WhatsappTo
          business={b}
          message={message}
          label="Teklifi WhatsApp'tan gönder"
          onSent={() => {
            if (BEFORE_OFFER.includes(b.salesStage)) {
              const fd = new FormData();
              fd.set("businessId", b.id);
              fd.set("stage", "teklif_gonderildi");
              fd.set("note", `Teklif gönderildi: ${offer.p}, aylık ${formatTl(offer.a)}, kurulum ${formatTl(offer.k)}.`);
              void setStageAction({ ok: false }, fd);
            }
            showToast("Teklif gönderildi olarak işaretlendi.");
            closeSheet();
          }}
        />
        <button type="button" onClick={() => setReady(undefined)} className="min-h-11 text-[15px] text-muted">
          ‹ Teklifi düzenle
        </button>
      </div>
    );
  }

  return (
    <form
      className="grid gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) setReady(offerUrl(offer));
      }}
    >
      <div className="grid grid-cols-2 gap-2">
        <div>
          <FieldLabel htmlFor={`${uid}-p`}>Paket</FieldLabel>
          <select id={`${uid}-p`} value={f.p} onChange={(e) => set("p", e.target.value as Offer["p"])} className={inputClass}>
            {PACKAGES.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </div>
        <div>
          <FieldLabel htmlFor={`${uid}-t`}>Kapsam</FieldLabel>
          <select id={`${uid}-t`} value={f.t} onChange={(e) => set("t", e.target.value as Offer["t"])} className={inputClass}>
            {Object.entries(OFFER_TYPES).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
        <Money id={`${uid}-a`} label="Aylık ücret (₺)" value={f.a} onChange={(v) => set("a", v)} required />
        <Money id={`${uid}-k`} label="Kurulum (₺)" value={f.k} onChange={(v) => set("k", v)} />
        <Money id={`${uid}-e`} label="Ek kanal (₺, varsa)" value={f.e} onChange={(v) => set("e", v)} />
        <div>
          <FieldLabel htmlFor={`${uid}-g`}>Geçerlilik (gün)</FieldLabel>
          <input id={`${uid}-g`} inputMode="numeric" value={f.g} onChange={(e) => set("g", e.target.value)} className={inputClass} />
        </div>
      </div>
      <label className="flex min-h-11 items-center gap-2 text-[15px]">
        <input type="checkbox" checked={f.v} onChange={(e) => set("v", e.target.checked)} className="size-5 accent-ink" />
        Fiyatlara KDV dahil
      </label>
      <div>
        <FieldLabel htmlFor={`${uid}-y`}>Yetkili (isteğe bağlı)</FieldLabel>
        <input id={`${uid}-y`} value={f.y} maxLength={120} onChange={(e) => set("y", e.target.value)} className={inputClass} />
      </div>
      <div>
        <FieldLabel htmlFor={`${uid}-n`}>Görüşmeden notlar (teklifte görünür)</FieldLabel>
        <textarea id={`${uid}-n`} rows={3} maxLength={700} value={f.n} onChange={(e) => set("n", e.target.value)} className={inputClass} />
      </div>
      {valid && (
        <p className="text-[15px]">
          İlk ay toplam: <strong className="font-semibold">{formatTl(offer.k + offer.a + (offer.e ?? 0))}</strong>
        </p>
      )}
      <button type="submit" disabled={!valid} className="min-h-14 rounded-md bg-ink px-4 text-[17px] font-semibold text-white disabled:opacity-40">
        Teklifi hazırla
      </button>
    </form>
  );
}

function Money({ id, label, value, onChange, required }: { id: string; label: string; value: string; onChange: (v: string) => void; required?: boolean }) {
  return (
    <div>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <input
        id={id}
        inputMode="numeric"
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^\d.]/g, ""))}
        placeholder="0"
        className={`${inputClass} tabular-nums`}
      />
    </div>
  );
}

export function openOfferSheet(b: Business, today: string, notes: (string | undefined)[] = []) {
  openSheet(`Teklif: ${b.name}`, <OfferForm business={b} today={today} notes={notes} />);
}

export function OfferButton({
  business,
  today,
  notes,
  className,
}: {
  business: Business;
  today: string;
  notes?: (string | undefined)[];
  className: string;
}) {
  return (
    <button type="button" onClick={() => openOfferSheet(business, today, notes)} className={className}>
      Teklif hazırla
    </button>
  );
}
