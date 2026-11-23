import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import { requireBusiness } from "@/lib/session";
import { refreshOverdue } from "@/lib/invoices";
import { toDocBusiness, toDocInvoice } from "@/lib/invoice-view";
import { formatMoney, fromCents } from "@/lib/money";
import { formatDate, toInputDate } from "@/lib/dates";
import { methodLabel } from "@/lib/payments/providers";
import { appUrl } from "@/lib/email";
import { Card, CardHeader } from "@/components/ui/card";
import { InvoiceDocument } from "@/components/app/invoice-document";
import { InvoiceToolbar, DeletePaymentButton } from "./toolbar";
import { InvoiceStatusMenu } from "@/components/app/invoice-status-menu";

export default async function Page({ params }: { params: { id: string } }) {
  const { business } = await requireBusiness();
  await refreshOverdue(business.id);
  const inv = await db.invoice.findFirst({
    where: { id: params.id, businessId: business.id },
    include: { items: true, customer: true, payments: { orderBy: { date: "desc" } }, recurring: { select: { id: true, name: true } } },
  });
  if (!inv) notFound();
  const balance = inv.status === "CANCELLED" ? 0 : Math.max(inv.total - inv.amountPaid, 0);
  const pct = inv.total ? Math.min(100, Math.round((inv.amountPaid / inv.total) * 100)) : 0;

  return (
    <>
      <Link href="/invoices" className="no-print mb-4 inline-flex items-center gap-1.5 text-sm text-subtle hover:text-fg"><ArrowLeft size={15} /> Invoices</Link>
      <div className="mb-6 flex flex-col gap-4">
        <div>
          <div className="flex items-center gap-3"><h1 className="whitespace-nowrap text-2xl font-semibold tracking-tight">{inv.number}</h1><InvoiceStatusMenu id={inv.id} status={inv.status} currency={inv.currency} /></div>
          <p className="mt-1 text-sm text-subtle">
            {inv.customer ? <Link href={`/customers/${inv.customer.id}`} className="hover:text-brand">{inv.customer.company || inv.customer.name}</Link> : "No customer"}
            {" · "}Due {formatDate(inv.dueDate)}
            {inv.recurring && <> · from <Link href={`/recurring/${inv.recurring.id}/edit`} className="hover:text-brand">{inv.recurring.name}</Link></>}
          </p>
        </div>
        <InvoiceToolbar
          id={inv.id} status={inv.status} balance={balance} currency={inv.currency}
          publicUrl={appUrl(`/i/${inv.publicToken}`)} customerEmail={inv.customer?.email ?? ""} today={toInputDate(new Date())}
          balanceMajor={String(fromCents(balance, inv.currency))}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <InvoiceDocument business={toDocBusiness(business)} invoice={toDocInvoice(inv)} />
        <div className="space-y-6">
          <Card className="p-5">
            <p className="text-xs font-medium text-subtle">Balance due</p>
            <p className="num mt-1 text-2xl font-semibold">{formatMoney(balance, inv.currency)}</p>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-success transition-all" style={{ width: `${pct}%` }} /></div>
            <div className="num mt-2 flex justify-between text-xs text-subtle"><span>Paid {formatMoney(inv.amountPaid, inv.currency)}</span><span>of {formatMoney(inv.total, inv.currency)}</span></div>
          </Card>
          <Card>
            <CardHeader title="Payment history" description={inv.payments.length ? `${inv.payments.length} payment${inv.payments.length > 1 ? "s" : ""} recorded` : "No payments recorded yet"} />
            <ul className="divide-y">
              {inv.payments.map((p) => (
                <li key={p.id} className="flex items-start justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <p className="num text-sm font-medium">{formatMoney(p.amount, p.currency)}</p>
                    <p className="text-xs text-subtle">{formatDate(p.date)} · {methodLabel(p.method)}{p.reference ? ` · ${p.reference}` : ""}</p>
                    {p.notes && <p className="mt-1 text-xs text-subtle">{p.notes}</p>}
                  </div>
                  <DeletePaymentButton id={p.id} />
                </li>
              ))}
            </ul>
          </Card>
          <Card className="p-5 text-xs text-subtle">
            <dl className="space-y-2">
              <div className="flex justify-between"><dt>Created</dt><dd>{formatDate(inv.createdAt)}</dd></div>
              <div className="flex justify-between"><dt>Last sent</dt><dd>{formatDate(inv.sentAt)}</dd></div>
              {inv.paidAt && <div className="flex justify-between"><dt>Paid on</dt><dd>{formatDate(inv.paidAt)}</dd></div>}
            </dl>
          </Card>
        </div>
      </div>
    </>
  );
}
