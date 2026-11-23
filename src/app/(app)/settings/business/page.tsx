import { db } from "@/lib/db";
import { requireBusiness } from "@/lib/session";
import { PageHeader } from "@/components/ui/page-header";
import { BusinessSettings } from "@/components/app/settings-forms";

export const metadata = { title: "Business settings" };

export default async function Page() {
  const { business } = await requireBusiness();
  const categories = await db.expenseCategory.findMany({ where: { businessId: business.id }, orderBy: { name: "asc" } });
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Business settings" description={`Settings for ${business.name}. Each business is fully separate.`} />
      <BusinessSettings key={business.id} b={business} categories={categories} />
    </div>
  );
}
