"use client";

import { useEffect, useState } from "react";

const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const current = process.env.NEXT_PUBLIC_BUILD_ID ?? "";
const RELOADED_KEY = "cuswin-yenilendi";

async function latestId(): Promise<string | undefined> {
  try {
    // Sorgu dizesi hem tarayıcı hem GitHub Pages önbelleğini atlar.
    const res = await fetch(`${base}/version.json?t=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) return undefined;
    const { id } = (await res.json()) as { id?: string };
    return id || undefined;
  } catch {
    return undefined;
  }
}

/** Sayfayı önbelleği atlayarak yeniden yükler; aynı sürüm için bir kez (döngüye girmesin). */
function reloadTo(id: string): boolean {
  try {
    if (sessionStorage.getItem(RELOADED_KEY) === id) return false;
    sessionStorage.setItem(RELOADED_KEY, id);
  } catch {
    // Depolama kapalıysa da bir kez yenilemeyi dene.
  }
  const url = new URL(window.location.href);
  url.searchParams.set("v", id);
  window.location.replace(url.toString());
  return true;
}

/**
 * Yeni sürüm yayınlandıysa: uygulama açılırken kendiliğinden yenilenir. Kullanım sırasında (ör. form doldururken)
 * bulunursa sayfa bozulmasın diye yalnızca "Yenile" çubuğu gösterilir.
 */
export function UpdateChecker() {
  const [newId, setNewId] = useState<string>();

  useEffect(() => {
    if (!current || current.startsWith("yerel-")) return;
    let alive = true;
    const check = async (onOpen: boolean) => {
      const id = await latestId();
      if (!alive || !id || id === current) return;
      if (onOpen && reloadTo(id)) return;
      setNewId(id);
    };
    void check(true);
    const onVisible = () => document.visibilityState === "visible" && void check(false);
    document.addEventListener("visibilitychange", onVisible);
    const timer = window.setInterval(() => void check(false), 10 * 60_000);
    return () => {
      alive = false;
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(timer);
    };
  }, []);

  if (!newId) return null;
  return (
    <div className="fixed inset-x-4 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-30 mx-auto flex max-w-md items-center justify-between gap-3 rounded-lg bg-ink px-4 py-3 text-[15px] text-white shadow-lg md:bottom-4">
      <span>Uygulamanın yeni sürümü hazır.</span>
      <button
        type="button"
        onClick={() => {
          try {
            sessionStorage.removeItem(RELOADED_KEY);
          } catch {}
          reloadTo(newId);
        }}
        className="shrink-0 rounded-md bg-white px-3 py-1.5 font-medium text-ink"
      >
        Yenile
      </button>
    </div>
  );
}
