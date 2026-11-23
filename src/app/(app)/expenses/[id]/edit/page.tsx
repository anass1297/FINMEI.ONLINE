import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireBusiness } from "@/lib/session";
import { toInputDate } from "@/lib/dates";
import { fromCents } from "@/lib/money";
import { PageHeader } from "@/components/ui/page-header";
import { ExpenseForm } from "@/components/app/expense-form";
import { DeleteExpense } from "../../delete";

export const metadata = { title: "Edit expense" };

export default async function Page({ params }: { params: { id: string } }) {
  const { business } = await requireBusiness();
  const e = await db.expense.findFirst({ where: { id: params.id, businessId: business.id }, include: { attachments: true } });
  if (!e) notFound();
  const categories = await db.expenseCategory.findMany({ where: { businessId: business.id }, orderBy: { name: "asc" } });
  return (
    <>
      <PageHeader title="Edit expense" actions={<DeleteExpense id={e.id} full />} />
      <ExpenseForm categories={categories} attachments={e.attachments} initial={{
        id: e.id, description: e.description, vendor: e.vendor ?? "", categoryId: e.categoryId ?? "", date: toInputDate(e.date),
        amount: String(fromCents(e.amount, e.currency)), currency: e.currency, taxRate: e.taxRate ? String(e.taxRate) : "", notes: e.notes ?? "",
      }} />
    </>
  );
}
