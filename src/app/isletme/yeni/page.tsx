import { BusinessForm } from "@/components/business-form";
import { PageTitle } from "@/components/ui";

export default function NewBusinessPage() {
  return (
    <div>
      <PageTitle>İşletme ekle</PageTitle>
      <p className="mb-5 max-w-2xl text-[15px] text-muted">
        Aynı telefon veya web sitesiyle kayıtlı bir işletme varsa ekleme engellenir. Telefonu ya da kategorisi
        olmayan kayıtlar kontrol listesine düşer ve günlük listeye girmez.
      </p>
      <BusinessForm />
    </div>
  );
}
