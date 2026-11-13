"use client";

import type { ReactNode } from "react";
import {
  CLINIC_TYPE_LINES,
  DO_RULES,
  DONT_RULES,
  OBJECTIONS,
  PHONE_FLOW,
  PHONE_GOAL,
  PHONE_OBJECTIONS,
  PHONE_SCENARIOS,
  POSITIONING,
  type Line,
  withDay,
} from "@/lib/domain/sales-playbook";

/** Rehberde örnek gün. */
const example = (t: string) => withDay(t, "Perşembe");

// Konuşma rehberi: Cuswin-Arama-Senaryosu.pdf ve Saha Kiti'nin uygulamadaki hali.

export function PhoneGuide() {
  return (
    <div className="grid gap-5 text-[15px]">
      <section>
        <p className="font-medium">{PHONE_GOAL}</p>
        <ol className="mt-3 grid grid-cols-2 gap-2">
          {PHONE_FLOW.map((f, i) => (
            <li key={f.step} className="rounded-md border border-line bg-surface px-3 py-2">
              <span className="block text-sm font-semibold text-meet">
                {i + 1}. {f.step}
              </span>
              <span className="text-sm">{f.text}</span>
            </li>
          ))}
        </ol>
        <Quote>
          <strong className="font-semibold">{POSITIONING.thesis}</strong> {POSITIONING.message}
        </Quote>
      </section>

      {PHONE_SCENARIOS.map((s) => (
        <section key={s.id}>
          <h3 className="text-[17px] font-semibold">{s.title}</h3>
          <Say line={{ who: "1. Açılış", text: s.opening }} />
          <p className="-mt-1 mb-2 text-sm text-muted">{s.note}</p>
          <div className="my-2 rounded-md border border-line bg-surface px-3 py-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-meet">2. Sor ve sus</p>
            <ol className="mt-1 grid gap-2">
              {s.questions.map((q, i) => (
                <li key={q.text}>
                  <span className="font-medium">
                    {i + 1}. &quot;{q.text}&quot;
                  </span>
                  <span className="block text-sm text-muted">{q.listen}</span>
                </li>
              ))}
              {s.id === "doktor" && <li className="text-sm text-muted">+ klinik türüne göre bir soru (aşağıda).</li>}
            </ol>
          </div>
          <Say line={{ who: "3. Bağla", text: s.bridge }} />
          <Say line={{ who: "4. Tarih iste", text: example(s.close), tone: "close" }} />
          <Say line={{ who: "5. Teyit", text: example(s.confirm) }} />
          {s.branches.length > 0 && (
            <div className="mt-3 grid gap-2">
              <p className="text-sm font-medium text-muted">Sık duyacağın cevaplar</p>
              {s.branches.map((b) => (
                <details key={b.title} className="rounded-md border border-line bg-surface px-3 py-2">
                  <summary className="min-h-9 cursor-pointer py-1 font-medium">{b.title}</summary>
                  <div className="pb-1 pt-1">
                    {b.lines.map((l) => (
                      <Say key={l.text} line={{ ...l, text: example(l.text) }} />
                    ))}
                    {b.tip && <p className="text-sm text-muted">{b.tip}</p>}
                  </div>
                </details>
              ))}
            </div>
          )}
        </section>
      ))}

      <section>
        <h3 className="text-[17px] font-semibold">Hayır derlerse</h3>
        <p className="mb-2 text-sm text-muted">Anladığını göster, kısa cevap ver, bir soruyla ya da tarihle bitir. Telefonda ikna etmeye çalışma.</p>
        <dl className="grid gap-2">
          {PHONE_OBJECTIONS.map((o) => (
            <div key={o.q} className="rounded-md border border-line bg-surface px-3 py-2">
              <dt className="font-medium">&quot;{o.q}&quot;</dt>
              <dd>{example(o.a)}</dd>
              {o.app && <dd className="mt-1 text-sm text-meet">Uygulamada: {o.app}</dd>}
            </div>
          ))}
        </dl>
      </section>

      <section>
        <h3 className="text-[17px] font-semibold">Klinik türüne göre</h3>
        <div className="mt-2 grid gap-2">
          {CLINIC_TYPE_LINES.map((c) => (
            <details key={c.id} className="rounded-md border border-line bg-surface px-3 py-2">
              <summary className="min-h-9 cursor-pointer py-1 font-medium">{c.title}</summary>
              <Say line={{ who: "Kanca", text: c.hook }} />
              <Say line={{ who: "Soru", text: c.question }} />
              <p className="pb-1 text-sm text-muted">{c.note}</p>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}

export function VisitGuide() {
  return (
    <div className="grid gap-3 text-[15px]">
      <dl className="grid grid-cols-2 gap-2 text-center">
        <Fact value="2.934" label="mesaj ve arama, 30 günde" />
        <Fact value="462/464" label="mesai dışı konuşma karşılandı" />
        <Fact value="174" label="randevu alındı" />
        <Fact value="%93" label="randevuya gelme" />
      </dl>
      <p className="text-sm text-muted">&quot;Ankara&apos;da bir estetik ve KBB kliniği.&quot; Pilot kliniğin adını hiçbir koşulda söyleme.</p>
      <Step n={1} title="Açılış" time="30 sn">
        Ankara&apos;da bir klinikte Cuswin&apos;i 1 aydır kullanıyoruz. 30 günde 2.934 mesaj ve arama gelmiş, yarısından fazlası mesai
        saatleri dışında. Sizde durum nasıl?
      </Step>
      <Step n={2} title="Sor ve dinle" time="2 dk">
        Günde kaç mesaj, kaç arama geliyor? Akşam ve hafta sonu kim bakıyor? &quot;Düşüneyim&quot; diyen hastaya geri dönülüyor mu? Cevapları
        not al, konuşmanın çoğunu o yapsın.
      </Step>
      <Step n={3} title="Canlı demo" time="3 dk">
        Kendi telefonunuzdan şu hesaba hasta gibi yazın: &quot;Dolgu ne kadar?&quot; Cevap 3 saniyede gelir. Sonra paneli göster: konuşma
        kayıtlı, takip planı hazır.
      </Step>
      <Step n={4} title="Güven" time="2 dk">
        Kurulumu biz yapıyoruz. Siz onay vermeden hiçbir şey açılmıyor. Sadece sizin fiyat listenizle konuşur, tıbbi tavsiye vermez. Hasta
        verisi sizindir.
      </Step>
      <Step n={5} title="Kapanış" time="2 dk">
        Kurulum 3 gün sürüyor. Hangi gün başlayalım, pazartesi mi çarşamba mı? &quot;Düşüneyim&quot; derse: &quot;Ne olursa evet dersiniz?&quot; Her
        durumda: &quot;Bu sorunu yaşayan tanıdığınız başka klinik var mı?&quot; Tarih koymadan çıkma.
      </Step>
    </div>
  );
}

export function ObjectionGuide() {
  return (
    <div className="text-[15px]">
      <p className="mb-3 text-sm text-muted">
        Önce itirazı tekrar et (&quot;Yani şundan endişeleniyorsunuz…&quot;), sonra cevap ver, sonra &quot;Bu konuda içiniz rahat mı?&quot; diye sor.
      </p>
      <dl className="grid gap-2">
        {OBJECTIONS.map((o) => (
          <div key={o.q} className="rounded-md border border-line bg-surface px-3 py-2">
            <dt className="font-medium">&quot;{o.q}&quot;</dt>
            <dd>{o.a}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <p className="text-sm font-medium text-call">Yap</p>
          <ul className="list-disc pl-5">
            {DO_RULES.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-sm font-medium text-stop">Yapma</p>
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

function Say({ line }: { line: Line }) {
  const tone =
    line.tone === "them" ? "border-line bg-surface" : line.tone === "close" ? "border-call/30 bg-call-soft" : "border-meet/20 bg-meet-soft/60";
  return (
    <div className={`my-2 rounded-md border px-3 py-2 ${tone}`}>
      <p className={`text-xs font-semibold uppercase tracking-wide ${line.tone === "close" ? "text-call" : "text-meet"}`}>{line.who}</p>
      <p>&quot;{line.text}&quot;</p>
    </div>
  );
}

function Quote({ children }: { children: ReactNode }) {
  return <p className="mt-3 rounded-md bg-paper px-3 py-2">{children}</p>;
}

function Fact({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-md bg-surface px-2 py-2">
      <dt className="sr-only">{label}</dt>
      <dd className="text-lg font-semibold tabular-nums">{value}</dd>
      <dd className="text-xs text-muted">{label}</dd>
    </div>
  );
}

function Step({ n, title, time, children }: { n: number; title: string; time: string; children: ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-ink text-sm font-semibold text-white">{n}</span>
      <div>
        <p className="font-semibold">
          {title} <span className="text-sm font-normal text-muted">{time}</span>
        </p>
        <p>{children}</p>
      </div>
    </div>
  );
}
