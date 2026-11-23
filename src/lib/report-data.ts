import { getAging, getCustomerRevenue, getFinancials, getYearComparison } from "./reports";
import { formatMoney } from "./money";
import { formatDate, monthLabel } from "./dates";
import { db } from "./db";

export const REPORT_TYPES = ["pnl", "revenue", "expenses", "outstanding", "customers", "comparison"] as const;
export type ReportType = (typeof REPORT_TYPES)[number];

export const REPORT_TITLES: Record<ReportType, string> = {
  pnl: "Profit & loss", revenue: "Revenue", expenses: "Expenses", outstanding: "Outstanding payments", customers: "Revenue by customer", comparison: "Year-over-year comparison",
};

/** Tabular representation of each report — shared by the page table view, CSV and PDF exports. */
export async function reportTable(type: ReportType, businessId: string, currency: string, from: Date, to: Date, year: number) {
  const m = (c: number) => formatMoney(c, currency);
  switch (type) {
    case "pnl": {
      const f = await getFinancials(businessId, currency, from, to);
      return {
        columns: ["Month", "Revenue (collected)", "Expenses", "Net profit", "Invoiced"],
        rows: f.series.map((s) => [monthLabel(s.month), s.collected, s.expenses, s.profit, s.invoiced]),
        money: [1, 2, 3, 4],
        summary: [["Revenue", m(f.collected)], ["Expenses", m(f.expenseTotal)], ["Net profit", m(f.netProfit)], ["Invoiced", m(f.invoiced)]] as [string, string][],
      };
    }
    case "revenue": {
      const payments = await db.payment.findMany({
        where: { businessId, currency, status: "COMPLETED", date: { gte: from, lte: to } },
        include: { invoice: { select: { number: true, customer: { select: { name: true, company: true } } } } }, orderBy: { date: "desc" },
      });
      const total = payments.reduce((a, p) => a + p.amount, 0);
      return {
        columns: ["Date", "Invoice", "Customer", "Method", "Reference", "Amount"],
        rows: payments.map((p) => [formatDate(p.date), p.invoice.number, p.invoice.customer?.company || p.invoice.customer?.name || "", p.method.replace("_", " ").toLowerCase(), p.reference ?? "", p.amount]),
        money: [5],
        summary: [["Payments", String(payments.length)], ["Total collected", m(total)]] as [string, string][],
      };
    }
    case "expenses": {
      const f = await getFinancials(businessId, currency, from, to);
      return {
        columns: ["Category", "Amount", "Share %"],
        rows: f.byCategory.map((c) => [c.name, c.amount, f.expenseTotal ? Math.round((c.amount / f.expenseTotal) * 1000) / 10 : 0]),
        money: [1],
        summary: [["Total expenses", m(f.expenseTotal)], ["Tax portion", m(f.expenseTax)], ["Categories", String(f.byCategory.length)]] as [string, string][],
      };
    }
    case "outstanding": {
      const a = await getAging(businessId, currency);
      const total = Object.values(a.buckets).reduce((x, y) => x + y, 0);
      return {
        columns: ["Invoice", "Customer", "Due date", "Days overdue", "Status", "Balance"],
        rows: a.rows.map((r) => [r.number, r.customer, formatDate(r.dueDate), r.daysOverdue, r.status, r.balance]),
        money: [5],
        summary: [["Total outstanding", m(total)], ["Not yet due", m(a.buckets.current)], ["1–30 days", m(a.buckets.d1_30)], ["31–60 days", m(a.buckets.d31_60)], ["61–90 days", m(a.buckets.d61_90)], ["90+ days", m(a.buckets.d90p)]] as [string, string][],
        buckets: a.buckets,
      };
    }
    case "customers": {
      const rows = await getCustomerRevenue(businessId, currency, from, to);
      return {
        columns: ["Customer", "Invoices", "Invoiced", "Paid", "Outstanding"],
        rows: rows.map((r) => [r.name, r.count, r.invoiced, r.paid, r.outstanding]),
        money: [2, 3, 4],
        summary: [["Customers", String(rows.length)], ["Invoiced", m(rows.reduce((a, r) => a + r.invoiced, 0))], ["Paid", m(rows.reduce((a, r) => a + r.paid, 0))]] as [string, string][],
      };
    }
    case "comparison": {
      const rows = await getYearComparison(businessId, currency, year);
      const sum = (k: "revenueThis" | "revenueLast" | "expensesThis" | "expensesLast") => rows.reduce((a, r) => a + r[k], 0);
      const growth = sum("revenueLast") ? Math.round(((sum("revenueThis") - sum("revenueLast")) / sum("revenueLast")) * 1000) / 10 : null;
      return {
        columns: ["Month", `Revenue ${year}`, `Revenue ${year - 1}`, `Expenses ${year}`, `Expenses ${year - 1}`],
        rows: rows.map((r) => [r.month, r.revenueThis, r.revenueLast, r.expensesThis, r.expensesLast]),
        money: [1, 2, 3, 4],
        summary: [[`Revenue ${year}`, m(sum("revenueThis"))], [`Revenue ${year - 1}`, m(sum("revenueLast"))], ["Revenue growth", growth === null ? "—" : `${growth > 0 ? "+" : ""}${growth}%`], [`Expenses ${year}`, m(sum("expensesThis"))]] as [string, string][],
        chart: rows,
      };
    }
  }
}
