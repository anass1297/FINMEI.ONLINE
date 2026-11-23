import { notFound } from "next/navigation";
import { Download, ShieldCheck } from "lucide-react";
import { db } from "@/lib/db";
import { toDocBusiness, toDocInvoice } from "@/lib/invoice-view";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/dates";
import { deriveStatus } from "@/lib/invoices";
import { InvoiceDocument } from "@/components/app/invoice-document";
import { LogoMark } from "@/components/logo";

export const dynamic = "force-dynamic";
export const metadata = { title: "Invoice", robots: { index: false, follow: false } };

export default async function PublicInvoice({ params }: { params: { token: string } }) {
  const inv = await db.invoice.findUnique({ where: { publicToken: params.token }, include: { items: true, business: true } });
  if (!inv || inv.status === "DRAFT") notFound();
  const status = deriveStatus(inv);
  const doc = toDocInvoice({ ...inv, status });
  const balance = status === "CANCELLED" ? 0 : Math.max(inv.total - inv.amountPaid, 0);

  return (
    <div className="min-h-screen bg-muted/50 px-4 py-8 sm:py-12">
      <div className="mx-auto max-w-3xl">
        <div className="card mb-6 flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-subtle">{inv.business.name} · Invoice {inv.number}</p>
            <p className="num text-2xl font-semibold">{status === "PAID" ? "Paid in full" : status === "CANCELLED" ? "Cancelled" : formatMoney(balance, inv.currency)}</p>
            {status !== "PAID" && status !== "CANCELLED" && <p className={`text-sm ${status === "OVERDUE" ? "text-danger" : "text-subtle"}`}>{status === "OVERDUE" ? "Overdue — was due" : "Due"} {formatDate(inv.dueDate, "long")}</p>}
          </div>
          <a href={`/api/public/invoices/${params.token}/pdf`} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-brand px-5 text-sm font-medium text-white hover:bg-brand/90"><Download size={16} /> Download PDF</a>
        </div>
        <InvoiceDocument business={toDocBusiness(inv.business)} invoice={doc} />
        <p className="mt-6 flex items-center justify-center gap-2 text-xs text-subtle"><ShieldCheck size={14} /> Secure invoice link · Powered by <LogoMark size={14} /> Kontora</p>
      </div>
    </div>
  );
}
