"use client";

import { useEffect, useState } from "react";
import type { Material } from "@/lib/domain/materials";
import { showToast } from "./toast";

const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const build = process.env.NEXT_PUBLIC_BUILD_ID ?? "";

/** Dosyanın yayınlanan adresi; sürüm eki eski PDF'in önbellekten gelmesini önler. */
export function materialHref(m: Material): string {
  return `${base}${m.path}${build ? `?v=${build}` : ""}`;
}

// iOS paylaşım penceresi yalnızca dokunuşun hemen ardından açılır; dosya önceden indirilip burada tutulur.
const files = new Map<string, Promise<File | undefined>>();
function preload(m: Material): Promise<File | undefined> {
  let p = files.get(m.id);
  if (!p) {
    p = fetch(materialHref(m))
      .then((r) => (r.ok ? r.blob() : undefined))
      .then((b) => (b ? new File([b], m.fileName, { type: "application/pdf" }) : undefined))
      .catch(() => undefined);
    files.set(m.id, p);
  }
  return p;
}

async function copy(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/**
 * Telefonun paylaşım penceresini PDF ve hazır mesajla açar (WhatsApp, e-posta, AirDrop...).
 * Dosya paylaşımı desteklenmiyorsa mesajı kopyalar ve PDF'i açar.
 */
export function ShareMaterialButton({
  material,
  label,
  className,
}: {
  material: Material;
  label?: string;
  className: string;
}) {
  const [file, setFile] = useState<File>();
  useEffect(() => {
    let alive = true;
    void preload(material).then((f) => alive && setFile(f));
    return () => {
      alive = false;
    };
  }, [material]);

  const share = async () => {
    const data = { files: file ? [file] : [], text: material.message };
    if (file && typeof navigator.canShare === "function" && navigator.canShare(data)) {
      try {
        await navigator.share(data);
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
        showToast((await copy(material.message)) ? "Paylaşılamadı. Mesaj kopyalandı, PDF'i Dosyalar'dan açabilirsin." : "Paylaşılamadı.");
      }
      return;
    }
    // İkisi de dokunuşun içinde başlamalı (tarayıcı sonradan açılan pencereyi engeller).
    const copied = copy(material.message);
    window.open(materialHref(material), "_blank", "noopener");
    showToast((await copied) ? "Mesaj kopyalandı. PDF açıldı, oradan paylaşabilirsin." : "PDF açıldı, oradan paylaşabilirsin.");
  };

  return (
    <button type="button" onClick={share} className={className}>
      {label ?? "Paylaş"}
    </button>
  );
}

export function CopyMessageButton({ text, className }: { text: string; className: string }) {
  return (
    <button
      type="button"
      onClick={async () => showToast((await copy(text)) ? "Mesaj kopyalandı." : "Kopyalanamadı.")}
      className={className}
    >
      Mesajı kopyala
    </button>
  );
}
