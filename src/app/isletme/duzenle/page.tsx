"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { LoadState } from "@/components/ui";
import { EditBusinessScreen } from "../duzenle-ekran";

function WithId() {
  const id = useSearchParams().get("id");
  return id ? <EditBusinessScreen id={id} /> : <LoadState error="İşletme seçilmedi." />;
}

export default function EditBusinessPage() {
  return (
    <Suspense fallback={<LoadState />}>
      <WithId />
    </Suspense>
  );
}
