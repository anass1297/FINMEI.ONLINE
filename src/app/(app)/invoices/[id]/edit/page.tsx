import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireBusiness } from "@/lib/session";
import { toDocBusiness } from "@/lib/invoice-view";
import { invoiceToEditorState } from "@/lib/editor-state";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/badge";
import { InvoiceEditor } from "@/components/app/invoice-editor";

export const metadata = { title: "Edit invoice" };

export default async function Page({ params }: { params: { id: string } }) {
  const { business } = await requireBusiness();
  const inv = await db.invoice.findFirst({ where: { id: params.id, businessId: business.id }, include: { items: true } });
  if (!inv) notFound();
  if (inv.status === "CANCELLED") redirect(`/invoices/${inv.id}`);
  const customers = await db.customer.findMany({ where: { businessId: business.id }, orderBy: { name: "asc" } });
  return (
    <>
      <PageHeader title={<span className="flex items-center gap-3">Edit {inv.number} <StatusBadge status={inv.status} /></span>} />
      <InvoiceEditor business={toDocBusiness(business)} customers={customers} nextNumber={inv.number} defaultTaxRate={business.defaultTaxRate}
        invoiceId={inv.id} status={inv.status} initial={invoiceToEditorState(inv)} />
    </>
  );
}
