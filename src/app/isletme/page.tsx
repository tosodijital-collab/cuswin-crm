"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { LoadState } from "@/components/ui";
import { BusinessDetailScreen } from "./detay";

function WithId() {
  const id = useSearchParams().get("id");
  return id ? <BusinessDetailScreen id={id} /> : <LoadState error="İşletme seçilmedi." />;
}

export default function BusinessPage() {
  return (
    <Suspense fallback={<LoadState />}>
      <WithId />
    </Suspense>
  );
}
