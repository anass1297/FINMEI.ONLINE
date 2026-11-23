import Link from "next/link";
import { FileText, Plus, Search } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireBusiness } from "@/lib/session";
import { refreshOverdue } from "@/lib/invoices";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/dates";
import { PageHeader, EmptyState } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { InvoiceRowActions } from "./row-actions";
import { InvoiceStatusMenu } from "@/components/app/invoice-status-menu";

export const metadata = { title: "Invoices" };

const TABS = [
  { key: "all", label: "All" },
  { key: "DRAFT", label: "Drafts" },
  { key: "open", label: "Outstanding" },
  { key: "OVERDUE", label: "Overdue" },
  { key: "PAID", label: "Paid" },
  { key: "CANCELLED", label: "Cancelled" },
];

export default async function Page({ searchParams }: { searchParams: { status?: string; q?: string } }) {
  const { business } = await requireBusiness();
  await refreshOverdue(business.id);
  const tab = searchParams.status ?? "all";
  const q = searchParams.q?.trim();

  const where: Prisma.InvoiceWhereInput = { businessId: business.id };
  if (tab === "open") where.status = { in: ["SENT", "PARTIAL", "OVERDUE"] };
  else if (tab !== "all") where.status = tab;
  if (q) where.OR = [{ number: { contains: q } }, { customer: { name: { contains: q } } }, { customer: { company: { contains: q } } }];

  const [invoices, counts] = await Promise.all([
    db.invoice.findMany({ where, include: { customer: { select: { name: true, company: true } } }, orderBy: [{ issueDate: "desc" }, { createdAt: "desc" }], take: 300 }),
    db.invoice.groupBy({ by: ["status"], where: { businessId: business.id }, _count: true }),
  ]);
  const count = (k: string) => k === "all" ? counts.reduce((a, c) => a + c._count, 0)
    : k === "open" ? counts.filter((c) => ["SENT", "PARTIAL", "OVERDUE"].includes(c.status)).reduce((a, c) => a + c._count, 0)
    : counts.find((c) => c.status === k)?._count ?? 0;

  return (
    <>
      <PageHeader title="Invoices" description="Create, send and track every invoice."
        actions={<LinkButton href="/invoices/new"><Plus size={16} /> New invoice</LinkButton>} />
      <Card className="min-h-[calc(100vh-14rem)]">
        <div className="flex flex-col gap-3 border-b p-3 md:flex-row md:items-center md:justify-between">
          <div className="-mb-px flex gap-1 overflow-x-auto">
            {TABS.map((t) => (
              <Link key={t.key} href={`/invoices?status=${t.key}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
                className={cn("flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition", tab === t.key ? "bg-muted text-fg" : "text-subtle hover:text-fg")}>
                {t.label}<span className="rounded-full bg-border/70 px-1.5 text-[10px]">{count(t.key)}</span>
              </Link>
            ))}
          </div>
          <form className="relative md:w-72">
            <input type="hidden" name="status" value={tab} />
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-subtle" />
            <input name="q" defaultValue={q} placeholder="Search number or customer" className="input pl-9" />
          </form>
        </div>
        {invoices.length === 0 ? (
          <EmptyState icon={<FileText size={22} />} title={q || tab !== "all" ? "No invoices match" : "No invoices yet"} description="Create a professional invoice in under a minute." action={<LinkButton href="/invoices/new"><Plus size={16} /> New invoice</LinkButton>} />
        ) : (
          <div className="w-full overflow-x-auto pb-1">
            <table className="table-base">
              <thead><tr><th>Number</th><th>Customer</th><th className="hidden md:table-cell">Issued</th><th className="hidden sm:table-cell">Due</th><th>Status</th><th className="text-right">Amount</th><th className="hidden text-right lg:table-cell">Balance</th><th className="w-10" /></tr></thead>
              <tbody>
                {invoices.map((i) => (
                  <tr key={i.id}>
                    <td><Link href={`/invoices/${i.id}`} className="font-medium hover:text-brand">{i.number}</Link></td>
                    <td className="max-w-[200px] truncate">{i.customer ? i.customer.company || i.customer.name : <span className="text-subtle">—</span>}</td>
                    <td className="hidden text-subtle md:table-cell">{formatDate(i.issueDate)}</td>
                    <td className="hidden text-subtle sm:table-cell">{formatDate(i.dueDate)}</td>
                    <td><InvoiceStatusMenu id={i.id} status={i.status} currency={i.currency} /></td>
                    <td className="num text-right font-medium">{formatMoney(i.total, i.currency)}</td>
                    <td className="num hidden text-right text-subtle lg:table-cell">{formatMoney(i.status === "CANCELLED" ? 0 : i.total - i.amountPaid, i.currency)}</td>
                    <td><InvoiceRowActions id={i.id} /></td>
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
