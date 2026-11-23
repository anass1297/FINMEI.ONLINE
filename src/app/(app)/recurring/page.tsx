import Link from "next/link";
import { Repeat, Plus } from "lucide-react";
import { db } from "@/lib/db";
import { requireBusiness } from "@/lib/session";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/dates";
import { computeTotals } from "@/lib/calc";
import { describeFrequency } from "@/lib/recurring-client";
import { PageHeader, EmptyState } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { RecurringRowActions, RunNowButton } from "./actions";

export const metadata = { title: "Recurring invoices" };

export default async function Page() {
  const { business } = await requireBusiness();
  const list = await db.recurringInvoice.findMany({
    where: { businessId: business.id },
    include: { customer: { select: { name: true, company: true } }, _count: { select: { invoices: true } } },
    orderBy: [{ status: "asc" }, { nextRunDate: "asc" }],
  });
  return (
    <>
      <PageHeader title="Recurring invoices" description="Automate retainers, subscriptions and repeat billing. Invoices are generated on schedule."
        actions={<><RunNowButton /><LinkButton href="/recurring/new"><Plus size={16} /> New schedule</LinkButton></>} />
      <Card>
        {list.length === 0 ? (
          <EmptyState icon={<Repeat size={22} />} title="No recurring invoices" description="Set up a schedule once and FINMEI Financial creates the invoices for you — weekly, monthly, quarterly, annually or on a custom cycle."
            action={<LinkButton href="/recurring/new"><Plus size={16} /> New schedule</LinkButton>} />
        ) : (
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead><tr><th>Schedule</th><th className="hidden md:table-cell">Customer</th><th>Frequency</th><th className="hidden sm:table-cell">Next invoice</th><th>Status</th><th className="text-right">Amount</th><th className="hidden text-right lg:table-cell">Generated</th><th className="w-10" /></tr></thead>
              <tbody>
                {list.map((r) => {
                  const t = computeTotals(JSON.parse(r.itemsJson), r.discountType, r.discountValue);
                  return (
                    <tr key={r.id}>
                      <td><Link href={`/recurring/${r.id}/edit`} className="font-medium hover:text-brand">{r.name}</Link></td>
                      <td className="hidden text-subtle md:table-cell">{r.customer ? r.customer.company || r.customer.name : "—"}</td>
                      <td>{describeFrequency(r)}</td>
                      <td className="hidden text-subtle sm:table-cell">{r.status === "ACTIVE" ? formatDate(r.nextRunDate) : "—"}</td>
                      <td><StatusBadge status={r.status} /></td>
                      <td className="num text-right font-medium">{formatMoney(t.total, r.currency)}</td>
                      <td className="num hidden text-right text-subtle lg:table-cell">{r._count.invoices}{r.maxOccurrences ? ` / ${r.maxOccurrences}` : ""}</td>
                      <td><RecurringRowActions id={r.id} status={r.status} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <p className="mt-4 text-xs text-subtle">Schedules run automatically via the daily job (<code>/api/cron/recurring</code>). Use “Run now” to generate any due invoices immediately.</p>
    </>
  );
}
