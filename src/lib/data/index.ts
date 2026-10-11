import "server-only";
import { getMemoryRepository } from "./memory-store";
import type { CrmRepository } from "./repository";

/** Şimdilik bellek içi depo (DATA_MODE=demo|yerel). PostgreSQL aşamasında DATABASE_URL varsa gerçek depo döner. */
export function getRepository(): CrmRepository {
  return getMemoryRepository();
}

export type * from "./repository";
