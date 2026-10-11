import Link from "next/link";
import { CallStatusBadge, PageTitle, Panel, StageBadge, buttonClass, inputClass } from "@/components/ui";
import { getRepository } from "@/lib/data";
import { parseBusinessFilters } from "@/lib/data/filters";
import { formatPhone } from "@/lib/domain/contact-info";
import { CALL_STATUS_LABELS, CATEGORY_LABELS, SALES_STAGE_LABELS, SOURCE_LABELS } from "@/lib/domain/labels";
import { relativeDay, toDateStr } from "@/lib/domain/time";
import { CALL_STATUSES, CATEGORIES, SALES_STAGES, SOURCES } from "@/lib/domain/types";

export default async function RecordsPage({ searchParams }: PageProps<"/kayitlar">) {
  const params = await searchParams;
  const filters = parseBusinessFilters(params);
  const repo = getRepository();
  const [rows, districts] = await Promise.all([repo.listBusinesses(filters), repo.listDistricts()]);
  const today = toDateStr(new Date());

  const query = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (typeof v === "string" && v) query.set(k, v);
  const exportHref = (format: "csv" | "xlsx") => {
    const q = new URLSearchParams(query);
    q.set("format", format);
    return `/api/disa-aktar?${q}`;
  };

  return (
    <div>
      <PageTitle
        aside={
          <Link href="/isletme/yeni" className={buttonClass.primary}>
            İşletme ekle
          </Link>
        }
      >
        Kayıtlar
      </PageTitle>

      <form className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4" role="search">
        <input
          name="q"
          type="search"
          defaultValue={filters.q}
          placeholder="Ad, telefon, adres, kişi"
          aria-label="Ara"
          className={`${inputClass} sm:col-span-2`}
        />
        <Select name="kategori" label="Kategori" value={filters.category} options={CATEGORIES.map((c) => [c, CATEGORY_LABELS[c]])} />
        <Select name="ilce" label="İlçe" value={filters.district} options={districts.map((d) => [d, d])} />
        <Select name="durum" label="Arama durumu" value={filters.callStatus} options={CALL_STATUSES.map((s) => [s, CALL_STATUS_LABELS[s]])} />
        <Select name="asama" label="Satış aşaması" value={filters.salesStage} options={SALES_STAGES.map((s) => [s, SALES_STAGE_LABELS[s]])} />
        <Select name="kaynak" label="Kaynak" value={filters.source} options={SOURCES.map((s) => [s, SOURCE_LABELS[s]])} />
        <label className="flex items-center gap-2 text-[15px]">
          <input type="checkbox" name="kontrol" value="1" defaultChecked={filters.needsReview} className="size-4 accent-ink" />
          Yalnızca kontrol gerekenler
        </label>
        <div className="flex gap-2 sm:col-span-2 lg:col-span-4">
          <button type="submit" className={buttonClass.primary}>
            Filtrele
          </button>
          <Link href="/kayitlar" className={buttonClass.secondary}>
            Temizle
          </Link>
        </div>
      </form>

      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-[15px]">
        <p className="text-muted">{rows.length} kayıt</p>
        <p className="flex gap-4">
          <a href={exportHref("csv")} className="font-medium text-meet hover:underline">
            CSV indir
          </a>
          <a href={exportHref("xlsx")} className="font-medium text-meet hover:underline">
            Excel indir
          </a>
        </p>
      </div>

      <Panel className="overflow-hidden">
        {rows.length === 0 ? (
          <p className="px-4 py-6 text-[15px] text-muted">Bu filtrelere uyan kayıt yok. Filtreleri temizleyip tekrar deneyin.</p>
        ) : (
          <ul>
            {rows.map((b) => (
              <li key={b.id} className="border-b border-line last:border-b-0">
                <Link href={`/isletme/${b.id}`} className="grid gap-1 px-4 py-3 hover:bg-paper/60 md:grid-cols-[minmax(0,2fr)_10rem_minmax(0,1.4fr)] md:items-center md:gap-4">
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{b.name}</span>
                    <span className="block text-sm text-muted">
                      {[b.categories.map((c) => CATEGORY_LABELS[c]).join(", ") || "Kategori belirsiz", b.district].filter(Boolean).join(", ")}
                    </span>
                  </span>
                  <span className="text-[15px]">{formatPhone(b.phone) ?? <span className="text-stop">Telefon yok</span>}</span>
                  <span className="flex flex-wrap items-center gap-1.5">
                    <CallStatusBadge status={b.callStatus} />
                    <StageBadge stage={b.salesStage} />
                    {b.reviewReason && <span className="text-sm text-late">Kontrol gerekli</span>}
                    {b.nextActionDate && (
                      <span className="text-sm text-muted">Sonraki: {relativeDay(b.nextActionDate, today)}</span>
                    )}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

function Select({
  name,
  label,
  value,
  options,
}: {
  name: string;
  label: string;
  value?: string;
  options: [string, string][];
}) {
  return (
    <select name={name} defaultValue={value ?? ""} aria-label={label} className={inputClass}>
      <option value="">{label}: tümü</option>
      {options.map(([v, l]) => (
        <option key={v} value={v}>
          {l}
        </option>
      ))}
    </select>
  );
}
