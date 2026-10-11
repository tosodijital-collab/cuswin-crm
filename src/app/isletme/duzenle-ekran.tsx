"use client";

import Link from "next/link";
import { BusinessForm } from "@/components/business-form";
import { LoadState, PageTitle } from "@/components/ui";
import { useData } from "@/lib/client/refresh";
import { getRepository } from "@/lib/data";

export function EditBusinessScreen({ id }: { id: string }) {
  const { data: detail, error, loading } = useData(() => getRepository().getBusiness(id), id);
  if (loading || error) return <LoadState error={error} />;
  if (!detail) return <LoadState error="İşletme bulunamadı." />;
  return (
    <div>
      <Link href={`/isletme?id=${id}`} className="text-sm text-muted hover:text-ink">
        {detail.business.name}
      </Link>
      <PageTitle>Bilgileri düzenle</PageTitle>
      <BusinessForm business={detail.business} />
    </div>
  );
}
