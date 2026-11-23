import { db } from "./db";
import { monthKey, monthsBetween, startOfDay } from "./dates";
import { convertCurrency } from "./currency-convert";

const BILLABLE = { notIn: ["DRAFT", "CANCELLED"] };

export async function getFinancials(businessId: string, currency: string, from: Date, to: Date) {
  const [invoices, payments, expenses] = await Promise.all([
    db.invoice.findMany({
      where: { businessId, status: BILLABLE, issueDate: { gte: from, lte: to } },
      select: { id: true, total: true, amountPaid: true, status: true, issueDate: true, dueDate: true, customerId: true, currency: true },
    }),
    db.payment.findMany({
      where: { businessId, status: "COMPLETED", date: { gte: from, lte: to } },
      select: { amount: true, date: true, currency: true },
    }),
    db.expense.findMany({
      where: { businessId, date: { gte: from, lte: to } },
      select: { amount: true, taxAmount: true, date: true, currency: true, category: { select: { name: true, color: true } } },
    }),
  ]);

  const months = monthsBetween(from, to);
  const series = new Map(months.map((m) => [m, { month: m, invoiced: 0, collected: 0, expenses: 0 }]));
  for (const i of invoices) { const s = series.get(monthKey(i.issueDate)); if (s) s.invoiced += convertCurrency(i.total, i.currency, currency); }
  for (const p of payments) { const s = series.get(monthKey(p.date)); if (s) s.collected += convertCurrency(p.amount, p.currency, currency); }
  for (const e of expenses) { const s = series.get(monthKey(e.date)); if (s) s.expenses += convertCurrency(e.amount, e.currency, currency); }

  const byCategory = new Map<string, { name: string; color: string; amount: number }>();
  for (const e of expenses) {
    const name = e.category?.name ?? "Uncategorized";
    const cur = byCategory.get(name) ?? { name, color: e.category?.color ?? "#94a3b8", amount: 0 };
    cur.amount += convertCurrency(e.amount, e.currency, currency);
    byCategory.set(name, cur);
  }

  const invoiced = invoices.reduce((a, i) => a + convertCurrency(i.total, i.currency, currency), 0);
  const collected = payments.reduce((a, p) => a + convertCurrency(p.amount, p.currency, currency), 0);
  const expenseTotal = expenses.reduce((a, e) => a + convertCurrency(e.amount, e.currency, currency), 0);
  const expenseTax = expenses.reduce((a, e) => a + convertCurrency(e.taxAmount, e.currency, currency), 0);

  return {
    invoiced,
    collected,
    expenseTotal,
    expenseTax,
    netProfit: collected - expenseTotal,
    accrualProfit: invoiced - expenseTotal,
    series: [...series.values()].map((s) => ({ ...s, profit: s.collected - s.expenses })),
    byCategory: [...byCategory.values()].sort((a, b) => b.amount - a.amount),
    invoiceCount: invoices.length,
  };
}

export async function getInvoiceStatusSummary(businessId: string, currency: string) {
  const rows = await db.invoice.findMany({
    where: { businessId },
    select: { status: true, total: true, amountPaid: true, currency: true },
  });
  const statusRows = ["SENT", "PARTIAL", "OVERDUE", "PAID", "DRAFT"].map((status) => ({
    status,
    count: rows.filter((row) => row.status === status).length,
    outstanding: rows.filter((row) => row.status === status).reduce((sum, row) => sum + convertCurrency(Math.max(row.total - row.amountPaid, 0), row.currency, currency), 0),
    total: rows.filter((row) => row.status === status).reduce((sum, row) => sum + convertCurrency(row.total, row.currency, currency), 0),
  }));
  const get = (status: string) => statusRows.find((row) => row.status === status);
  return {
    outstanding: ["SENT", "PARTIAL", "OVERDUE"].reduce((sum, status) => sum + (get(status)?.outstanding ?? 0), 0),
    outstandingCount: ["SENT", "PARTIAL", "OVERDUE"].reduce((sum, status) => sum + (get(status)?.count ?? 0), 0),
    overdue: get("OVERDUE")?.outstanding ?? 0,
    overdueCount: get("OVERDUE")?.count ?? 0,
    paid: get("PAID")?.total ?? 0,
    paidCount: get("PAID")?.count ?? 0,
    draftCount: get("DRAFT")?.count ?? 0,
  };
}

export async function getAging(businessId: string, currency: string) {
  const open = await db.invoice.findMany({
    where: { businessId, currency, status: { in: ["SENT", "PARTIAL", "OVERDUE"] } },
    include: { customer: { select: { name: true, company: true } } },
    orderBy: { dueDate: "asc" },
  });
  const today = startOfDay(new Date()).getTime();
  const buckets = { current: 0, d1_30: 0, d31_60: 0, d61_90: 0, d90p: 0 };
  const rows = open.map((i) => {
    const balance = i.total - i.amountPaid;
    const days = Math.floor((today - startOfDay(i.dueDate).getTime()) / 86_400_000);
    if (days <= 0) buckets.current += balance;
    else if (days <= 30) buckets.d1_30 += balance;
    else if (days <= 60) buckets.d31_60 += balance;
    else if (days <= 90) buckets.d61_90 += balance;
    else buckets.d90p += balance;
    return { id: i.id, number: i.number, customer: i.customer?.company || i.customer?.name || "—", dueDate: i.dueDate, balance, daysOverdue: Math.max(days, 0), status: i.status };
  });
  return { buckets, rows };
}

export async function getCustomerRevenue(businessId: string, currency: string, from: Date, to: Date) {
  const invoices = await db.invoice.findMany({
    where: { businessId, currency, status: BILLABLE, issueDate: { gte: from, lte: to } },
    select: { total: true, amountPaid: true, customer: { select: { id: true, name: true, company: true } } },
  });
  const map = new Map<string, { id: string; name: string; invoiced: number; paid: number; outstanding: number; count: number }>();
  for (const i of invoices) {
    const id = i.customer?.id ?? "none";
    const cur = map.get(id) ?? { id, name: i.customer ? i.customer.company || i.customer.name : "No customer", invoiced: 0, paid: 0, outstanding: 0, count: 0 };
    cur.invoiced += i.total;
    cur.paid += i.amountPaid;
    cur.outstanding += Math.max(i.total - i.amountPaid, 0);
    cur.count++;
    map.set(id, cur);
  }
  return [...map.values()].sort((a, b) => b.invoiced - a.invoiced);
}

export async function getYearComparison(businessId: string, currency: string, year: number) {
  const from = new Date(year - 1, 0, 1);
  const to = new Date(year, 11, 31, 23, 59, 59);
  const [payments, expenses] = await Promise.all([
    db.payment.findMany({ where: { businessId, currency, status: "COMPLETED", date: { gte: from, lte: to } }, select: { amount: true, date: true } }),
    db.expense.findMany({ where: { businessId, currency, date: { gte: from, lte: to } }, select: { amount: true, date: true } }),
  ]);
  const rows = Array.from({ length: 12 }, (_, m) => ({
    month: new Intl.DateTimeFormat("en-US", { month: "short" }).format(new Date(year, m, 1)),
    revenueThis: 0, revenueLast: 0, expensesThis: 0, expensesLast: 0,
  }));
  for (const p of payments) {
    const r = rows[p.date.getMonth()]!;
    if (p.date.getFullYear() === year) r.revenueThis += p.amount; else r.revenueLast += p.amount;
  }
  for (const e of expenses) {
    const r = rows[e.date.getMonth()]!;
    if (e.date.getFullYear() === year) r.expensesThis += e.amount; else r.expensesLast += e.amount;
  }
  return rows;
}

/** Currencies the business actually uses (for currency selectors). */
export async function usedCurrencies(businessId: string, base: string) {
  const [a, b] = await Promise.all([
    db.invoice.findMany({ where: { businessId }, select: { currency: true }, distinct: ["currency"] }),
    db.expense.findMany({ where: { businessId }, select: { currency: true }, distinct: ["currency"] }),
  ]);
  return [...new Set([base, ...a.map((x) => x.currency), ...b.map((x) => x.currency)])];
}
