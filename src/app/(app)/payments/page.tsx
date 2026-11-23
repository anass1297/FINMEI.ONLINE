import Link from "next/link";
import { CreditCard } from "lucide-react";
import { db } from "@/lib/db";
import { requireBusiness } from "@/lib/session";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/dates";
import { methodLabel } from "@/lib/payments/providers";
import { PageHeader, EmptyState } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const metadata = { title: "Payments" };

export default async function Page() {
  const { business } = await requireBusiness();
  const [payments, totals] = await Promise.all([
    db.payment.findMany({ where: { businessId: business.id }, include: { invoice: { select: { id: true, number: true, customer: { select: { name: true, company: true } } } } }, orderBy: { date: "desc" }, take: 500 }),
    db.payment.groupBy({ by: ["currency"], where: { businessId: business.id, status: "COMPLETED" }, _sum: { amount: true }, _count: true }),
  ]);
  return (
    <>
      <PageHeader title="Payments" description="Every payment recorded against your invoices. Record new payments from an invoice." />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        {(totals.length ? totals : [{ currency: business.currency, _sum: { amount: 0 }, _count: 0 }]).map((t) => (
          <Card key={t.currency} className="p-5"><p className="text-xs font-medium text-subtle">Collected ({t.currency}) · {t._count} payment{t._count === 1 ? "" : "s"}</p><p className="num mt-2 text-xl font-semibold text-success">{formatMoney(t._sum.amount ?? 0, t.currency)}</p></Card>
        ))}
        <Card className="p-5 sm:col-span-3 lg:col-span-1">
          <p className="text-xs font-medium text-subtle">Online payments</p>
          <p className="mt-2 text-sm">Stripe & PayPal integration is prepared but not enabled. Payments are only marked as received when you record them, or when a verified provider webhook confirms them.</p>
        </Card>
      </div>
      <Card>
        {payments.length === 0 ? <EmptyState icon={<CreditCard size={22} />} title="No payments yet" description="Open an invoice and click “Record payment” when money arrives." /> : (
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead><tr><th>Date</th><th>Invoice</th><th className="hidden sm:table-cell">Customer</th><th>Method</th><th className="hidden md:table-cell">Reference</th><th className="hidden md:table-cell">Source</th><th className="text-right">Amount</th></tr></thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id}>
                    <td className="text-subtle">{formatDate(p.date)}</td>
                    <td><Link href={`/invoices/${p.invoice.id}`} className="font-medium hover:text-brand">{p.invoice.number}</Link></td>
                    <td className="hidden max-w-[200px] truncate sm:table-cell">{p.invoice.customer?.company || p.invoice.customer?.name || "—"}</td>
                    <td>{methodLabel(p.method)}</td>
                    <td className="hidden text-subtle md:table-cell">{p.reference || "—"}</td>
                    <td className="hidden md:table-cell"><Badge tone={p.provider === "manual" ? "gray" : "violet"}>{p.provider === "manual" ? "Manual" : p.provider}</Badge></td>
                    <td className="num text-right font-medium text-success">{formatMoney(p.amount, p.currency)}</td>
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
