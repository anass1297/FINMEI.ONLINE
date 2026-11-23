import { db } from "@/lib/db";
import { requireBusiness } from "@/lib/session";
import { previewNextNumber } from "@/lib/invoices";
import { toDocBusiness } from "@/lib/invoice-view";
import { defaultEditorState } from "@/lib/editor-state";
import { PageHeader } from "@/components/ui/page-header";
import { InvoiceEditor } from "@/components/app/invoice-editor";

export const metadata = { title: "New invoice" };

export default async function Page({ searchParams }: { searchParams: { customer?: string } }) {
  const { business } = await requireBusiness();
  const [customers, nextNumber] = await Promise.all([
    db.customer.findMany({ where: { businessId: business.id }, orderBy: { name: "asc" } }),
    previewNextNumber(business.id),
  ]);
  const pre = customers.find((c) => c.id === searchParams.customer);
  return (
    <>
      <PageHeader title="New invoice" description={`Will be numbered ${nextNumber} unless you set one.`} />
      <InvoiceEditor business={toDocBusiness(business)} customers={customers} nextNumber={nextNumber} defaultTaxRate={business.defaultTaxRate}
        initial={defaultEditorState(business, pre?.id ?? "", pre?.currency ?? undefined)} />
    </>
  );
}
