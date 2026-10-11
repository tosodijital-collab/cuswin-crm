import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/** Tarayıcı istemcisi: yayımlanabilir (publishable) anahtar; erişimi RLS kuralları sınırlar. */
let browserClient: SupabaseClient | undefined;

export function isSupabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
}

export function getBrowserSupabase(): SupabaseClient {
  if (!isSupabaseConfigured()) throw new Error("Supabase ayarlı değil.");
  browserClient ??= createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: true, autoRefreshToken: true },
  });
  return browserClient;
}
