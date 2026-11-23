import Link from "next/link";
import { ArrowDownLeft, ArrowUpRight, FilePlus2, Receipt, UserPlus, TrendingUp, Wallet, AlertTriangle, CheckCircle2, Clock, CircleDollarSign, FileText } from "lucide-react";
import { db } from "@/lib/db";
import { requireBusiness } from "@/lib/session";
import { refreshOverdue } from "@/lib/invoices";
import { runRecurringInvoices } from "@/lib/recurring";
import { getFinancials, getInvoiceStatusSummary, usedCurrencies } from "@/lib/reports";
import { formatMoney } from "@/lib/money";
import { formatDate, monthLabel, resolveRange, toInputDate } from "@/lib/dates";
import { Card, CardHeader } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/page-header";
import { StatCard } from "@/components/app/stat-card";
import { RangeFilters } from "@/components/app/filters";
import { ExpenseChart, RankedBars, RevenueChart } from "@/components/app/charts";

export const metadata = { title: "Dashboard" };

export default async function Dashboard({ searchParams }: { searchParams: { range?: string; from?: string; to?: string; currency?: string } }) {
  const { user, business } = await requireBusiness();
  // Opportunistic catch-up in case the cron hasn't run (idempotent).
  await runRecurringInvoices({ businessId: business.id });
  await refreshOverdue(business.id);

  const range = resolveRange(searchParams.range, searchParams.from, searchParams.to);
  const currencies = await usedCurrencies(business.id, business.currency);
  const currency = currencies.includes(searchParams.currency ?? "") ? searchParams.currency! : business.currency;

  const [fin, status, recentInvoices, recentPayments, recentExpenses] = await Promise.all([
    getFinancials(business.id, currency, range.from, range.to),
    getInvoiceStatusSummary(business.id, currency),
    db.invoice.findMany({ where: { businessId: business.id }, include: { customer: { select: { name: true, company: true } } }, orderBy: { createdAt: "desc" }, take: 6 }),
    db.payment.findMany({ where: { businessId: business.id, status: "COMPLETED" }, include: { invoice: { select: { id: true, number: true, customer: { select: { name: true, company: true } } } } }, orderBy: { date: "desc" }, take: 8 }),
    db.expense.findMany({ where: { businessId: business.id }, include: { category: true }, orderBy: { date: "desc" }, take: 8 }),
  ]);

  const series = fin.series.map((s) => ({ ...s, label: monthLabel(s.month) }));
  const transactions = [
    ...recentPayments.map((p) => ({ id: `p${p.id}`, type: "in" as const, date: p.date, title: `Payment · ${p.invoice.number}`, sub: p.invoice.customer?.company || p.invoice.customer?.name || "", amount: p.amount, currency: p.currency, href: `/invoices/${p.invoice.id}` })),
    ...recentExpenses.map((e) => ({ id: `e${e.id}`, type: "out" as const, date: e.date, title: e.description, sub: e.category?.name ?? e.vendor ?? "Expense", amount: e.amount, currency: e.currency, href: `/expenses/${e.id}/edit` })),
  ].sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, 8);

  const hour = new Date().getHours();
  const greet = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const margin = fin.collected ? Math.round((fin.netProfit / fin.collected) * 100) : 0;

  return (
    <>
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{greet}{user.name ? `, ${user.name.split(" ")[0]}` : ""}</h1>
          <p className="mt-1 text-sm text-subtle">Here&apos;s how {business.name} is doing · {formatDate(range.from)} – {formatDate(range.to)}</p>
        </div>
        <RangeFilters preset={range.preset} from={toInputDate(range.from)} to={toInputDate(range.to)} currency={currency} currencies={currencies} />
      </div>

      <div className="mb-6 grid grid-cols-3 gap-3">
        {[
          { href: "/invoices/new", icon: FilePlus2, label: "Create invoice", sub: "Bill a customer" },
          { href: "/expenses/new", icon: Receipt, label: "Add expense", sub: "Log a purchase" },
          { href: "/customers?new=1", icon: UserPlus, label: "Add customer", sub: "Grow your client list" },
        ].map((q) => (
          <Link key={q.href} href={q.href} className="card group flex flex-col items-center gap-2 p-3 text-center transition sm:flex-row sm:gap-3 sm:p-4 sm:text-left hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-pop">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-soft text-brand transition group-hover:bg-brand group-hover:text-white"><q.icon size={18} /></span>
            <span><span className="block text-xs font-medium sm:text-sm">{q.label}</span><span className="hidden text-xs text-subtle sm:block">{q.sub}</span></span>
          </Link>
        ))}
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard label="Total revenue (collected)" value={formatMoney(fin.collected, currency)} sub={`${formatMoney(fin.invoiced, currency)} invoiced in period`} icon={<TrendingUp size={16} />} />
        <StatCard label="Total expenses" value={formatMoney(fin.expenseTotal, currency)} sub={`${formatMoney(fin.expenseTax, currency)} tax paid`} icon={<Wallet size={16} />} tone="warning" />
        <StatCard label="Net profit" value={formatMoney(fin.netProfit, currency)} sub={fin.collected ? `${margin}% margin on collected revenue` : "Revenue collected minus expenses"} icon={<CircleDollarSign size={16} />} tone={fin.netProfit >= 0 ? "success" : "danger"} />
        <StatCard href="/invoices?status=open" label="Outstanding invoices" value={formatMoney(status.outstanding, currency)} sub={`${status.outstandingCount} open invoice${status.outstandingCount === 1 ? "" : "s"}`} icon={<Clock size={16} />} />
        <StatCard href="/invoices?status=PAID" label="Paid invoices" value={formatMoney(status.paid, currency)} sub={`${status.paidCount} paid in full (all time)`} icon={<CheckCircle2 size={16} />} tone="success" />
        <StatCard href="/invoices?status=OVERDUE" label="Overdue invoices" value={formatMoney(status.overdue, currency)} sub={`${status.overdueCount} past due date`} icon={<AlertTriangle size={16} />} tone="danger" />
      </div>

      <div className="mb-6 grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader title="Monthly revenue" description="Payments collected vs. amount invoiced" />
          <div className="p-4"><RevenueChart data={series} currency={currency} /></div>
        </Card>
        <Card>
          <CardHeader title="Monthly expenses" description={`${formatMoney(fin.expenseTotal, currency)} across ${fin.byCategory.length} categor${fin.byCategory.length === 1 ? "y" : "ies"}`} />
          <div className="p-4"><ExpenseChart data={series} currency={currency} /></div>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Recent invoices" action={<Link href="/invoices" className="text-xs font-medium text-brand hover:underline">View all</Link>} />
          {recentInvoices.length === 0 ? <EmptyState icon={<FileText size={22} />} title="No invoices yet" action={<Link href="/invoices/new" className="text-sm font-medium text-brand">Create your first invoice →</Link>} /> : (
            <div className="overflow-x-auto">
              <table className="table-base">
                <thead><tr><th>Invoice</th><th>Customer</th><th className="hidden sm:table-cell">Due</th><th>Status</th><th className="text-right">Amount</th></tr></thead>
                <tbody>
                  {recentInvoices.map((i) => (
                    <tr key={i.id}>
                      <td><Link href={`/invoices/${i.id}`} className="font-medium hover:text-brand">{i.number}</Link></td>
                      <td className="max-w-[180px] truncate text-subtle">{i.customer ? i.customer.company || i.customer.name : "—"}</td>
                      <td className="hidden text-subtle sm:table-cell">{formatDate(i.dueDate)}</td>
                      <td><StatusBadge status={i.status} /></td>
                      <td className="num text-right font-medium">{formatMoney(i.total, i.currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
        <Card>
          <CardHeader title="Recent transactions" description="Money in and out" />
          {transactions.length === 0 ? <p className="p-8 text-center text-sm text-subtle">No transactions yet.</p> : (
            <ul className="divide-y">
              {transactions.map((t) => (
                <li key={t.id}>
                  <Link href={t.href} className="flex items-center gap-3 px-5 py-3 transition hover:bg-muted/50">
                    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${t.type === "in" ? "bg-success/10 text-success" : "bg-muted text-subtle"}`}>
                      {t.type === "in" ? <ArrowDownLeft size={15} /> : <ArrowUpRight size={15} />}
                    </span>
                    <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{t.title}</span><span className="block truncate text-xs text-subtle">{t.sub} · {formatDate(t.date)}</span></span>
                    <span className={`num text-sm font-medium ${t.type === "in" ? "text-success" : ""}`}>{t.type === "in" ? "+" : "−"}{formatMoney(t.amount, t.currency)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {fin.byCategory.length > 0 && (
        <Card className="mt-6">
          <CardHeader title="Spending by category" description="Selected period" />
          <div className="p-5"><RankedBars rows={fin.byCategory.slice(0, 8)} currency={currency} /></div>
        </Card>
      )}
    </>
  );
}
