"use client";

import { useEffect, useState } from "react";

// Form kapanınca kaybolan başarı mesajlarını birkaç saniye ekranda gösterir.
// İsteğe bağlı tek eylem ("Geri al") verilebilir; o zaman mesaj daha uzun kalır.
type ToastAction = { label: string; run: () => void };
type Toast = { message: string; action?: ToastAction };
type Listener = (t: Toast) => void;
const listeners = new Set<Listener>();

export function showToast(message: string, action?: ToastAction) {
  for (const l of listeners) l({ message, action });
}

export function Toaster() {
  const [toast, setToast] = useState<Toast>();
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const l: Listener = (t) => {
      setToast(t);
      clearTimeout(timer);
      timer = setTimeout(() => setToast(undefined), t.action ? 8000 : 5000);
    };
    listeners.add(l);
    return () => {
      listeners.delete(l);
      clearTimeout(timer);
    };
  }, []);
  if (!toast) return null;
  return (
    <div
      role="status"
      className="fixed inset-x-4 bottom-20 z-[2100] mx-auto flex max-w-md items-center justify-between gap-3 rounded-md bg-ink px-4 py-3 text-[15px] text-white shadow-lg md:bottom-6"
    >
      <span>{toast.message}</span>
      {toast.action && (
        <button
          type="button"
          onClick={() => {
            toast.action?.run();
            setToast(undefined);
          }}
          className="min-h-10 shrink-0 rounded-md bg-white/15 px-3 font-semibold text-white"
        >
          {toast.action.label}
        </button>
      )}
    </div>
  );
}
