"use client";

import { showToast } from "@/components/toast";
import { undoLastCallAction } from "@/lib/actions";

/** Son arama sonucunu geri alır ve sonucu bildirir. */
export async function undoLastCall(businessId: string) {
  const r = await undoLastCallAction(businessId);
  if (r.message) showToast(r.message);
}

/** Sonuç kaydedildi bildirimi, yanında "Geri al". */
export function savedWithUndo(message: string, businessId: string) {
  showToast(message, { label: "Geri al", run: () => void undoLastCall(businessId) });
}
