"use client";

// Leaflet + OpenStreetMap: API anahtarı gerektirmez. Leaflet "window" istediği için tarayıcıda yüklenir.

import "leaflet/dist/leaflet.css";
import type * as Leaflet from "leaflet";
import { useEffect, useRef } from "react";
import { MAP_STATUS, type LatLng, type MapPoint } from "@/lib/domain/map-points";

const ANKARA: [number, number] = [39.92, 32.85];

export function ClinicMap({
  points,
  selectedId,
  onSelect,
  me,
  follow,
}: {
  points: MapPoint[];
  selectedId?: string;
  onSelect: (id: string) => void;
  me?: LatLng & { accuracy: number };
  /** true iken harita konumu takip eder. */
  follow: boolean;
}) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<Leaflet.Map>(null);
  const L = useRef<typeof Leaflet>(null);
  const markers = useRef<Leaflet.LayerGroup>(null);
  const meLayer = useRef<Leaflet.LayerGroup>(null);
  const fitted = useRef(false);
  const resize = useRef<ResizeObserver>(null);
  const onSelectRef = useRef(onSelect);
  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  // Harita bir kez kurulur.
  useEffect(() => {
    let cancelled = false;
    void import("leaflet").then((mod) => {
      if (cancelled || !box.current || map.current) return;
      const lib = (mod.default ?? mod) as typeof Leaflet;
      L.current = lib;
      const m = lib.map(box.current, { zoomControl: false, preferCanvas: true }).setView(ANKARA, 12);
      lib
        .tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        })
        .addTo(m);
      lib.control.zoom({ position: "bottomright" }).addTo(m);
      markers.current = lib.layerGroup().addTo(m);
      meLayer.current = lib.layerGroup().addTo(m);
      map.current = m;
      // iPhone: harita üzerinde iki parmak hareketi yalnızca haritayı büyütsün, sayfayı değil.
      const stop = (e: Event) => e.preventDefault();
      for (const ev of ["gesturestart", "gesturechange", "gestureend"]) box.current.addEventListener(ev, stop, { passive: false });
      // Ekran döndürülünce ya da kutu boyutu değişince harita kendini yeniden ölçsün (gri alan kalmasın).
      resize.current = new ResizeObserver(() => m.invalidateSize());
      resize.current.observe(box.current);
      // İlk çizim için noktaları tetikle.
      box.current.dispatchEvent(new Event("map-ready"));
    });
    return () => {
      cancelled = true;
      resize.current?.disconnect();
      map.current?.remove();
      map.current = null;
    };
  }, []);

  // Klinik noktaları.
  useEffect(() => {
    const draw = () => {
      const lib = L.current;
      const m = map.current;
      if (!lib || !m || !markers.current) return;
      markers.current.clearLayers();
      // Seçili olan en üstte çizilsin.
      const ordered = [...points].sort((a, b) => Number(a.business.id === selectedId) - Number(b.business.id === selectedId));
      for (const p of ordered) {
        const selected = p.business.id === selectedId;
        const color = MAP_STATUS[p.status].color;
        lib
          .circleMarker([p.lat, p.lng], {
            radius: selected ? 14 : p.status === "kapali" ? 7 : 10,
            color: selected ? "#15202b" : "#ffffff",
            weight: selected ? 4 : 2,
            fillColor: color,
            fillOpacity: 1,
          })
          .on("click", () => onSelectRef.current(p.business.id))
          .addTo(markers.current);
      }
      if (!fitted.current && points.length) {
        fitted.current = true;
        m.fitBounds(lib.latLngBounds(points.map((p) => [p.lat, p.lng])), { padding: [30, 30], maxZoom: 15 });
      }
    };
    draw();
    const el = box.current;
    el?.addEventListener("map-ready", draw);
    return () => el?.removeEventListener("map-ready", draw);
  }, [points, selectedId]);

  // Seçilen klinik yalnızca ekranda görünmüyorsa (listeden ya da "sıradaki"den seçildiyse) haritaya getirilir;
  // haritada dokunulan nokta zaten görünür, harita kaymaz.
  useEffect(() => {
    const p = points.find((x) => x.business.id === selectedId);
    const m = map.current;
    if (!p || !m) return;
    if (!m.getBounds().pad(-0.1).contains([p.lat, p.lng])) m.panTo([p.lat, p.lng]);
  }, [selectedId, points]);

  // Benim konumum.
  useEffect(() => {
    const lib = L.current;
    const m = map.current;
    if (!lib || !m || !meLayer.current) return;
    meLayer.current.clearLayers();
    if (!me) return;
    lib.circle([me.lat, me.lng], { radius: me.accuracy, color: "#2563eb", weight: 1, fillOpacity: 0.1, interactive: false }).addTo(meLayer.current);
    lib
      .circleMarker([me.lat, me.lng], { radius: 8, color: "#ffffff", weight: 3, fillColor: "#2563eb", fillOpacity: 1, interactive: false })
      .addTo(meLayer.current);
    if (follow) m.setView([me.lat, me.lng], Math.max(m.getZoom(), 16));
  }, [me, follow]);

  return <div ref={box} className="isolate h-full w-full touch-none overscroll-contain" role="application" aria-label="Klinik haritası" />;
}
