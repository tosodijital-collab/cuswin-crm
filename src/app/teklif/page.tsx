"use client";

// Kliniğe giden teklif sayfası. Giriş gerektirmez; veri linkin içindedir (lib/domain/offer.ts).

import { useSyncExternalStore } from "react";
import {
  decodeOffer,
  formatTl,
  OFFER_GUARANTEES,
  OFFER_INCLUDES,
  OFFER_NEEDS,
  OFFER_STEPS,
  OFFER_TYPES,
  offerNumber,
  type Offer,
} from "@/lib/domain/offer";
import { addDays, formatLongDate } from "@/lib/domain/time";

const noSubscribe = () => () => {};

export default function OfferPage() {
  // Statik derlemede adres yok; tarayıcıda linkteki "t" okunur.
  const token = useSyncExternalStore(
    noSubscribe,
    () => new URLSearchParams(window.location.search).get("t"),
    () => null,
  );
  const offer = decodeOffer(token);
  if (token === null) return null;
  if (!offer) {
    return <p className="py-16 text-center text-[17px] text-muted">Teklif bağlantısı geçersiz. Lütfen gönderen kişiden yeni bir bağlantı isteyin.</p>;
  }
  return <OfferView o={offer} />;
}

function OfferView({ o }: { o: Offer }) {
  const extra = o.e ?? 0;
  const first = o.k + o.a + extra;
  return (
    <article className="mx-auto max-w-3xl text-[15px] leading-relaxed print:text-[12px]">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b-2 border-meet pb-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-meet">CUSWIN</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Teklif</h1>
          <p className="text-muted">Hasta kazanım ve takip sistemi</p>
        </div>
        <dl className="text-right text-sm leading-7">
          <div>
            <dt className="inline text-muted">Teklif no: </dt>
            <dd className="inline tabular-nums">{offerNumber(o)}</dd>
          </div>
          <div>
            <dt className="inline text-muted">Tarih: </dt>
            <dd className="inline">{formatLongDate(o.d)}</dd>
          </div>
          <div>
            <dt className="inline text-muted">Geçerlilik: </dt>
            <dd className="inline">{formatLongDate(addDays(o.d, o.g))} tarihine kadar</dd>
          </div>
        </dl>
      </header>

      <p className="mt-5">
        Kliniğinizi dinledikten sonra bu teklifi sizin için hazırladık. Amacımız basit: siz hastanızla ilgilenirken hiçbir hastanın
        cevapsız kalmaması, bir kez gelen hastanın da unutulmaması.
      </p>

      <Box title="Klinik">
        <p className="text-[17px] font-semibold">{o.c}</p>
        {o.y && <p className="text-muted">Yetkili: {o.y}</p>}
      </Box>

      {o.n && (
        <Box title="Görüşmemizden notlar">
          <p className="whitespace-pre-line">{o.n}</p>
        </Box>
      )}

      <Box title="Önerilen paket">
        <p className="text-[17px] font-semibold">
          {o.p} · {OFFER_TYPES[o.t]}
        </p>
        <p className="mt-2 text-muted">Pakette: {OFFER_INCLUDES}</p>
      </Box>

      <Box title="Ücret">
        <table className="w-full border-collapse">
          <tbody>
            <Row label="Kurulum (klinik analizi, kanal bağlantısı, onay görüşmesi)" value={formatTl(o.k)} />
            <Row label="Aylık kullanım" value={formatTl(o.a)} />
            {extra > 0 && <Row label="Ek kanal / ek hat" value={formatTl(extra)} />}
            <Row label="Toplam ilk ay" value={formatTl(first)} strong />
          </tbody>
        </table>
        <p className="mt-2 text-sm text-muted">Fiyatlara KDV {o.v ? "dahildir" : "hariçtir"}.</p>
      </Box>

      <Box title="Takvim">
        <ol className="list-decimal pl-5">
          {OFFER_STEPS.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
        <p className="mt-2 text-sm text-muted">Kurulum, gerekli bilgiler ve yetkiler alındıktan sonra 3 gün içinde tamamlanır.</p>
      </Box>

      <Box title="Güvenceleriniz">
        <ul className="list-disc pl-5">
          {OFFER_GUARANTEES.map((g) => (
            <li key={g}>{g}</li>
          ))}
        </ul>
      </Box>

      <Box title="Sizden istediklerimiz">
        <ul className="grid gap-x-6 sm:grid-cols-2">
          {OFFER_NEEDS.map((n) => (
            <li key={n}>· {n}</li>
          ))}
        </ul>
      </Box>

      <footer className="mt-8 grid gap-1 border-t border-line pt-4 text-sm text-muted">
        <p>Cuswin adına · Özkan Toso, Kurucu · 0537 839 54 20</p>
        <p>cuswin.com · info@cuswin.com</p>
      </footer>

      <button
        type="button"
        onClick={() => window.print()}
        className="mt-6 min-h-12 w-full rounded-md border border-line bg-surface px-4 text-[15px] font-medium print:hidden"
      >
        PDF olarak kaydet / yazdır
      </button>
    </article>
  );
}

function Box({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-4 rounded-lg border border-line bg-surface px-4 py-3 print:break-inside-avoid">
      <h2 className="mb-1.5 text-sm font-semibold uppercase tracking-wide text-meet">{title}</h2>
      {children}
    </section>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <tr className={`border-b border-line last:border-b-0 ${strong ? "font-semibold" : ""}`}>
      <td className="py-2 pr-3">{label}</td>
      <td className="py-2 text-right tabular-nums">{value}</td>
    </tr>
  );
}
