import { CALL_STATUSES, CATEGORIES, SALES_STAGES, SOURCES } from "@/lib/domain/types";
import type { BusinessFilters } from "./repository";

type Params = Record<string, string | string[] | undefined>;

function pick<T extends string>(value: unknown, allowed: readonly T[]): T | undefined {
  return typeof value === "string" && (allowed as readonly string[]).includes(value) ? (value as T) : undefined;
}

/** URL parametrelerini doğrular; tanınmayan değerler yok sayılır. */
export function parseBusinessFilters(params: Params): BusinessFilters {
  const q = typeof params.q === "string" ? params.q.slice(0, 100) : undefined;
  const district = typeof params.ilce === "string" ? params.ilce.slice(0, 60) : undefined;
  return {
    q: q || undefined,
    category: pick(params.kategori, CATEGORIES),
    district: district || undefined,
    callStatus: pick(params.durum, CALL_STATUSES),
    salesStage: pick(params.asama, SALES_STAGES),
    source: pick(params.kaynak, SOURCES),
    needsReview: params.kontrol === "1" || undefined,
  };
}
