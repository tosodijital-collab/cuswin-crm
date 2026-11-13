"use client";

// Rehber ekranının "Dosyalar" bölümü.

import { CopyMessageButton, materialHref, ShareMaterialButton, useMaterialMessage } from "@/components/share-material";
import { Panel } from "@/components/ui";
import { MATERIALS, type Material } from "@/lib/domain/materials";

const btn =
  "inline-flex min-h-11 items-center justify-center whitespace-nowrap rounded-md border border-line px-3 text-[15px] font-medium hover:bg-paper";

/** Müşteriye gönderilecek PDF'ler: paylaş, aç, mesajı kopyala. */
export function MaterialsList() {
  return (
    <div>
      <p className="mb-4 max-w-2xl text-[15px] text-muted">
        Kliniğe göndermek için kartta &quot;Sonuç → Bilgi istedi&quot; ya da işletme sayfasındaki &quot;WhatsApp&apos;ta gönder&quot;i kullan: numara
        kaydetmeden sohbet açılır, PDF mesajda link olarak gider. &quot;Paylaş&quot; telefonun paylaşım penceresini açar (rehberdeki kişiler için).
      </p>

      <div className="grid gap-4 md:grid-cols-2">
        {MATERIALS.map((m) => (
          <Panel key={m.id} className="flex flex-col p-4">
            <h2 className="flex items-baseline justify-between gap-3 text-[17px] font-semibold">
              {m.title}
              <span className="shrink-0 text-sm font-normal text-muted">{m.pages}</span>
            </h2>
            <p className="mt-1 text-[15px]">
              <span className="text-muted">Ne zaman: </span>
              {m.when}
            </p>
            <details className="mt-3 rounded-md bg-paper px-3 py-2">
              <summary className="cursor-pointer text-sm font-medium text-muted">Hazır mesaj</summary>
              <MessageText material={m} />
            </details>
            <div className="mt-4 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
              <ShareMaterialButton material={m} className={`${btn} col-span-2 border-ink bg-ink text-white hover:bg-ink/90`} />
              <a href={materialHref(m)} target="_blank" rel="noopener noreferrer" className={btn}>
                Aç
              </a>
              <CopyMaterialMessage material={m} className={btn} />
            </div>
          </Panel>
        ))}
      </div>

      <Panel className="mt-6 p-4">
        <h2 className="text-[17px] font-semibold">Hangi durumda hangisi?</h2>
        <ul className="mt-2 grid gap-1.5 text-[15px]">
          <li>
            <strong className="font-medium">Kapıda:</strong> basılı broşürü bırak, aynı gün tanıtım dosyasını gönder.
          </li>
          <li>
            <strong className="font-medium">Demodan sonra &quot;teklif gönderin&quot;:</strong> doldurulmuş teklif ve tanıtım dosyası.
          </li>
          <li>
            <strong className="font-medium">Fuarda:</strong> broşürü elden ver, aynı gün WhatsApp&apos;tan da gönder.
          </li>
          <li>
            <strong className="font-medium">Ajans:</strong> iş ortaklığı dosyası.
          </li>
        </ul>
      </Panel>
    </div>
  );
}


function MessageText({ material }: { material: Material }) {
  return <p className="mt-2 whitespace-pre-line text-[15px]">{useMaterialMessage(material)}</p>;
}

function CopyMaterialMessage({ material, className }: { material: Material; className: string }) {
  return <CopyMessageButton text={useMaterialMessage(material)} className={className} />;
}
