import Link from "next/link";
import { notFound } from "next/navigation";
import { BusinessForm } from "@/components/business-form";
import { PageTitle } from "@/components/ui";
import { getRepository } from "@/lib/data";

export default async function EditBusinessPage({ params }: PageProps<"/isletme/[id]/duzenle">) {
  const { id } = await params;
  const detail = await getRepository().getBusiness(id);
  if (!detail) notFound();
  return (
    <div>
      <Link href={`/isletme/${id}`} className="text-sm text-muted hover:text-ink">
        {detail.business.name}
      </Link>
      <PageTitle>Bilgileri düzenle</PageTitle>
      <BusinessForm business={detail.business} />
    </div>
  );
}
