import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireBusiness } from "@/lib/session";
import { recurringToValues } from "@/lib/recurring-values";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/badge";
import { RecurringForm } from "@/components/app/recurring-form";

export const metadata = { title: "Edit recurring invoice" };

export default async function Page({ params }: { params: { id: string } }) {
  const { business } = await requireBusiness();
  const r = await db.recurringInvoice.findFirst({ where: { id: params.id, businessId: business.id } });
  if (!r) notFound();
  const customers = await db.customer.findMany({ where: { businessId: business.id }, orderBy: { name: "asc" } });
  return (
    <>
      <PageHeader title={<span className="flex items-center gap-3">{r.name} <StatusBadge status={r.status} /></span>} description={`${r.generatedCount} invoice(s) generated so far.`} />
      <RecurringForm id={r.id} customers={customers} initial={recurringToValues(r)} />
    </>
  );
}
