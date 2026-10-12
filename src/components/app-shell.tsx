"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { getBrowserSupabase, isSupabaseConfigured } from "@/lib/supabase/client";
import { MainNav } from "./main-nav";
import { Toaster } from "./toast";

type AuthState = "yukleniyor" | "giris" | "hazir" | "yetkisiz";

/** Oturum kapısı: oturum yoksa giriş sayfasına yönlendirir. Asıl koruma veritabanındaki RLS kurallarıdır. */
export function AppShell({ children }: { children: ReactNode }) {
  const configured = isSupabaseConfigured();
  const pathname = usePathname();
  const router = useRouter();
  const [auth, setAuth] = useState<AuthState>(configured ? "yukleniyor" : "hazir");
  const isLogin = pathname.startsWith("/giris");

  useEffect(() => {
    if (!configured) return;
    const sb = getBrowserSupabase();
    const check = async (userId: string | undefined) => {
      if (!userId) return setAuth("giris");
      const { data } = await sb.from("app_owner").select("user_id").eq("user_id", userId);
      setAuth(data?.length ? "hazir" : "yetkisiz");
    };
    sb.auth.getSession().then(({ data }) => check(data.session?.user.id));
    // Supabase önerisi: dinleyici içinde doğrudan istek atmayın; bir sonraki tura erteleyin.
    const { data: sub } = sb.auth.onAuthStateChange((_event, session) => {
      setTimeout(() => check(session?.user.id), 0);
    });
    return () => sub.subscription.unsubscribe();
  }, [configured]);

  useEffect(() => {
    if (auth === "giris" && !isLogin) router.replace("/giris");
    if (auth === "hazir" && isLogin) router.replace("/");
  }, [auth, isLogin, router]);

  if (isLogin) return <main className="mx-auto w-full max-w-sm px-4 pt-16">{children}</main>;

  return (
    <>
      {!configured && (
        <div className="border-b border-late/30 bg-late-soft px-4 py-1.5 text-center text-sm text-late">
          Demo verisi gösteriliyor. Kayıtlar uydurmadır ve sayfa yenilenince sıfırlanır.
        </div>
      )}
      <MainNav showSignOut={configured && auth === "hazir"} />
      <main className="mx-auto w-full max-w-6xl px-4 pb-28 pt-5 md:pb-12">
        {auth === "hazir" ? (
          children
        ) : auth === "yetkisiz" ? (
          <p className="text-[15px] text-stop">Bu hesabın uygulamaya erişim izni yok.</p>
        ) : (
          <p className="text-[15px] text-muted">Yükleniyor</p>
        )}
      </main>
      <Toaster />
    </>
  );
}
