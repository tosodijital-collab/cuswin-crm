"use client";

// Gönderilen takip ve teyit mesajlarını not olarak kaydeder; Bugün ekranındaki "Mesaj gönder" listesinden düşer.

import { addNoteAction } from "@/lib/actions";
import { sentNote, type MessageKind } from "@/lib/domain/day-plan";

export function markSent(businessId: string, kind: MessageKind) {
  const f = new FormData();
  f.set("businessId", businessId);
  f.set("note", sentNote(kind));
  void addNoteAction({ ok: false }, f);
}
