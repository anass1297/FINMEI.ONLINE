import { apiBusiness } from "@/lib/api-auth";
import { resolveRange, toInputDate, formatDate } from "@/lib/dates";
import { REPORT_TITLES, REPORT_TYPES, reportTable, type ReportType } from "@/lib/report-data";
import { csvResponse } from "@/lib/csv";
import { formatMoney, fromCents } from "@/lib/money";
import { renderTablePdf } from "@/lib/pdf/table-pdf";
import { pdfResponse } from "@/lib/pdf/common";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const ctx = await apiBusiness();
  if (!ctx) return new Response("Unauthorized", { status: 401 });
  const sp = new URL(req.url).searchParams;
  const type = (REPORT_TYPES as readonly string[]).includes(sp.get("type") ?? "") ? (sp.get("type") as ReportType) : "pnl";
  const currency = sp.get("currency") || ctx.business.currency;
  const range = resolveRange(sp.get("range") ?? undefined, sp.get("from") ?? undefined, sp.get("to") ?? undefined);
  const year = Number(sp.get("year")) || new Date().getFullYear();
  const t = await reportTable(type, ctx.business.id, currency, range.from, range.to, year);
  const name = `${type}-report-${toInputDate(new Date())}`;

  if (sp.get("format") === "pdf") {
    const bytes = await renderTablePdf({
      title: `${REPORT_TITLES[type]} report`,
      subtitle: `${currency} · ${type === "outstanding" ? "As of " + formatDate(new Date()) : type === "comparison" ? `${year} vs ${year - 1}` : `${formatDate(range.from)} – ${formatDate(range.to)}`}`,
      businessName: ctx.business.name,
      columns: t.columns.map((c, i) => ({ label: c, width: i === 0 ? 150 : 100, align: i === 0 ? "left" : "right" })),
      rows: t.rows.map((r) => r.map((v, i) => (t.money.includes(i) ? formatMoney(Number(v), currency) : String(v)))),
      summary: t.summary,
      landscape: t.columns.length > 5,
    });
    return pdfResponse(bytes, `${name}.pdf`);
  }
  return csvResponse(`${name}.csv`, [t.columns, ...t.rows.map((r) => r.map((v, i) => (t.money.includes(i) ? fromCents(Number(v), currency) : v)))]);
}
