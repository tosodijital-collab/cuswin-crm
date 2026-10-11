"use client";

import { useActionState, useState } from "react";
import { saveBusinessAction, type ActionState } from "@/app/actions";
import { ANKARA_DISTRICTS, CATEGORY_LABELS } from "@/lib/domain/labels";
import { CATEGORIES, type Business } from "@/lib/domain/types";
import { buttonClass, FieldLabel, FormMessage, inputClass } from "./ui";

export function BusinessForm({ business }: { business?: Business }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(saveBusinessAction, { ok: false });
  const [contacts, setContacts] = useState(
    business?.contacts.length ? business.contacts.map((c) => ({ name: c.name, role: c.role ?? "" })) : [],
  );

  return (
    <form action={action} className="grid max-w-2xl gap-4">
      {business && <input type="hidden" name="id" value={business.id} />}
      <div>
        <FieldLabel htmlFor="name">İşletme / klinik adı</FieldLabel>
        <input id="name" name="name" required minLength={2} maxLength={200} defaultValue={business?.name} className={inputClass} />
      </div>
      <fieldset>
        <legend className="mb-1 text-sm font-medium text-muted">Hizmet kategorileri</legend>
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          {CATEGORIES.map((c) => (
            <label key={c} className="flex items-center gap-2 text-[15px]">
              <input
                type="checkbox"
                name="categories"
                value={c}
                defaultChecked={business?.categories.includes(c)}
                className="size-4 accent-ink"
              />
              {CATEGORY_LABELS[c]}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <FieldLabel htmlFor="phone">İşletme telefonu</FieldLabel>
          <input id="phone" name="phone" type="tel" inputMode="tel" maxLength={40} defaultValue={business?.phone} placeholder="0312 123 45 67" className={inputClass} />
        </div>
        <div>
          <FieldLabel htmlFor="email">İşletme e-postası</FieldLabel>
          <input id="email" name="email" type="email" maxLength={200} defaultValue={business?.email} className={inputClass} />
        </div>
        <div>
          <FieldLabel htmlFor="website">Web sitesi</FieldLabel>
          <input id="website" name="website" maxLength={300} defaultValue={business?.website} className={inputClass} />
        </div>
        <div>
          <FieldLabel htmlFor="district">İlçe</FieldLabel>
          <select id="district" name="district" defaultValue={business?.district ?? ""} className={inputClass}>
            <option value="">Seçilmedi</option>
            {ANKARA_DISTRICTS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <FieldLabel htmlFor="address">Açık adres</FieldLabel>
        <input id="address" name="address" maxLength={400} defaultValue={business?.address} className={inputClass} />
      </div>
      <fieldset className="grid gap-2">
        <legend className="mb-1 text-sm font-medium text-muted">Doktor veya ilgili kişiler</legend>
        {contacts.map((c, i) => (
          <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2">
            <input
              name="contactName"
              aria-label="Kişi adı"
              placeholder="Ad soyad"
              value={c.name}
              onChange={(e) => setContacts((cs) => cs.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
              className={inputClass}
            />
            <input
              name="contactRole"
              aria-label="Görevi"
              placeholder="Görevi"
              value={c.role}
              onChange={(e) => setContacts((cs) => cs.map((x, j) => (j === i ? { ...x, role: e.target.value } : x)))}
              className={inputClass}
            />
            <button
              type="button"
              onClick={() => setContacts((cs) => cs.filter((_, j) => j !== i))}
              className="px-2 text-sm text-muted hover:text-stop"
            >
              Kaldır
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => setContacts((cs) => [...cs, { name: "", role: "" }])}
          className="justify-self-start text-[15px] font-medium text-meet hover:underline"
        >
          Kişi ekle
        </button>
      </fieldset>
      {business?.reviewReason && (
        <p className="rounded-md bg-late-soft px-3 py-2 text-sm text-late">
          Kaydettiğinizde kontrol uyarısı kaldırılır; telefon veya kategori hâlâ eksikse yeniden işaretlenir.
        </p>
      )}
      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className={buttonClass.primary}>
          {business ? "Değişiklikleri kaydet" : "İşletmeyi ekle"}
        </button>
        <FormMessage state={state} />
      </div>
    </form>
  );
}
