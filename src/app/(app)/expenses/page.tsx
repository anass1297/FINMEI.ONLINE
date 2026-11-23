import Link from "next/link";
import { Receipt, Plus, Paperclip, Download } from "lucide-react";
import { db } from "@/lib/db";
import { requireBusiness } from "@/lib/session";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/dates";
import { expenseWhere, type ExpenseSearch } from "@/lib/expense-filters";
import { PageHeader, EmptyState } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/button";
import { DeleteExpense } from "./delete";

export const metadata = { title: "Expenses" };

export default async function Page({ searchParams }: { searchParams: ExpenseSearch }) {
  const { business } = await requireBusiness();
  const where = expenseWhere(business.id, searchParams);
  const [expenses, categories, totals] = await Promise.all([
    db.expense.findMany({ where, include: { category: true, _count: { select: { attachments: true } } }, orderBy: { date: "desc" }, take: 500 }),
    db.expenseCategory.findMany({ where: { businessId: business.id }, orderBy: { name: "asc" } }),
    db.expense.groupBy({ by: ["currency"], where, _sum: { amount: true, taxAmount: true }, _count: true }),
  ]);
  const qs = new URLSearchParams(Object.entries(searchParams).filter(([, v]) => v) as [string, string][]).toString();

  return (
    <>
      <PageHeader title="Expenses" description="Track spending, attach receipts and keep tax records tidy."
        actions={<>
          <a href={`/api/expenses/export?format=csv&${qs}`} className="inline-flex h-9 items-center gap-2 rounded-lg border bg-surface px-3 text-sm font-medium hover:bg-muted"><Download size={15} /> CSV</a>
          <a href={`/api/expenses/export?format=pdf&${qs}`} className="inline-flex h-9 items-center gap-2 rounded-lg border bg-surface px-3 text-sm font-medium hover:bg-muted"><Download size={15} /> PDF</a>
          <LinkButton href="/expenses/new"><Plus size={16} /> Add expense</LinkButton>
        </>} />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        {(totals.length ? totals : [{ currency: business.currency, _sum: { amount: 0, taxAmount: 0 }, _count: 0 }]).map((t) => (
          <Card key={t.currency} className="p-5">
            <p className="text-xs font-medium text-subtle">Total spent ({t.currency}) · {t._count} expense{t._count === 1 ? "" : "s"}</p>
            <p className="num mt-2 text-xl font-semibold">{formatMoney(t._sum.amount ?? 0, t.currency)}</p>
            <p className="num mt-1 text-xs text-subtle">incl. {formatMoney(t._sum.taxAmount ?? 0, t.currency)} tax</p>
          </Card>
        ))}
      </div>

      <Card>
        <form className="grid gap-3 border-b p-3 sm:grid-cols-2 lg:grid-cols-[1fr_160px_160px_200px_auto]">
          <input name="q" defaultValue={searchParams.q} placeholder="Search description or vendor" className="input" />
          <input type="date" name="from" defaultValue={searchParams.from} className="input" aria-label="From date" />
          <input type="date" name="to" defaultValue={searchParams.to} className="input" aria-label="To date" />
          <select name="category" defaultValue={searchParams.category ?? ""} className="input">
            <option value="">All categories</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            <option value="none">Uncategorized</option>
          </select>
          <div className="flex gap-2">
            <button className="h-9 rounded-lg bg-fg px-4 text-sm font-medium text-bg">Filter</button>
            {qs && <Link href="/expenses" className="flex h-9 items-center rounded-lg px-3 text-sm text-subtle hover:bg-muted">Reset</Link>}
          </div>
        </form>
        {expenses.length === 0 ? (
          <EmptyState icon={<Receipt size={22} />} title={qs ? "No expenses match your filters" : "No expenses yet"} description="Record purchases and upload receipts as you go." action={<LinkButton href="/expenses/new"><Plus size={16} /> Add expense</LinkButton>} />
        ) : (
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead><tr><th>Date</th><th>Description</th><th className="hidden md:table-cell">Vendor</th><th className="hidden sm:table-cell">Category</th><th className="text-right">Amount</th><th className="hidden text-right lg:table-cell">Tax</th><th className="w-20" /></tr></thead>
              <tbody>
                {expenses.map((e) => (
                  <tr key={e.id}>
                    <td className="text-subtle">{formatDate(e.date)}</td>
                    <td className="max-w-[260px]">
                      <Link href={`/expenses/${e.id}/edit`} className="flex items-center gap-2 font-medium hover:text-brand"><span className="truncate">{e.description}</span>{e._count.attachments > 0 && <Paperclip size={13} className="shrink-0 text-subtle" />}</Link>
                    </td>
                    <td className="hidden text-subtle md:table-cell">{e.vendor || "—"}</td>
                    <td className="hidden sm:table-cell">{e.category ? <span className="inline-flex items-center gap-1.5 text-xs"><span className="h-2 w-2 rounded-full" style={{ background: e.category.color }} />{e.category.name}</span> : <span className="text-xs text-subtle">Uncategorized</span>}</td>
                    <td className="num text-right font-medium">{formatMoney(e.amount, e.currency)}</td>
                    <td className="num hidden text-right text-subtle lg:table-cell">{formatMoney(e.taxAmount, e.currency)}</td>
                    <td className="text-right"><DeleteExpense id={e.id} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
