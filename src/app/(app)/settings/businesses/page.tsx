import { Plus } from "lucide-react";
import { db } from "@/lib/db";
import { requireBusiness } from "@/lib/session";
import { PageHeader } from "@/components/ui/page-header";
import { LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { initials } from "@/lib/utils";
import { BusinessRowActions } from "./row";

export const metadata = { title: "Businesses" };

export default async function Page() {
  const { user, business } = await requireBusiness();
  const memberships = await db.membership.findMany({
    where: { userId: user.id },
    include: { business: { include: { _count: { select: { invoices: true, customers: true, expenses: true } } } } },
    orderBy: { createdAt: "asc" },
  });
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Businesses" description="Manage every business from one account. Data is never shared between businesses."
        actions={<LinkButton href="/onboarding?new=1"><Plus size={16} /> New business</LinkButton>} />
      <div className="grid gap-4 sm:grid-cols-2">
        {memberships.map(({ business: b, role }) => (
          <Card key={b.id} className={`p-5 ${b.id === business.id ? "ring-2 ring-brand/30" : ""}`}>
            <div className="flex items-start gap-3">
              {b.logo ? <img src={b.logo} alt="" className="h-11 w-11 rounded-lg border bg-white object-contain" /> :
                <span className="flex h-11 w-11 items-center justify-center rounded-lg text-sm font-semibold text-white" style={{ background: b.brandColor }}>{initials(b.name)}</span>}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2"><p className="truncate font-semibold">{b.name}</p>{b.id === business.id && <Badge tone="blue">Active</Badge>}</div>
                <p className="text-xs text-subtle">{b.currency} · {role.toLowerCase()}</p>
              </div>
            </div>
            <dl className="num mt-4 grid grid-cols-3 gap-2 text-center">
              {[["Invoices", b._count.invoices], ["Customers", b._count.customers], ["Expenses", b._count.expenses]].map(([k, n]) => (
                <div key={k} className="rounded-lg bg-muted/60 py-2"><dd className="text-base font-semibold">{n}</dd><dt className="text-[11px] text-subtle">{k}</dt></div>
              ))}
            </dl>
            <BusinessRowActions id={b.id} active={b.id === business.id} canDelete={role === "OWNER" && memberships.length > 1} name={b.name} />
          </Card>
        ))}
      </div>
    </div>
  );
}
