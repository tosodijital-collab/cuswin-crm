"use client";

import { useRouter } from "next/navigation";
import { useActionState } from "react";
import { buttonClass, FieldLabel, FormMessage, inputClass } from "@/components/ui";
import { getBrowserSupabase, isSupabaseConfigured } from "@/lib/supabase/client";

type State = { ok: boolean; message?: string };

export default function LoginPage() {
  const router = useRouter();
  const [state, action, pending] = useActionState<State, FormData>(async (_, formData) => {
    if (!isSupabaseConfigured()) return { ok: false, message: "Veritabanı ayarlı değil." };
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");
    if (!email || !password) return { ok: false, message: "E-posta ve şifre girin." };
    const { error } = await getBrowserSupabase().auth.signInWithPassword({ email, password });
    if (error) return { ok: false, message: "E-posta veya şifre hatalı." };
    router.replace("/");
    return { ok: true };
  }, { ok: false });

  return (
    <div>
      <h1 className="mb-1 text-2xl font-semibold tracking-tight">
        Cuswin <span className="font-normal text-muted">Arama</span>
      </h1>
      <p className="mb-6 text-[15px] text-muted">Devam etmek için giriş yapın.</p>
      <form action={action} className="grid gap-4">
        <div>
          <FieldLabel htmlFor="email">E-posta</FieldLabel>
          <input id="email" name="email" type="email" autoComplete="email" required className={inputClass} />
        </div>
        <div>
          <FieldLabel htmlFor="password">Şifre</FieldLabel>
          <input id="password" name="password" type="password" autoComplete="current-password" required className={inputClass} />
        </div>
        <button type="submit" disabled={pending} className={buttonClass.primary}>
          {pending ? "Giriş yapılıyor" : "Giriş yap"}
        </button>
        <FormMessage state={state} />
      </form>
    </div>
  );
}
