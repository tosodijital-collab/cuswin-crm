"use client";

import { useTransition } from "react";
import { undoLastCall } from "@/lib/client/undo";

/** "Yanlış girdim": son arama sonucunu geri alır; klinik tekrar aranacaklara döner. */
export function UndoButton({ businessId, className }: { businessId: string; className?: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => start(() => undoLastCall(businessId))}
      className={className ?? "min-h-9 text-sm font-medium text-stop underline-offset-2 hover:underline disabled:opacity-50"}
    >
      {pending ? "Geri alınıyor" : "Yanlış girdim, geri al"}
    </button>
  );
}
