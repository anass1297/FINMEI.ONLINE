import { db } from "@/lib/db";
import { requireBusiness } from "@/lib/session";
import { toInputDate } from "@/lib/dates";
import { PageHeader } from "@/components/ui/page-header";
import { ExpenseForm } from "@/components/app/expense-form";

export const metadata = { title: "Add expense" };

export default async function Page() {
  const { business } = await requireBusiness();
  const categories = await db.expenseCategory.findMany({ where: { businessId: business.id }, orderBy: { name: "asc" } });
  return (
    <>
      <PageHeader title="Add expense" />
      <ExpenseForm categories={categories} initial={{ description: "", vendor: "", categoryId: "", date: toInputDate(new Date()), amount: "", currency: business.currency, taxRate: "", notes: "" }} />
    </>
  );
}
