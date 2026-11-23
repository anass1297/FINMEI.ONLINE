import Link from "next/link";
import { Download } from "lucide-react";
import { requireBusiness } from "@/lib/session";
import { refreshOverdue } from "@/lib/invoices";
import { getFinancials, usedCurrencies } from "@/lib/reports";
import { REPORT_TITLES, REPORT_TYPES, reportTable, type ReportType } from "@/lib/report-data";
import { formatMoney } from "@/lib/money";
import { monthLabel, resolveRange, toInputDate } from "@/lib/dates";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader } from "@/components/ui/card";
import { RangeFilters } from "@/components/app/filters";
import { ProfitLossChart, RankedBars, RevenueChart, YearComparisonChart, ExpenseChart } from "@/components/app/charts";
import { cn } from "@/lib/utils";

export const metadata = { title: "Reports" };

export default async function Reports({ searchParams }: { searchParams: { tab?: string; range?: string; from?: string; to?: string; currency?: string; year?: string } }) {
  const { business } = await requireBusiness();
  await refreshOverdue(business.id);
  const tab: ReportType = (REPORT_TYPES as readonly string[]).includes(searchParams.tab ?? "") ? (searchParams.tab as ReportType) : "pnl";
  const range = resolveRange(searchParams.range ?? "ytd", searchParams.from, searchParams.to);
  const currencies = await usedCurrencies(business.id, business.currency);
  const currency = currencies.includes(searchParams.currency ?? "") ? searchParams.currency! : business.currency;
  const year = Number(searchParams.year) || new Date().getFullYear();

  const [table, fin] = await Promise.all([
    reportTable(tab, business.id, currency, range.from, range.to, year),
    getFinancials(business.id, currency, range.from, range.to),
  ]);
  const series = fin.series.map((s) => ({ ...s, label: monthLabel(s.month) }));

  const qs = (patch: Record<string, string>) => {
    const p = new URLSearchParams(Object.entries({ ...searchParams, ...patch }).filter(([, v]) => v) as [string, string][]);
    return p.toString();
  };
  const exportQs = qs({ type: tab, range: range.preset, from: toInputDate(range.from), to: toInputDate(range.to), currency, year: String(year) });

  return (
    <>
      <PageHeader title="Reports" description="Understand revenue, spending and cash flow. Export anything as PDF or CSV."
        actions={<>
          <a href={`/api/reports/export?format=csv&${exportQs}`} className="inline-flex h-9 items-center gap-2 rounded-lg border bg-surface px-3 text-sm font-medium hover:bg-muted"><Download size={15} /> CSV</a>
          <a href={`/api/reports/export?format=pdf&${exportQs}`} className="inline-flex h-9 items-center gap-2 rounded-lg border bg-surface px-3 text-sm font-medium hover:bg-muted"><Download size={15} /> PDF</a>
        </>} />

      <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex gap-1 overflow-x-auto rounded-lg border bg-surface p-1">
          {REPORT_TYPES.map((t) => (
            <Link key={t} href={`/reports?${qs({ tab: t })}`} className={cn("whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition", tab === t ? "bg-brand-soft text-brand" : "text-subtle hover:text-fg")}>{REPORT_TITLES[t]}</Link>
          ))}
        </div>
        {tab === "comparison" ? (
          <div className="flex items-center gap-2">
            {[year - 1, year, year + 1].filter((y) => y <= new Date().getFullYear()).map((y) => (
              <Link key={y} href={`/reports?${qs({ year: String(y) })}`} className={cn("rounded-md px-3 py-1.5 text-sm", y === year ? "bg-fg text-bg" : "border bg-surface")}>{y}</Link>
            ))}
          </div>
        ) : tab !== "outstanding" && <RangeFilters preset={range.preset} from={toInputDate(range.from)} to={toInputDate(range.to)} currency={currency} currencies={currencies} />}
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {table.summary.slice(0, 4).map(([k, v]) => (
          <Card key={k} className="p-5"><p className="text-xs font-medium text-subtle">{k}</p><p className="num mt-2 text-xl font-semibold">{v}</p></Card>
        ))}
      </div>

      {tab !== "outstanding" && tab !== "customers" && (
        <Card className="mb-6">
          <CardHeader title={REPORT_TITLES[tab]} description={tab === "comparison" ? `Revenue collected, ${year} vs ${year - 1}` : "Monthly breakdown"} />
          <div className="p-4">
            {tab === "pnl" && <ProfitLossChart data={series} currency={currency} />}
            {tab === "revenue" && <RevenueChart data={series} currency={currency} height={300} />}
            {tab === "expenses" && <div className="grid gap-6 lg:grid-cols-2"><ExpenseChart data={series} currency={currency} /><div className="p-2"><RankedBars rows={fin.byCategory} currency={currency} emptyLabel="No expenses in this period" /></div></div>}
            {tab === "comparison" && "chart" in table && table.chart && <YearComparisonChart data={table.chart} currency={currency} year={year} />}
          </div>
        </Card>
      )}

      {tab === "outstanding" && "buckets" in table && table.buckets && (
        <Card className="mb-6">
          <CardHeader title="Aging summary" description="Open balances by days past due" />
          <div className="p-5"><RankedBars currency={currency} rows={[
            { name: "Not yet due", amount: table.buckets.current }, { name: "1–30 days overdue", amount: table.buckets.d1_30 },
            { name: "31–60 days overdue", amount: table.buckets.d31_60 }, { name: "61–90 days overdue", amount: table.buckets.d61_90 }, { name: "90+ days overdue", amount: table.buckets.d90p },
          ]} /></div>
        </Card>
      )}

      <Card>
        <CardHeader title="Table view" description={`${table.rows.length} row${table.rows.length === 1 ? "" : "s"} · ${currency}`} />
        <div className="overflow-x-auto">
          <table className="table-base">
            <thead><tr>{table.columns.map((c, i) => <th key={c} className={i ? "text-right" : ""}>{c}</th>)}</tr></thead>
            <tbody>
              {table.rows.length === 0 && <tr><td colSpan={table.columns.length} className="py-10 text-center text-subtle">No data for this period.</td></tr>}
              {table.rows.map((r, ri) => (
                <tr key={ri}>{r.map((v, i) => <td key={i} className={i ? "num text-right" : "font-medium"}>{table.money.includes(i) ? formatMoney(Number(v), currency) : String(v)}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
