"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ClinicMap } from "@/components/clinic-map";
import { MapStopCard } from "@/components/field-rows";
import { Badge, LoadState, Panel } from "@/components/ui";
import { useData } from "@/lib/client/refresh";
import { getRepository } from "@/lib/data";
import { summarizeContacts } from "@/lib/domain/field-plan";
import { useGeocoded } from "@/lib/client/geocode";
import { coordsOf } from "@/lib/domain/contact-info";
import { distanceMeters, formatDistance, MAP_STATUS, mapPoints, nearest, nextStop, type LatLng, type MapStatus } from "@/lib/domain/map-points";
import { SEGMENTS, type Segment } from "@/lib/domain/segments";
import { formatDateTime, toDateStr } from "@/lib/domain/time";

type Me = LatLng & { accuracy: number };

/**
 * Saha haritası: kapı kapı gezerken çevredeki klinikler, durum renkleriyle.
 * Konum yalnızca telefonda kalır; hiçbir yere gönderilmez.
 */
export function FieldMap() {
  const repo = getRepository();
  const { data, error } = useData(() =>
    Promise.all([repo.listBusinesses({}), repo.listAppointments(), repo.listContactHistory()]),
  );
  const [segment, setSegment] = useState<Segment>("estetik");
  const [selectedId, setSelectedId] = useState<string>();
  const [me, setMe] = useState<Me>();
  const [watching, setWatching] = useState(false);
  const [highAccuracy, setHighAccuracy] = useState(true);
  const [geoMsg, setGeoMsg] = useState<string>();
  const [follow, setFollow] = useState(false);

  // Konum izleme: sayfadan çıkınca durur. Yüksek doğrulukla bulunamazsa (kapalı alan) normal doğrulukla tekrar dener.
  useEffect(() => {
    if (!watching) return;
    const watch = navigator.geolocation.watchPosition(
      (p) => {
        setMe({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy });
        setGeoMsg(undefined);
      },
      (e) => {
        if (e.code === e.PERMISSION_DENIED) {
          setWatching(false);
          setFollow(false);
          setGeoMsg(
            "Konum izni kapalı. iPhone: Ayarlar → Gizlilik ve Güvenlik → Konum Servisleri → Safari Web Siteleri (ya da Chrome) → \"Uygulamayı Kullanırken\". Sonra sayfayı yenile.",
          );
        } else if (highAccuracy) {
          setHighAccuracy(false);
          setGeoMsg("GPS zayıf, yaklaşık konum deneniyor…");
        } else {
          setWatching(false);
          setGeoMsg("Konum bulunamadı. Açık alana çık ya da Konum Servisleri'nin açık olduğunu kontrol et, sonra tekrar bas.");
        }
      },
      { enableHighAccuracy: highAccuracy, maximumAge: 15_000, timeout: highAccuracy ? 12_000 : 20_000 },
    );
    return () => navigator.geolocation.clearWatch(watch);
  }, [watching, highAccuracy]);

  const startLocate = () => {
    setFollow(true);
    if (!("geolocation" in navigator)) {
      setGeoMsg("Bu tarayıcı konum vermiyor.");
      return;
    }
    if (!watching) {
      setHighAccuracy(true);
      setGeoMsg(undefined);
      setWatching(true);
    }
  };

  const now = useMemo(() => new Date(), []);
  const today = toDateStr(now);
  const segmentData = useMemo(() => {
    if (!data) return undefined;
    const [businesses, appointments, history] = data;
    return {
      businesses: businesses.filter(SEGMENTS[segment].match),
      appointments: appointments.map((a) => a.appointment),
      contacts: summarizeContacts(history),
    };
  }, [data, segment]);
  const withoutLink = useMemo(() => segmentData?.businesses.filter((b) => !coordsOf(b.mapsUrl)) ?? [], [segmentData]);
  const geocoded = useGeocoded(withoutLink);
  const view = useMemo(() => {
    if (!segmentData) return undefined;
    const { points, missing } = mapPoints(segmentData.businesses, segmentData.appointments, segmentData.contacts, now, geocoded.coords);
    return { points, missing, contacts: segmentData.contacts };
  }, [segmentData, now, geocoded.coords]);

  const select = useCallback((id: string) => {
    setSelectedId(id);
    setFollow(false);
  }, []);

  if (!view) return <LoadState error={error} />;
  const selected = view.points.find((p) => p.business.id === selectedId);
  const counts = view.points.reduce((c, p) => ({ ...c, [p.status]: (c[p.status] ?? 0) + 1 }), {} as Partial<Record<MapStatus, number>>);
  const close = view.points.length && me ? nearest(view.points, me, 8) : [];

  const nextFor = (id: string) => {
    const n = nextStop(view.points, id);
    return n && { name: n.point.business.name, distance: formatDistance(n.meters), go: () => select(n.point.business.id) };
  };

  const badgeFor = (status: MapStatus, meters?: number, when?: string, approx?: boolean) => (
    <>
      <Badge>
        <span aria-hidden className="mr-1.5 inline-block size-2.5 rounded-full" style={{ background: MAP_STATUS[status].color }} />
        {MAP_STATUS[status].label}
      </Badge>
      {when && <Badge tone="meet">{when}</Badge>}
      {meters !== undefined && <Badge>{formatDistance(meters)}</Badge>}
      {approx && <Badge tone="late">Konum adresten, yaklaşık</Badge>}
    </>
  );

  return (
    <div className="-mx-4">
      <div className="relative h-[55svh] min-h-80 border-b border-line">
        <ClinicMap points={view.points} selectedId={selectedId} onSelect={select} me={me} follow={follow} />
        <div className="pointer-events-none absolute inset-x-0 top-0 z-[1000] flex items-start justify-between gap-2 p-3">
          <div role="tablist" aria-label="Klinik türü" className="pointer-events-auto flex rounded-full border border-line bg-surface p-1 shadow-sm">
            {(Object.keys(SEGMENTS) as Segment[]).map((s) => (
              <button
                key={s}
                type="button"
                role="tab"
                aria-selected={segment === s}
                onClick={() => {
                  setSegment(s);
                  setSelectedId(undefined);
                }}
                className="min-h-10 rounded-full px-3.5 text-[15px] font-medium text-muted aria-selected:bg-ink aria-selected:text-white"
              >
                {s === "estetik" ? "Estetik ve saç" : "Diş"}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={startLocate}
            className={`pointer-events-auto inline-flex min-h-12 items-center gap-2 rounded-full border px-4 text-[15px] font-semibold shadow-sm ${
              follow && me ? "border-[#2563eb] bg-[#2563eb] text-white" : "border-line bg-surface"
            }`}
          >
            <LocateIcon />
            {watching && !me ? "Bulunuyor" : "Konumum"}
          </button>
        </div>
      </div>

      <div className="px-4 pt-3">
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted" aria-label="Renkler">
          {(Object.keys(MAP_STATUS) as MapStatus[]).map((s) => (
            <li key={s} className="inline-flex items-center gap-1.5">
              <span aria-hidden className="inline-block size-3 rounded-full" style={{ background: MAP_STATUS[s].color }} />
              {MAP_STATUS[s].label} <span className="tabular-nums">{counts[s] ?? 0}</span>
            </li>
          ))}
        </ul>
        {geoMsg && <p className="mt-2 rounded-md bg-late-soft px-3 py-2 text-sm text-late">{geoMsg}</p>}

        {selected ? (
          <Panel className="mt-3 overflow-hidden">
            <MapStopCard
              key={selected.business.id}
              business={selected.business}
              today={today}
              contact={view.contacts.get(selected.business.id)}
              badge={badgeFor(
                selected.status,
                me ? distanceMeters(me, selected) : undefined,
                selected.appointment ? formatDateTime(selected.appointment.startsAt) : undefined,
                selected.approx,
              )}
              onClose={() => setSelectedId(undefined)}
              next={nextFor(selected.business.id)}
            />
          </Panel>
        ) : (
          <Panel className="mt-3 overflow-hidden">
            <h2 className="border-b border-line px-4 py-3 text-[17px] font-semibold">{me ? "Yakınındaki klinikler" : "Haritadan bir klinik seç"}</h2>
            {me ? (
              <ul>
                {close.map(({ point: p, meters }) => (
                  <li key={p.business.id} className="border-b border-line last:border-b-0">
                    <button type="button" onClick={() => select(p.business.id)} className="flex min-h-14 w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-paper">
                      <span aria-hidden className="size-3.5 shrink-0 rounded-full" style={{ background: MAP_STATUS[p.status].color }} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[16px] font-medium">{p.business.name}</span>
                        <span className="block truncate text-sm text-muted">{p.business.address}</span>
                      </span>
                      <span className="shrink-0 text-[15px] font-medium tabular-nums">{formatDistance(meters)}</span>
                    </button>
                  </li>
                ))}
                {close.length === 0 && <li className="px-4 py-4 text-[15px] text-muted">Yakında gidilecek klinik yok.</li>}
              </ul>
            ) : (
              <p className="px-4 py-4 text-[15px] text-muted">
                Noktaya dokun, kliniğin kartı burada açılır. &quot;Konumum&quot;a basarsan en yakındakiler sıralanır.
              </p>
            )}
          </Panel>
        )}

        {geocoded.pending > 0 && <p className="mt-3 text-sm text-muted">Adresten konum aranıyor: {geocoded.pending} klinik kaldı…</p>}
        {view.missing > 0 && geocoded.pending === 0 && (
          <p className="mt-3 text-sm text-muted">
            {view.missing} kliniğin konumu bulunamadı (Maps bağlantısı ya da açık adres yok). Onlar{" "}
            <Link href="/kayitlar" className="font-medium text-meet underline">
              Kayıtlar
            </Link>{" "}
            listesinde.
          </p>
        )}
      </div>
    </div>
  );
}

function LocateIcon() {
  return (
    <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
    </svg>
  );
}
