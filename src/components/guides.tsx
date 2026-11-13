"use client";

// Rehber: kapıda adım adım konuşma, doktorun soracağı ürün soruları, itirazlar ve rakipler.
// Telefon konuşması aramada kartın içinde açılır (call-script.tsx); burada tekrar edilmez.

import { useState } from "react";
import { DemoButton } from "@/components/demo";
import { COMPETITORS, DOOR_STEPS, PRODUCT_QA, TOP_OBJECTIONS } from "@/lib/domain/guide-content";
import { DO_RULES, DONT_RULES, OBJECTIONS, POSITIONING } from "@/lib/domain/sales-playbook";

/** Kapıda: 10 dakikalık görüşme, bir adım bir ekran. */
export function DoorGuide() {
  const [i, setI] = useState(0);
  const step = DOOR_STEPS[i];
  const last = i === DOOR_STEPS.length - 1;
  return (
    <div className="grid gap-3 text-[16px]">
      <ol className="flex gap-1" aria-label="Adımlar">
        {DOOR_STEPS.map((s, k) => (
          <li key={s.title} className="flex-1">
            <button
              type="button"
              onClick={() => setI(k)}
              aria-current={k === i ? "step" : undefined}
              aria-label={`${k + 1}. ${s.title}`}
              className={`h-2 w-full rounded-full ${k <= i ? "bg-ink" : "bg-line"}`}
            />
          </li>
        ))}
      </ol>

      <section className="rounded-xl border border-line bg-surface px-4 py-4">
        <p className="flex items-baseline justify-between text-sm font-semibold text-muted">
          <span>
            {i + 1}/{DOOR_STEPS.length} · {step.title}
          </span>
          <span className="font-normal">{step.time}</span>
        </p>
        {step.say.length > 0 && (
          <ul className="mt-3 grid gap-3">
            {step.say.map((t) => (
              <li key={t} className="rounded-lg bg-meet-soft/60 px-3.5 py-3 text-[17px] leading-relaxed">
                {t}
              </li>
            ))}
          </ul>
        )}
        {step.demo && (
          <DemoButton className="mt-3 flex min-h-14 w-full items-center justify-center rounded-md bg-meet text-[17px] font-semibold text-white" />
        )}
        <ul className="mt-3 grid gap-1.5 text-[15px] text-muted">
          {step.tips.map((t) => (
            <li key={t}>· {t}</li>
          ))}
        </ul>
      </section>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={i === 0}
          onClick={() => setI((k) => k - 1)}
          className="min-h-14 rounded-md border border-line bg-surface text-[16px] font-medium disabled:opacity-40"
        >
          ‹ Geri
        </button>
        <button
          type="button"
          onClick={() => setI((k) => (last ? 0 : k + 1))}
          className="min-h-14 rounded-md bg-ink text-[16px] font-semibold text-white"
        >
          {last ? "Başa dön" : `Sonraki: ${DOOR_STEPS[i + 1].title} ›`}
        </button>
      </div>

      <p className="rounded-md bg-paper px-3 py-2 text-[15px]">
        <strong className="font-semibold">{POSITIONING.thesis}</strong> {POSITIONING.message}
      </p>
    </div>
  );
}

/** Doktorun demoda soracakları: kısa, doğru cevaplar. */
export function ProductGuide() {
  return (
    <div className="grid gap-2 text-[15px]">
      <p className="mb-1 text-sm text-muted">Doktor sorunca kısa cevap ver, sonra demoya ya da tarihe dön. Bilmediğini uydurma: &quot;Kontrol edip yazayım&quot; de.</p>
      {PRODUCT_QA.map((x, k) => (
        <details key={x.q} className="group rounded-lg border border-line bg-surface" open={k === 0}>
          <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-3.5 text-[16px] font-semibold">
            {x.q}
            <span aria-hidden className="text-lg text-muted transition-transform group-open:rotate-90">
              ›
            </span>
          </summary>
          <ul className="grid gap-2 border-t border-line px-3.5 py-3">
            {x.a.map((t) => (
              <li key={t} className="leading-relaxed">
                {t}
              </li>
            ))}
          </ul>
        </details>
      ))}
    </div>
  );
}

/** İtirazlar: en sık duyulanlar üstte, arama kutusu, önce tek satır cevap. */
export function ObjectionGuide() {
  const [q, setQ] = useState("");
  const norm = (s: string) => s.toLocaleLowerCase("tr-TR");
  const list = [
    ...OBJECTIONS.filter((o) => TOP_OBJECTIONS.includes(o.q)).sort((a, b) => TOP_OBJECTIONS.indexOf(a.q) - TOP_OBJECTIONS.indexOf(b.q)),
    ...OBJECTIONS.filter((o) => !TOP_OBJECTIONS.includes(o.q)),
  ].filter((o) => !q.trim() || norm(`${o.q} ${o.a}`).includes(norm(q.trim())));

  return (
    <div className="text-[15px]">
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="İtiraz ara: pahalı, sekreter, KVKK…"
        aria-label="İtiraz ara"
        className="mb-3 w-full rounded-md border border-line bg-surface px-3 py-3 text-[16px]"
      />
      <p className="mb-3 text-sm text-muted">
        Önce itirazı tekrar et (&quot;Yani şundan endişeleniyorsunuz…&quot;), kısa cevap ver, sonra &quot;Bu konuda içiniz rahat mı?&quot; diye sor.
      </p>
      <ul className="grid gap-2">
        {list.map((o) => {
          const [first, ...rest] = o.a.split(/(?<=[.?!])\s+/);
          const top = TOP_OBJECTIONS.includes(o.q);
          return (
            <li key={o.q} className="rounded-lg border border-line bg-surface px-3.5 py-3">
              <p className="flex items-baseline justify-between gap-2 font-semibold">
                &quot;{o.q}&quot;
                {top && !q && <span className="shrink-0 rounded bg-late-soft px-1.5 text-[12px] font-semibold text-late">Sık</span>}
              </p>
              <p className="mt-1 text-[16px] font-medium leading-relaxed">{first}</p>
              {rest.length > 0 && <p className="mt-1 leading-relaxed text-muted">{rest.join(" ")}</p>}
            </li>
          );
        })}
        {list.length === 0 && <li className="px-1 text-muted">Bulunamadı.</li>}
      </ul>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <div>
          <p className="text-sm font-semibold text-call">Yap</p>
          <ul className="list-disc pl-5">
            {DO_RULES.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-sm font-semibold text-stop">Yapma</p>
          <ul className="list-disc pl-5">
            {DONT_RULES.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </div>
      </div>
      <p className="mt-3 text-sm text-muted">
        {POSITIONING.rival} Dil: &quot;{POSITIONING.say}&quot;
      </p>
    </div>
  );
}

/** "Zaten X kullanıyoruz" diyene: fark ve tek cümle; rakip kötülenmez. */
export function CompetitorGuide() {
  return (
    <div className="grid gap-2 text-[15px]">
      <p className="mb-1 text-sm text-muted">Rakibi kötüleme. Kullandıklarını öv, eksik kalan yeri sor, demoya dön.</p>
      {COMPETITORS.map((c) => (
        <section key={c.names} className="rounded-lg border border-line bg-surface px-3.5 py-3">
          <p className="text-sm font-medium text-muted">&quot;Zaten kullanıyoruz&quot; derse</p>
          <h3 className="text-[16px] font-semibold">{c.names}</h3>
          <p className="mt-0.5 text-sm text-muted">{c.what}</p>
          <p className="mt-2 rounded-md bg-meet-soft/60 px-3 py-2 text-[16px] leading-relaxed">&quot;{c.say}&quot;</p>
        </section>
      ))}
    </div>
  );
}
