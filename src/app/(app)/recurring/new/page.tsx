import { db } from "@/lib/db";
import { requireBusiness } from "@/lib/session";
import { toInputDate } from "@/lib/dates";
import { PageHeader } from "@/components/ui/page-header";
import { RecurringForm } from "@/components/app/recurring-form";

export const metadata = { title: "New recurring invoice" };

export default async function Page() {
  const { business } = await requireBusiness();
  const customers = await db.customer.findMany({ where: { businessId: business.id }, orderBy: { name: "asc" } });
  return (
    <>
      <PageHeader title="New recurring invoice" />
      <RecurringForm customers={customers} initial={{
        name: "", customerId: "", frequency: "MONTHLY", intervalCount: "1", intervalUnit: "MONTH", startDate: toInputDate(new Date()),
        endMode: "never", endDate: "", maxOccurrences: "12", paymentDays: String(business.defaultPaymentDays), currency: business.currency,
        discountType: "percent", discountValue: "", autoSend: false, notes: business.defaultNotes ?? "", terms: business.defaultTerms ?? "",
        items: [{ description: "", quantity: "1", unitPrice: "", taxRate: business.defaultTaxRate ? String(business.defaultTaxRate) : "" }],
      }} />
    </>
  );
}
