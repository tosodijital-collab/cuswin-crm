"use client";

import type { ReactNode } from "react";
import { PauseControl } from "@/components/pause-control";
import { PasswordForm, RunNowButton, ScanButton, SettingsForm } from "@/components/settings-forms";
import { toDateStr } from "@/lib/domain/time";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { EmptyState, LoadState, PageTitle, Panel } from "@/components/ui";
import { useData } from "@/lib/client/refresh";
import { getRepository } from "@/lib/data";
import { formatDateTime, formatShortDate } from "@/lib/domain/time";

const TRIGGER_LABELS = { zamanlanmis: "Zamanlanmış", manuel: "Elle", telafi: "Telafi" } as const;

export default function SettingsPage() {
  const repo = getRepository();
  const { data, error } = useData(() => Promise.all([repo.getSettings(), repo.listRuns(10), repo.listScans(5)]));
  if (!data) return <LoadState error={error} />;
  const [settings, runs, scans] = data;
  const last = runs[0];
  const scanRunning = scans.some((s) => s.status === "calisiyor");

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6">
      <PageTitle>Ayarlar</PageTitle>

      <Block title="Ara verme">
        <PauseControl pause={settings.pause} today={toDateStr(new Date())} />
      </Block>

      <Block title="Günlük liste">
        <SettingsForm settings={settings} />
      </Block>

      <Block title="Otomasyon">
        <p className="mb-3 text-[15px] text-muted">
          Her sabah 08.00&apos;de Google Maps taranır, 08.30&apos;da günün listesi hazırlanır. Aynı gün tekrar çalışırsa yeni
          liste oluşturulmaz; kaçırılan saat gün içinde telafi edilir. Ara verdiğin günlerde ikisi de yapılmaz.
        </p>
        <p className="mb-4 text-[15px]">
          {last
            ? `Son çalışma: ${formatDateTime(last.startedAt)}, ${last.selected}/${last.target} işletme${last.error ? `, hata: ${last.error}` : ""}.`
            : "Henüz çalışma yok."}
        </p>
        <RunNowButton />
        <div className="mt-5 overflow-x-auto">
          {runs.length ? (
            <table className="w-full min-w-md text-left text-[15px]">
              <thead className="text-sm text-muted">
                <tr className="border-b border-line">
                  <th className="py-2 pr-4 font-medium">Gün</th>
                  <th className="py-2 pr-4 font-medium">Tetikleyen</th>
                  <th className="py-2 pr-4 font-medium">Seçilen</th>
                  <th className="py-2 font-medium">Not</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((r) => (
                  <tr key={r.date} className="border-b border-line last:border-b-0 align-top">
                    <td className="py-2 pr-4">{formatShortDate(r.date)}</td>
                    <td className="py-2 pr-4">{TRIGGER_LABELS[r.trigger]}</td>
                    <td className="py-2 pr-4">
                      {r.selected}/{r.target}
                    </td>
                    <td className="py-2 text-sm text-muted">{r.error ?? r.shortfallReason ?? "Tamam"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <EmptyState>Kayıtlı çalışma yok.</EmptyState>
          )}
        </div>
      </Block>

      <Block title="Google Maps taraması">
        <p className="mb-4 text-[15px] text-muted">
          Her sabah otomatik çalışır. Seçili kategori ve ilçelerde Google Maps aranır; devlet kurumları, kuaför ve
          güzellik salonları, kapalı işletmeler elenir. Kayıtlı işletmelerin notları ve durumu korunur. Elle istenen
          tarama birkaç dakika içinde başlar; bu sayfa ilerlemeyi kendiliğinden gösterir.
        </p>
        {!settings.scannerConfigured && (
          <p className="mb-4 rounded-md bg-late-soft px-3 py-2 text-sm text-late">Tarayıcı bu sunucuda ayarlı değil.</p>
        )}
        <ScanButton running={scanRunning} disabled={!settings.scannerConfigured} />
        {scans.length > 0 && (
          <ul className="mt-5 grid gap-3">
            {scans.map((s) => (
              <li key={s.id} className="rounded-md border border-line px-3 py-2.5 text-[15px]">
                <p className="font-medium">
                  {formatDateTime(s.startedAt)}
                  <span className={`ml-2 text-sm font-normal ${s.status === "hata" ? "text-stop" : s.status === "tamam" ? "text-call" : "text-meet"}`}>
                    {s.status === "calisiyor" ? "Sürüyor" : s.status === "tamam" ? "Bitti" : "Hata"}
                  </span>
                </p>
                <p className="text-sm text-muted">
                  {s.found} sonuç bulundu: {s.added} yeni eklendi ({s.flagged} kontrol gerekli), {s.updated} mevcut kayıt
                  tazelendi, {s.skipped} hedef dışı olduğu için elendi
                  {s.overLimit ? `, ${s.overLimit} limit dolduğu için sonraki taramaya kaldı` : ""}.
                </p>
                {s.queries.length > 0 && <p className="text-sm text-muted">Sorgular: {s.queries.join("; ")}</p>}
                {s.note && <p className="text-sm text-muted">{s.note}</p>}
                {s.error && <p className="text-sm text-stop">{s.error}</p>}
              </li>
            ))}
          </ul>
        )}
      </Block>

      <Block title="Google Takvim">
        <p className="text-[15px]">
          {settings.calendarConfigured ? (
            <span className="text-call">Bağlı. Randevular takviminize yazılır, değişiklik ve iptaller takvime yansır.</span>
          ) : (
            <span className="text-late">Bağlı değil. Servis hesabı anahtarı ve takvim kimliği tanımlanınca etkinleşir.</span>
          )}
        </p>
      </Block>

      <Block title="Bildirimler">
        <p className="text-[15px]">
          Kanal: ntfy (telefon bildirimi). Telefonuna ntfy uygulamasını kurup sana verilen gizli konuya abone ol.{" "}
          {settings.notificationsConfigured ? (
            <span className="text-call">Bağlı.</span>
          ) : (
            <span className="text-late">Henüz bağlanmadı. Sunucu kurulumunda ayarlanacak.</span>
          )}
        </p>
      </Block>

      {isSupabaseConfigured() && (
        <Block title="Hesap">
          <PasswordForm />
        </Block>
      )}
    </div>
  );
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Panel className="p-4">
      <h2 className="mb-4 text-[17px] font-semibold">{title}</h2>
      {children}
    </Panel>
  );
}
