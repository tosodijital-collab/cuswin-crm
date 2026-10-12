"use client";

import { useEffect, useState } from "react";

// Form kapanınca kaybolan başarı mesajlarını birkaç saniye ekranda gösterir.
type Listener = (message: string) => void;
const listeners = new Set<Listener>();

export function showToast(message: string) {
  for (const l of listeners) l(message);
}

export function Toaster() {
  const [message, setMessage] = useState<string>();
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const l: Listener = (m) => {
      setMessage(m);
      clearTimeout(timer);
      timer = setTimeout(() => setMessage(undefined), 5000);
    };
    listeners.add(l);
    return () => {
      listeners.delete(l);
      clearTimeout(timer);
    };
  }, []);
  if (!message) return null;
  return (
    <div
      role="status"
      className="fixed inset-x-4 bottom-20 z-30 mx-auto max-w-md rounded-md bg-ink px-4 py-3 text-[15px] text-white shadow-lg md:bottom-6"
    >
      {message}
    </div>
  );
}
