"use client";

import { useEffect, useEffectEvent, useState, useSyncExternalStore } from "react";

// Değişiklikten sonra ekranların verisini yeniden yüklemek için basit yayın.
let version = 0;
const listeners = new Set<() => void>();

export function notifyDataChanged() {
  version++;
  for (const l of listeners) l();
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useDataVersion() {
  return useSyncExternalStore(subscribe, () => version, () => version);
}

/**
 * Veri yükler; `key` değişince ya da herhangi bir değişiklikten sonra (notifyDataChanged) kendiliğinden tazeler.
 */
export function useData<T>(load: () => Promise<T>, key = "") {
  const v = useDataVersion();
  const [state, setState] = useState<{ data?: T; error?: string; loading: boolean }>({ loading: true });
  const run = useEffectEvent(load);
  useEffect(() => {
    let alive = true;
    run().then(
      (data) => alive && setState({ data, loading: false }),
      (e: unknown) => alive && setState((s) => ({ ...s, loading: false, error: e instanceof Error ? e.message : "Veri yüklenemedi." })),
    );
    return () => {
      alive = false;
    };
  }, [key, v]);
  return state;
}
