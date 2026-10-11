import { getBrowserSupabase, isSupabaseConfigured } from "@/lib/supabase/client";
import { getDemoRepository } from "./memory-store";
import type { CrmRepository } from "./repository";
import { SupabaseRepository } from "./supabase-repository";

let repo: CrmRepository | undefined;

/** Supabase ayarlıysa gerçek depo (oturum + RLS), değilse tarayıcıda demo deposu. */
export function getRepository(): CrmRepository {
  repo ??= isSupabaseConfigured() ? new SupabaseRepository(getBrowserSupabase()) : getDemoRepository();
  return repo;
}

export type * from "./repository";
