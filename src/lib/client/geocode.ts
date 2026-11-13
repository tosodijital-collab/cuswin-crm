"use client";

// Google Maps bağlantısı olmayan kliniklerin konumunu adresten bulur (OpenStreetMap Nominatim).
// Nominatim kuralları: saniyede en fazla 1 istek, sonuçlar önbellekte tutulur. Sonuçlar bu telefonda
// (localStorage) saklanır; aynı adres bir daha sorulmaz. Gönderilen yalnızca kliniğin açık adresidir.

import { useEffect, useMemo, useState } from "react";
import { geocodeQuery, nearAnkara, type LatLng } from "@/lib/domain/map-points";
import type { Business } from "@/lib/domain/types";

const KEY = "cuswin-geo-v1";
const MAX_PER_VISIT = 80;
type Cache = Record<string, [number, number] | 0>;

function readCache(): Cache {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "{}") as Cache;
  } catch {
    return {};
  }
}

function writeCache(c: Cache) {
  try {
    localStorage.setItem(KEY, JSON.stringify(c));
  } catch {
    // Depolama kapalıysa her ziyarette yeniden aranır; sorun değil.
  }
}

async function lookup(query: string, signal: AbortSignal): Promise<LatLng | undefined> {
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=tr&accept-language=tr&q=${encodeURIComponent(query)}`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Nominatim ${res.status}`);
  const rows = (await res.json()) as { lat: string; lon: string }[];
  const r = rows[0];
  if (!r) return undefined;
  const c = { lat: Number(r.lat), lng: Number(r.lon) };
  return Number.isFinite(c.lat) && Number.isFinite(c.lng) && nearAnkara(c) ? c : undefined;
}

/** Verilen kliniklerin adresten bulunan konumları; arka planda tek tek doldurulur. */
export function useGeocoded(businesses: Business[]): { coords: ReadonlyMap<string, LatLng>; pending: number } {
  const [cache, setCache] = useState<Cache>({});
  const [pending, setPending] = useState(0);

  const jobs = useMemo(
    () => businesses.map((b) => ({ id: b.id, q: geocodeQuery(b) })).filter((j): j is { id: string; q: string } => Boolean(j.q)),
    [businesses],
  );
  const signature = jobs.map((j) => j.q).join("|");

  useEffect(() => {
    const ctrl = new AbortController();
    const local = readCache();
    const todo = [...new Set(signature.split("|").filter(Boolean))].filter((q) => !(q in local)).slice(0, MAX_PER_VISIT);
    // Önbellekteki sonuçlar hemen; eksikler sırayla.
    queueMicrotask(() => {
      if (ctrl.signal.aborted) return;
      setCache(local);
      setPending(todo.length);
    });
    void (async () => {
      for (const q of todo) {
        if (ctrl.signal.aborted) return;
        try {
          const c = await lookup(q, ctrl.signal);
          local[q] = c ? [c.lat, c.lng] : 0;
          writeCache(local);
        } catch {
          if (ctrl.signal.aborted) return;
          // Ağ ya da hız sınırı: bu ziyarette bırak, sonra tekrar denenir.
          break;
        }
        if (ctrl.signal.aborted) return;
        setCache({ ...local });
        setPending((n) => Math.max(0, n - 1));
        await new Promise((r) => setTimeout(r, 1100));
      }
      if (!ctrl.signal.aborted) setPending(0);
    })();
    return () => ctrl.abort();
  }, [signature]);

  const coords = useMemo(() => {
    const m = new Map<string, LatLng>();
    for (const j of jobs) {
      const hit = cache[j.q];
      if (hit) m.set(j.id, { lat: hit[0], lng: hit[1] });
    }
    return m;
  }, [jobs, cache]);
  return { coords, pending };
}
