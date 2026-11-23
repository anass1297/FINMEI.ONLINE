import Link from "next/link";
import { Users, Plus, Search } from "lucide-react";
import { db } from "@/lib/db";
import { requireBusiness } from "@/lib/session";
import { formatMoney } from "@/lib/money";
import { initials } from "@/lib/utils";
import { PageHeader, EmptyState } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { CustomerDialogButton } from "@/components/app/customer-form";

export const metadata = { title: "Customers" };

export default async function Page({ searchParams }: { searchParams: { q?: string; new?: string } }) {
  const { business } = await requireBusiness();
  const q = searchParams.q?.trim();
  const customers = await db.customer.findMany({
    where: {
      businessId: business.id,
      ...(q ? { OR: [{ name: { contains: q } }, { company: { contains: q } }, { email: { contains: q } }] } : {}),
    },
    orderBy: { name: "asc" },
  });
  const stats = await db.invoice.groupBy({
    by: ["customerId"],
    where: { businessId: business.id, status: { notIn: ["DRAFT", "CANCELLED"] } },
    _sum: { total: true, amountPaid: true },
    _count: true,
  });
  const byId = new Map(stats.map((s) => [s.customerId, s]));

  return (
    <>
      <PageHeader title="Customers" description="Everyone you bill, with lifetime revenue and open balances."
        actions={<CustomerDialogButton defaultOpen={searchParams.new === "1"}><Plus size={16} /> Add customer</CustomerDialogButton>} />
      <Card>
        <div className="border-b p-3">
          <form className="relative max-w-sm">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-subtle" />
            <input name="q" defaultValue={q} placeholder="Search by name, company or email" className="input pl-9" />
          </form>
        </div>
        {customers.length === 0 ? (
          <EmptyState icon={<Users size={22} />} title={q ? "No matching customers" : "No customers yet"} description="Add your first customer to start sending invoices." action={!q && <CustomerDialogButton><Plus size={16} /> Add customer</CustomerDialogButton>} />
        ) : (
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead><tr><th>Customer</th><th className="hidden md:table-cell">Email</th><th className="text-right">Invoices</th><th className="text-right">Revenue (paid)</th><th className="text-right">Outstanding</th></tr></thead>
              <tbody>
                {customers.map((c) => {
                  const s = byId.get(c.id);
                  const paid = s?._sum.amountPaid ?? 0;
                  const outstanding = (s?._sum.total ?? 0) - paid;
                  const cur = c.currency || business.currency;
                  return (
                    <tr key={c.id}>
                      <td>
                        <Link href={`/customers/${c.id}`} className="flex items-center gap-3">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-soft text-xs font-semibold text-brand">{initials(c.company || c.name)}</span>
                          <span className="min-w-0"><span className="block font-medium hover:text-brand">{c.company || c.name}</span>{c.company && <span className="block text-xs text-subtle">{c.name}</span>}</span>
                        </Link>
                      </td>
                      <td className="hidden text-subtle md:table-cell">{c.email || "—"}</td>
                      <td className="num text-right">{s?._count ?? 0}</td>
                      <td className="num text-right">{formatMoney(paid, cur)}</td>
                      <td className={`num text-right ${outstanding > 0 ? "font-medium text-warning" : "text-subtle"}`}>{formatMoney(Math.max(outstanding, 0), cur)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
