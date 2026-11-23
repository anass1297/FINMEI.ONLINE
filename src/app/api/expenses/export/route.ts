import { db } from "@/lib/db";
import { apiBusiness } from "@/lib/api-auth";
import { expenseWhere } from "@/lib/expense-filters";
import { csvResponse } from "@/lib/csv";
import { formatMoney, fromCents } from "@/lib/money";
import { formatDate, toInputDate } from "@/lib/dates";
import { renderTablePdf } from "@/lib/pdf/table-pdf";
import { pdfResponse } from "@/lib/pdf/common";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const ctx = await apiBusiness();
  if (!ctx) return new Response("Unauthorized", { status: 401 });
  const m = { business: ctx.business, businessId: ctx.business.id };

  const sp = Object.fromEntries(new URL(req.url).searchParams);
  const expenses = await db.expense.findMany({ where: expenseWhere(m.businessId, sp), include: { category: true, _count: { select: { attachments: true } } }, orderBy: { date: "desc" } });
  const stamp = toInputDate(new Date());

  if (sp.format === "pdf") {
    const totals = new Map<string, number>();
    expenses.forEach((e) => totals.set(e.currency, (totals.get(e.currency) ?? 0) + e.amount));
    const bytes = await renderTablePdf({
      title: "Expense report", businessName: m.business.name,
      subtitle: [sp.from && `From ${sp.from}`, sp.to && `to ${sp.to}`].filter(Boolean).join(" ") || "All dates",
      columns: [{ label: "Date", width: 70 }, { label: "Description", width: 170 }, { label: "Vendor", width: 100 }, { label: "Category", width: 110 }, { label: "Tax", width: 70, align: "right" }, { label: "Amount", width: 85, align: "right" }],
      rows: expenses.map((e) => [formatDate(e.date), e.description, e.vendor ?? "", e.category?.name ?? "Uncategorized", formatMoney(e.taxAmount, e.currency), formatMoney(e.amount, e.currency)]),
      summary: [["Expenses", String(expenses.length)], ...[...totals].map(([c, t]) => [`Total ${c}`, formatMoney(t, c)] as [string, string])],
      landscape: true,
    });
    return pdfResponse(bytes, `expenses-${stamp}.pdf`);
  }

  return csvResponse(`expenses-${stamp}.csv`, [
    ["Date", "Description", "Vendor", "Category", "Currency", "Amount", "Tax rate %", "Tax amount", "Net amount", "Attachments", "Notes"],
    ...expenses.map((e) => [toInputDate(e.date), e.description, e.vendor, e.category?.name ?? "", e.currency, fromCents(e.amount, e.currency), e.taxRate, fromCents(e.taxAmount, e.currency), fromCents(e.amount - e.taxAmount, e.currency), e._count.attachments, e.notes]),
  ]);
}
