import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/dates";
import type { CustomerSnapshot } from "@/lib/invoices";
import { cn } from "@/lib/utils";

export type DocBusiness = {
  name: string; logo?: string | null; email?: string | null; phone?: string | null; website?: string | null; taxId?: string | null;
  addressLine1?: string | null; addressLine2?: string | null; city?: string | null; state?: string | null; postalCode?: string | null; country?: string | null;
  bankName?: string | null; bankAccountName?: string | null; bankAccountNumber?: string | null; iban?: string | null; swift?: string | null;
};
export type DocInvoice = {
  number: string; status: string; issueDate: Date | string; dueDate: Date | string; currency: string;
  items: { description: string; quantity: number; unitPrice: number; taxRate: number; amount: number }[];
  subtotal: number; discountTotal: number; discountType: string; discountValue: number; taxTotal: number; total: number; amountPaid: number;
  taxLabel: string; notes?: string | null; terms?: string | null; paymentInstructions?: string | null;
  template: string; color: string; font: string;
  customer: CustomerSnapshot | null;
};

const FONTS: Record<string, string> = {
  sans: "Inter, Helvetica, Arial, sans-serif",
  serif: "'Times New Roman', Georgia, serif",
  mono: "'Courier New', ui-monospace, monospace",
};

function addr(x: { addressLine1?: string | null; addressLine2?: string | null; city?: string | null; state?: string | null; postalCode?: string | null; country?: string | null }) {
  return [x.addressLine1, x.addressLine2, [x.postalCode, x.city].filter(Boolean).join(" "), [x.state, x.country].filter(Boolean).join(", ")].filter(Boolean) as string[];
}

/** Paper-style invoice. Always rendered on a light background (it's a document). */
export function InvoiceDocument({ business: b, invoice: inv, className }: { business: DocBusiness; invoice: DocInvoice; className?: string }) {
  const m = (c: number) => formatMoney(c, inv.currency);
  const due = Math.max(inv.total - inv.amountPaid, 0);
  const c = inv.customer;
  const bank = [
    b.bankName && ["Bank", b.bankName], b.bankAccountName && ["Account name", b.bankAccountName], b.bankAccountNumber && ["Account no.", b.bankAccountNumber],
    b.iban && ["IBAN", b.iban], b.swift && ["SWIFT/BIC", b.swift],
  ].filter(Boolean) as [string, string][];
  const accent = inv.color || "#4f46e5";
  const minimal = inv.template === "minimal";
  const classic = inv.template === "classic";

  return (
    <div className={cn("relative mx-auto w-full overflow-hidden rounded-lg bg-white text-[13px] text-slate-800 shadow-card ring-1 ring-slate-200", className)} style={{ fontFamily: FONTS[inv.font] ?? FONTS.sans, colorScheme: "light" }}>
      {inv.template === "modern" && <div className="h-2" style={{ background: accent }} />}
      {inv.status === "PAID" && <div className="pointer-events-none absolute right-6 top-24 rotate-12 rounded-md border-4 px-3 py-1 text-xl font-black tracking-widest text-emerald-500/70 border-emerald-500/50">PAID</div>}
      <div className={cn("flex flex-col gap-6 p-6 sm:flex-row sm:justify-between sm:p-10", classic && "pb-8")} style={classic ? { background: `${accent}14` } : undefined}>
        <div className="min-w-0">
          {b.logo && <img src={b.logo} alt="" className="mb-3 max-h-14 max-w-[160px] object-contain" />}
          <p className="text-base font-bold text-slate-900">{b.name}</p>
          <div className="mt-1 space-y-0.5 text-xs text-slate-500">
            {addr(b).map((l, i) => <p key={i}>{l}</p>)}
            {b.email && <p>{b.email}</p>}{b.phone && <p>{b.phone}</p>}{b.website && <p>{b.website}</p>}
            {b.taxId && <p>Tax ID: {b.taxId}</p>}
          </div>
        </div>
        <div className="sm:text-right">
          <p className="text-3xl font-bold tracking-tight" style={{ color: minimal ? "#0f172a" : accent }}>INVOICE</p>
          <p className="mt-1 text-xs text-slate-500"># {inv.number || "—"}</p>
          <dl className="mt-4 grid grid-cols-[auto_auto] gap-x-6 gap-y-1 text-xs sm:justify-end">
            <dt className="text-slate-500">Issue date</dt><dd className="font-semibold">{formatDate(inv.issueDate)}</dd>
            <dt className="text-slate-500">Due date</dt><dd className="font-semibold">{formatDate(inv.dueDate)}</dd>
          </dl>
        </div>
      </div>

      <div className="flex flex-col gap-6 px-6 sm:flex-row sm:items-end sm:justify-between sm:px-10">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: accent }}>Bill to</p>
          {c ? (
            <div className="mt-1.5 space-y-0.5 text-xs text-slate-500">
              <p className="text-sm font-semibold text-slate-900">{c.company || c.name}</p>
              {c.company && <p>{c.name}</p>}
              {addr(c).map((l, i) => <p key={i}>{l}</p>)}
              {c.email && <p>{c.email}</p>}{c.phone && <p>{c.phone}</p>}
              {c.taxId && <p>Tax ID: {c.taxId}</p>}
            </div>
          ) : <p className="mt-1.5 text-xs italic text-slate-400">Select a customer</p>}
        </div>
        <div className="rounded-lg px-5 py-3 sm:min-w-[180px]" style={{ background: `${accent}17` }}>
          <p className="text-[11px] text-slate-500">{inv.status === "PAID" ? "Paid in full" : "Amount due"}</p>
          <p className="text-xl font-bold text-slate-900">{m(inv.status === "PAID" ? inv.total : due)}</p>
        </div>
      </div>

      <div className="mt-8 overflow-x-auto px-6 sm:px-10">
        <table className="w-full min-w-[400px] text-xs">
          <thead>
            <tr style={minimal ? undefined : { background: accent }} className={minimal ? "bg-slate-100 text-slate-500" : "text-white"}>
              <th className="rounded-l-md px-2 py-2 text-left font-semibold uppercase tracking-wide">Description</th>
              <th className="px-2 py-2 text-right font-semibold uppercase tracking-wide">Qty</th>
              <th className="px-2 py-2 text-right font-semibold uppercase tracking-wide">Unit price</th>
              <th className="px-2 py-2 text-right font-semibold uppercase tracking-wide">Tax</th>
              <th className="rounded-r-md px-2 py-2 text-right font-semibold uppercase tracking-wide">Amount</th>
            </tr>
          </thead>
          <tbody>
            {inv.items.length === 0 && <tr><td colSpan={5} className="px-3 py-6 text-center italic text-slate-400">No items yet</td></tr>}
            {inv.items.map((it, i) => (
              <tr key={i} className="border-b border-slate-100 align-top">
                <td className="whitespace-pre-wrap px-2 py-3 text-slate-800">{it.description || <span className="italic text-slate-400">Item description</span>}</td>
                <td className="num px-2 py-3 text-right">{+Number(it.quantity).toFixed(3)}</td>
                <td className="num px-2 py-3 text-right">{m(it.unitPrice)}</td>
                <td className="num px-2 py-3 text-right text-slate-500">{it.taxRate ? `${+Number(it.taxRate).toFixed(3)}%` : "—"}</td>
                <td className="num px-2 py-3 text-right font-semibold">{m(it.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end px-6 pt-4 sm:px-10">
        <dl className="num w-full max-w-[260px] space-y-1.5 text-xs">
          <div className="flex justify-between"><dt className="text-slate-500">Subtotal</dt><dd>{m(inv.subtotal)}</dd></div>
          {inv.discountTotal > 0 && <div className="flex justify-between"><dt className="text-slate-500">Discount{inv.discountType === "percent" ? ` (${+inv.discountValue.toFixed(2)}%)` : ""}</dt><dd>-{m(inv.discountTotal)}</dd></div>}
          {inv.taxTotal > 0 && <div className="flex justify-between"><dt className="text-slate-500">{inv.taxLabel || "Tax"}</dt><dd>{m(inv.taxTotal)}</dd></div>}
          <div className="flex justify-between border-t border-slate-200 pt-2 text-sm font-bold text-slate-900"><dt>Total</dt><dd>{m(inv.total)}</dd></div>
          {inv.amountPaid > 0 && <>
            <div className="flex justify-between"><dt className="text-slate-500">Paid</dt><dd>-{m(inv.amountPaid)}</dd></div>
            <div className="flex justify-between text-sm font-bold" style={{ color: accent }}><dt>Balance due</dt><dd>{m(due)}</dd></div>
          </>}
        </dl>
      </div>

      <div className="grid gap-6 p-6 sm:grid-cols-2 sm:p-10">
        {(inv.paymentInstructions || bank.length > 0) && (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: accent }}>Payment details</p>
            {inv.paymentInstructions && <p className="mt-1.5 whitespace-pre-wrap text-xs text-slate-600">{inv.paymentInstructions}</p>}
            {bank.length > 0 && <dl className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">{bank.map(([k, v]) => <div key={k} className="contents"><dt className="text-slate-500">{k}</dt><dd className="break-all text-slate-700">{v}</dd></div>)}</dl>}
          </div>
        )}
        {(inv.notes || inv.terms) && (
          <div className="space-y-4">
            {inv.notes && <div><p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: accent }}>Notes</p><p className="mt-1.5 whitespace-pre-wrap text-xs text-slate-600">{inv.notes}</p></div>}
            {inv.terms && <div><p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: accent }}>Terms</p><p className="mt-1.5 whitespace-pre-wrap text-xs text-slate-600">{inv.terms}</p></div>}
          </div>
        )}
      </div>
    </div>
  );
}
