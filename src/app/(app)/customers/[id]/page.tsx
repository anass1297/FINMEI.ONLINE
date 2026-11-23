import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Mail, Phone, MapPin, FileText, Plus, Pencil, Hash } from "lucide-react";
import { db } from "@/lib/db";
import { requireBusiness } from "@/lib/session";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/dates";
import { Card, CardHeader } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/page-header";
import { CustomerDialogButton } from "@/components/app/customer-form";
import { DeleteCustomer } from "./delete";

export default async function Page({ params }: { params: { id: string } }) {
  const { business } = await requireBusiness();
  const c = await db.customer.findFirst({
    where: { id: params.id, businessId: business.id },
    include: { invoices: { orderBy: { issueDate: "desc" } } },
  });
  if (!c) notFound();
  const billable = c.invoices.filter((i) => !["DRAFT", "CANCELLED"].includes(i.status));
  // Group by currency so we never sum different currencies together
  const byCur = new Map<string, { invoiced: number; paid: number }>();
  for (const i of billable) {
    const s = byCur.get(i.currency) ?? { invoiced: 0, paid: 0 };
    s.invoiced += i.total; s.paid += i.amountPaid;
    byCur.set(i.currency, s);
  }
  const curs = byCur.size ? [...byCur.entries()] : [[c.currency || business.currency, { invoiced: 0, paid: 0 }] as const];
  const address = [c.addressLine1, c.addressLine2, [c.postalCode, c.city].filter(Boolean).join(" "), [c.state, c.country].filter(Boolean).join(", ")].filter(Boolean);

  return (
    <>
      <Link href="/customers" className="mb-4 inline-flex items-center gap-1.5 text-sm text-subtle hover:text-fg"><ArrowLeft size={15} /> Customers</Link>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{c.company || c.name}</h1>
          {c.company && <p className="text-sm text-subtle">{c.name}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          <LinkButton href={`/invoices/new?customer=${c.id}`}><Plus size={16} /> New invoice</LinkButton>
          <CustomerDialogButton customer={c} variant="secondary"><Pencil size={15} /> Edit</CustomerDialogButton>
          <DeleteCustomer id={c.id} />
        </div>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        {curs.map(([cur, s]) => (
          <div key={cur} className="contents">
            <Card className="p-5"><p className="text-xs font-medium text-subtle">Total invoiced {curs.length > 1 && `(${cur})`}</p><p className="num mt-2 text-xl font-semibold">{formatMoney(s.invoiced, cur)}</p></Card>
            <Card className="p-5"><p className="text-xs font-medium text-subtle">Revenue received</p><p className="num mt-2 text-xl font-semibold text-success">{formatMoney(s.paid, cur)}</p></Card>
            <Card className="p-5"><p className="text-xs font-medium text-subtle">Outstanding balance</p><p className="num mt-2 text-xl font-semibold text-warning">{formatMoney(Math.max(s.invoiced - s.paid, 0), cur)}</p></Card>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="h-fit">
          <CardHeader title="Contact details" />
          <dl className="space-y-3 p-5 text-sm">
            {c.email && <div className="flex gap-3"><Mail size={16} className="mt-0.5 text-subtle" /><a href={`mailto:${c.email}`} className="hover:text-brand">{c.email}</a></div>}
            {c.phone && <div className="flex gap-3"><Phone size={16} className="mt-0.5 text-subtle" /><span>{c.phone}</span></div>}
            {address.length > 0 && <div className="flex gap-3"><MapPin size={16} className="mt-0.5 text-subtle" /><span>{address.map((l, i) => <span key={i} className="block">{l}</span>)}</span></div>}
            {c.taxId && <div className="flex gap-3"><Hash size={16} className="mt-0.5 text-subtle" /><span>Tax ID: {c.taxId}</span></div>}
            {!c.email && !c.phone && !address.length && <p className="text-subtle">No contact details yet.</p>}
          </dl>
          {c.notes && <div className="border-t p-5"><p className="label">Notes</p><p className="whitespace-pre-wrap text-sm">{c.notes}</p></div>}
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader title="Invoice history" description={`${c.invoices.length} invoice${c.invoices.length === 1 ? "" : "s"}`} />
          {c.invoices.length === 0 ? <EmptyState icon={<FileText size={22} />} title="No invoices yet" /> : (
            <div className="overflow-x-auto">
              <table className="table-base">
                <thead><tr><th>Number</th><th>Issued</th><th>Due</th><th>Status</th><th className="text-right">Total</th><th className="text-right">Balance</th></tr></thead>
                <tbody>
                  {c.invoices.map((i) => (
                    <tr key={i.id}>
                      <td><Link href={`/invoices/${i.id}`} className="font-medium hover:text-brand">{i.number}</Link></td>
                      <td className="text-subtle">{formatDate(i.issueDate)}</td>
                      <td className="text-subtle">{formatDate(i.dueDate)}</td>
                      <td><StatusBadge status={i.status} /></td>
                      <td className="num text-right">{formatMoney(i.total, i.currency)}</td>
                      <td className="num text-right">{formatMoney(i.status === "CANCELLED" ? 0 : Math.max(i.total - i.amountPaid, 0), i.currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
