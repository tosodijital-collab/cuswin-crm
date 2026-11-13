"use client";

// Kapıda 10 dakikalık canlı demo: doktor kendi telefonundan demo hattına yazar, cevabı görür.

import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { DEMO, demoWhatsappHref } from "@/lib/domain/sales-playbook";
import { openSheet } from "./sheet";

function Qr({ text }: { text: string }) {
  const [svg, setSvg] = useState<string>();
  useEffect(() => {
    let alive = true;
    void QRCode.toString(text, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#15202b", light: "#ffffff" } }).then(
      (s) => alive && setSvg(s),
    );
    return () => {
      alive = false;
    };
  }, [text]);
  return (
    <div
      className="mx-auto aspect-square w-full max-w-64 rounded-xl bg-white p-2 [&_svg]:h-full [&_svg]:w-full"
      role="img"
      aria-label="Demo hattına WhatsApp QR kodu"
      // QR kütüphanesinin ürettiği SVG; içinde kullanıcı girdisi yok.
      dangerouslySetInnerHTML={svg ? { __html: svg } : undefined}
    />
  );
}

function DemoBody() {
  const [example, setExample] = useState<string>(DEMO.examples[0]);
  return (
    <div className="grid gap-4">
      <p className="text-[15px] text-muted">Doktor kendi telefonunun kamerasıyla okutsun; WhatsApp mesaj hazır açılır, sadece &quot;Gönder&quot;e basar.</p>
      <Qr text={demoWhatsappHref(example)} />
      <p className="text-center text-[28px] font-semibold tabular-nums tracking-wide">{DEMO.phone}</p>
      <p className="-mt-3 text-center text-sm text-muted">Arayabilir de, WhatsApp&apos;tan da yazabilir · Instagram {DEMO.instagram}</p>

      <div>
        <p className="mb-1.5 text-sm font-semibold text-muted">Hasta gibi ne yazsın?</p>
        <div className="grid gap-1.5">
          {DEMO.examples.map((e) => (
            <button
              key={e}
              type="button"
              aria-pressed={example === e}
              onClick={() => setExample(e)}
              className="min-h-11 rounded-md border border-line bg-surface px-3 text-left text-[15px] aria-pressed:border-ink aria-pressed:font-medium"
            >
              &quot;{e}&quot;
            </button>
          ))}
        </div>
      </div>

      <ol className="grid gap-2 rounded-lg border border-line bg-surface p-3 text-[15px]">
        {DEMO.steps.map((s, i) => (
          <li key={s} className="flex gap-2.5">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-ink text-xs font-semibold text-white">{i + 1}</span>
            {s}
          </li>
        ))}
      </ol>

      <a
        href={demoWhatsappHref(example)}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex min-h-12 items-center justify-center rounded-md border border-line bg-surface px-4 text-[15px] font-medium"
      >
        QR okutamıyorsa: benim telefonumdan göster
      </a>
    </div>
  );
}

export function openDemo() {
  openSheet("Canlı demo: kendi telefonundan yazsın", <DemoBody />);
}

export function DemoButton({ className }: { className: string }) {
  return (
    <button type="button" onClick={openDemo} className={className}>
      Demo göster
    </button>
  );
}
