"use client";

import { salesFunnel } from "@/lib/domain/sales-playbook";
import type { Business } from "@/lib/domain/types";

/** Satış hunisi: aşamaya ulaşan klinik sayısı ve bir önceki adımdan geçiş oranı. */
export function Funnel({ businesses }: { businesses: Business[] }) {
  const f = salesFunnel(businesses);
  return (
    <section aria-label="Satış hunisi" className="mb-4 rounded-lg border border-line bg-surface px-4 py-3">
      <p className="flex justify-between text-sm text-muted">
        <span>Satış hunisi · {f.total} klinik</span>
        {f.lost > 0 && <span>{f.lost} olumsuz</span>}
      </p>
      <ol className="mt-2 grid grid-cols-5 gap-1 text-center">
        {f.steps.map((s) => (
          <li key={s.label} className="rounded-md bg-paper px-1 py-1.5">
            <span className="block text-lg font-semibold tabular-nums">{s.count}</span>
            <span className="block text-xs text-muted">{s.label}</span>
            {s.rate !== undefined && <span className="block text-xs tabular-nums text-meet">%{s.rate}</span>}
          </li>
        ))}
      </ol>
    </section>
  );
}
