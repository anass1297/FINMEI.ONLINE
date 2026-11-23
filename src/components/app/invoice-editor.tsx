"use client";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Customer } from "@prisma/client";
import { Plus, Trash2, ChevronUp, ChevronDown, Eye, PencilLine, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Card, CardHeader } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { CustomerForm } from "./customer-form";
import { InvoiceDocument, type DocBusiness } from "./invoice-document";
import { saveInvoiceAction } from "@/actions/invoices";
import { computeTotals } from "@/lib/calc";
import { formatMoney, toCents } from "@/lib/money";
import { addDays, parseInputDate, toInputDate } from "@/lib/dates";
import { CURRENCIES } from "@/lib/currencies";
import { cn } from "@/lib/utils";

export type EditorItem = { description: string; quantity: string; unitPrice: string; taxRate: string };
export type EditorState = {
  customerId: string; number: string; issueDate: string; dueDate: string; paymentDays: number; currency: string;
  discountType: "percent" | "fixed"; discountValue: string; taxLabel: string;
  notes: string; terms: string; paymentInstructions: string;
  template: "modern" | "classic" | "minimal"; color: string; font: "sans" | "serif" | "mono";
  items: EditorItem[];
};

const TERMS = [
  { v: 0, l: "Due on receipt" }, { v: 7, l: "Net 7" }, { v: 14, l: "Net 14" }, { v: 15, l: "Net 15" },
  { v: 30, l: "Net 30" }, { v: 45, l: "Net 45" }, { v: 60, l: "Net 60" }, { v: 90, l: "Net 90" },
];
const SWATCHES = ["#4f46e5", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444", "#ec4899", "#8b5cf6", "#0f172a"];

export function InvoiceEditor({ business, customers: initialCustomers, initial, invoiceId, status, nextNumber, defaultTaxRate }: {
  business: DocBusiness; customers: Customer[]; initial: EditorState; invoiceId?: string; status?: string; nextNumber: string; defaultTaxRate: number;
}) {
  const [s, setS] = useState<EditorState>(initial);
  const [customers, setCustomers] = useState(initialCustomers);
  const [newCustomer, setNewCustomer] = useState(false);
  const [view, setView] = useState<"edit" | "preview">("edit");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();
  const toast = useToast();

  const set = <K extends keyof EditorState>(k: K, v: EditorState[K]) => setS((x) => ({ ...x, [k]: v }));
  const setItem = (i: number, k: keyof EditorItem, v: string) => setS((x) => ({ ...x, items: x.items.map((it, j) => (j === i ? { ...it, [k]: v } : it)) }));
  const addItem = () => setS((x) => ({ ...x, items: [...x.items, { description: "", quantity: "1", unitPrice: "", taxRate: String(defaultTaxRate || "") }] }));
  const removeItem = (i: number) => setS((x) => ({ ...x, items: x.items.filter((_, j) => j !== i) }));
  const moveItem = (from: number, to: number) => setS((x) => {
    if (to < 0 || to >= x.items.length) return x;
    const items = [...x.items];
    const [m] = items.splice(from, 1);
    items.splice(to, 0, m!);
    return { ...x, items };
  });

  function setTerms(days: number) {
    const issue = parseInputDate(s.issueDate) ?? new Date();
    setS((x) => ({ ...x, paymentDays: days, dueDate: toInputDate(addDays(issue, days)) }));
  }
  function setIssue(v: string) {
    const issue = parseInputDate(v);
    setS((x) => ({ ...x, issueDate: v, dueDate: issue ? toInputDate(addDays(issue, x.paymentDays)) : x.dueDate }));
  }

  const customer = customers.find((c) => c.id === s.customerId) ?? null;
  const cents = useMemo(() => s.items.map((it) => ({ quantity: Number(it.quantity) || 0, unitPrice: toCents(it.unitPrice, s.currency), taxRate: Number(it.taxRate) || 0 })), [s.items, s.currency]);
  const discountValue = s.discountType === "fixed" ? toCents(s.discountValue, s.currency) : Number(s.discountValue) || 0;
  const totals = computeTotals(cents, s.discountType, discountValue);

  const doc = {
    number: s.number || nextNumber, status: status ?? "DRAFT", issueDate: parseInputDate(s.issueDate) ?? new Date(), dueDate: parseInputDate(s.dueDate) ?? new Date(),
    currency: s.currency, items: s.items.map((it, i) => ({ description: it.description, quantity: cents[i]!.quantity, unitPrice: cents[i]!.unitPrice, taxRate: cents[i]!.taxRate, amount: totals.lines[i]! })),
    subtotal: totals.subtotal, discountTotal: totals.discountTotal, discountType: s.discountType, discountValue, taxTotal: totals.taxTotal, total: totals.total, amountPaid: 0,
    taxLabel: s.taxLabel, notes: s.notes, terms: s.terms, paymentInstructions: s.paymentInstructions, template: s.template, color: s.color, font: s.font,
    customer,
  };

  function save(intent: "draft" | "send" | "save") {
    setError("");
    const items = s.items.filter((it) => it.description.trim() || Number(it.unitPrice));
    if (!items.length) { setError("Add at least one line item."); return; }
    start(async () => {
      const r = await saveInvoiceAction({ ...s, items, number: s.number || null, customerId: s.customerId || null }, { id: invoiceId, intent });
      if ("error" in r && r.error) { setError(r.error); toast(r.error, "error"); return; }
      toast(invoiceId ? "Invoice saved" : intent === "send" ? "Invoice created and marked as sent" : "Draft saved");
      router.push(`/invoices/${r.id}`);
      router.refresh();
    });
  }

  const isDraft = !status || status === "DRAFT";

  return (
    <div>
      <div className="mb-4 inline-flex rounded-lg border bg-muted p-0.5 xl:hidden">
        {(["edit", "preview"] as const).map((v) => (
          <button key={v} onClick={() => setView(v)} className={cn("flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium capitalize", view === v ? "bg-surface shadow-sm" : "text-subtle")}>
            {v === "edit" ? <PencilLine size={13} /> : <Eye size={13} />}{v}
          </button>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className={cn("space-y-5", view === "preview" && "hidden xl:block")}>
          <Card>
            <CardHeader title="Customer" action={<Button size="sm" variant="secondary" onClick={() => setNewCustomer(true)}><UserPlus size={14} /> New</Button>} />
            <div className="p-5">
              <Select value={s.customerId} onChange={(e) => {
                const c = customers.find((x) => x.id === e.target.value);
                setS((x) => ({ ...x, customerId: e.target.value, currency: c?.currency || x.currency }));
              }}>
                <option value="">Select a customer…</option>
                {customers.map((c) => <option key={c.id} value={c.id}>{c.company ? `${c.company} (${c.name})` : c.name}</option>)}
              </Select>
            </div>
          </Card>

          <Card>
            <CardHeader title="Details" />
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              <Field label="Invoice number" hint={!invoiceId ? "Leave blank to auto-number" : undefined}><Input value={s.number} placeholder={nextNumber} onChange={(e) => set("number", e.target.value)} /></Field>
              <Field label="Currency">
                <Select value={s.currency} onChange={(e) => set("currency", e.target.value)}>{CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code} — {c.name}</option>)}</Select>
              </Field>
              <Field label="Issue date"><Input type="date" value={s.issueDate} onChange={(e) => setIssue(e.target.value)} /></Field>
              <Field label="Payment terms">
                <Select value={TERMS.some((t) => t.v === s.paymentDays) ? s.paymentDays : "custom"} onChange={(e) => e.target.value !== "custom" && setTerms(Number(e.target.value))}>
                  {TERMS.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}
                  {!TERMS.some((t) => t.v === s.paymentDays) && <option value="custom">Custom ({s.paymentDays} days)</option>}
                </Select>
              </Field>
              <Field label="Due date" className="sm:col-span-2">
                <Input type="date" value={s.dueDate} min={s.issueDate} onChange={(e) => {
                  const due = parseInputDate(e.target.value), issue = parseInputDate(s.issueDate);
                  setS((x) => ({ ...x, dueDate: e.target.value, paymentDays: due && issue ? Math.max(0, Math.round((due.getTime() - issue.getTime()) / 86_400_000)) : x.paymentDays }));
                }} />
              </Field>
            </div>
          </Card>

          <Card>
            <CardHeader title="Line items" description="Products or services — add as many as you need." />
            <div className="divide-y">
              {s.items.map((it, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 p-4">
                  <div className="col-span-12 flex items-start gap-2">
                    <div className="flex flex-col pt-0.5 text-subtle">
                      <button type="button" aria-label="Move up" onClick={() => moveItem(i, i - 1)} className="hover:text-fg disabled:opacity-30" disabled={i === 0}><ChevronUp size={14} /></button>
                      <button type="button" aria-label="Move down" onClick={() => moveItem(i, i + 1)} className="hover:text-fg disabled:opacity-30" disabled={i === s.items.length - 1}><ChevronDown size={14} /></button>
                    </div>
                    <Textarea rows={1} value={it.description} onChange={(e) => setItem(i, "description", e.target.value)} placeholder="Description (e.g. Website design — homepage)" className="min-h-[36px]" />
                  </div>
                  <Field label="Qty" className="col-span-3 sm:col-span-2"><Input inputMode="decimal" value={it.quantity} onChange={(e) => setItem(i, "quantity", e.target.value)} /></Field>
                  <Field label="Unit price" className="col-span-5 sm:col-span-4"><Input inputMode="decimal" value={it.unitPrice} placeholder="0.00" onChange={(e) => setItem(i, "unitPrice", e.target.value)} /></Field>
                  <Field label="Tax %" className="col-span-4 sm:col-span-2"><Input inputMode="decimal" value={it.taxRate} placeholder="0" onChange={(e) => setItem(i, "taxRate", e.target.value)} /></Field>
                  <div className="col-span-12 flex items-end justify-between gap-2 sm:col-span-4 sm:justify-end">
                    <div className="text-right"><p className="label mb-0.5">Amount</p><p className="num h-9 text-sm font-semibold leading-9">{formatMoney(totals.lines[i] ?? 0, s.currency)}</p></div>
                    <Button type="button" variant="danger-ghost" size="icon" aria-label="Remove line" onClick={() => removeItem(i)} disabled={s.items.length === 1}><Trash2 size={15} /></Button>
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t p-4"><Button type="button" variant="secondary" size="sm" onClick={addItem}><Plus size={14} /> Add line</Button></div>
          </Card>

          <Card>
            <CardHeader title="Discount & tax" />
            <div className="grid gap-4 p-5 sm:grid-cols-3">
              <Field label="Discount type"><Select value={s.discountType} onChange={(e) => set("discountType", e.target.value as "percent" | "fixed")}><option value="percent">Percentage (%)</option><option value="fixed">Fixed amount</option></Select></Field>
              <Field label={s.discountType === "percent" ? "Discount %" : `Discount (${s.currency})`}><Input inputMode="decimal" value={s.discountValue} placeholder="0" onChange={(e) => set("discountValue", e.target.value)} /></Field>
              <Field label="Tax label" hint="e.g. VAT, GST, Sales tax"><Input value={s.taxLabel} onChange={(e) => set("taxLabel", e.target.value)} /></Field>
            </div>
          </Card>

          <Card>
            <CardHeader title="Notes & payment" />
            <div className="space-y-4 p-5">
              <Field label="Payment instructions" hint="Bank details from your business settings are added automatically."><Textarea value={s.paymentInstructions} onChange={(e) => set("paymentInstructions", e.target.value)} /></Field>
              <Field label="Notes (visible to customer)"><Textarea value={s.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Thank you for your business!" /></Field>
              <Field label="Terms & conditions"><Textarea value={s.terms} onChange={(e) => set("terms", e.target.value)} /></Field>
            </div>
          </Card>

          <Card>
            <CardHeader title="Design" description="Template, brand color and typography." />
            <div className="space-y-5 p-5">
              <div className="grid grid-cols-3 gap-2">
                {(["modern", "classic", "minimal"] as const).map((t) => (
                  <button key={t} type="button" onClick={() => set("template", t)} className={cn("rounded-lg border p-3 text-left text-xs font-medium capitalize transition", s.template === t ? "border-brand ring-2 ring-brand/20" : "hover:bg-muted")}>
                    <div className="mb-2 h-10 overflow-hidden rounded bg-white ring-1 ring-slate-200">
                      {t === "modern" && <div className="h-1.5" style={{ background: s.color }} />}
                      {t === "classic" && <div className="h-4" style={{ background: `${s.color}22` }} />}
                      <div className="m-1.5 h-1.5 w-8 rounded" style={{ background: t === "minimal" ? "#0f172a" : s.color }} />
                    </div>
                    {t}
                  </button>
                ))}
              </div>
              <div>
                <p className="label">Accent color</p>
                <div className="flex flex-wrap items-center gap-2">
                  {SWATCHES.map((c) => <button key={c} type="button" onClick={() => set("color", c)} aria-label={c} className={cn("h-7 w-7 rounded-full ring-offset-2 ring-offset-surface transition", s.color === c && "ring-2 ring-fg")} style={{ background: c }} />)}
                  <label className="relative h-7 w-7 cursor-pointer overflow-hidden rounded-full border bg-[conic-gradient(red,yellow,lime,aqua,blue,magenta,red)]">
                    <input type="color" value={s.color} onChange={(e) => set("color", e.target.value)} className="absolute inset-0 opacity-0" />
                  </label>
                  <Input value={s.color} onChange={(e) => /^#[0-9a-f]{0,6}$/i.test(e.target.value) && set("color", e.target.value)} className="w-28 font-mono text-xs" />
                </div>
              </div>
              <Field label="Font">
                <Select value={s.font} onChange={(e) => set("font", e.target.value as EditorState["font"])}><option value="sans">Sans-serif (Helvetica)</option><option value="serif">Serif (Times)</option><option value="mono">Monospace (Courier)</option></Select>
              </Field>
            </div>
          </Card>
        </div>

        <div className={cn("xl:sticky xl:top-20 xl:self-start", view === "edit" && "hidden xl:block")}>
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-wide text-subtle">Live preview</p>
            <p className="num text-sm text-subtle">Total <span className="font-semibold text-fg">{formatMoney(totals.total, s.currency)}</span></p>
          </div>
          <div className="max-h-[calc(100vh-11rem)] overflow-y-auto rounded-xl bg-muted/60 p-3 sm:p-5">
            <InvoiceDocument business={business} invoice={doc} />
          </div>
        </div>
      </div>

      <div className="sticky bottom-0 z-10 -mx-4 mt-6 border-t bg-bg/90 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <div className="flex flex-wrap items-center justify-end gap-2">
          {error && <p className="mr-auto text-sm text-danger">{error}</p>}
          <Button variant="ghost" onClick={() => router.back()}>Cancel</Button>
          {isDraft ? (
            <>
              <Button variant="secondary" loading={pending} onClick={() => save("draft")}>Save draft</Button>
              <Button loading={pending} onClick={() => save("send")}>Save & mark as sent</Button>
            </>
          ) : <Button loading={pending} onClick={() => save("save")}>Save changes</Button>}
        </div>
      </div>

      <Dialog open={newCustomer} onClose={() => setNewCustomer(false)} title="New customer" className="sm:max-w-2xl">
        <CustomerForm onCancel={() => setNewCustomer(false)} onSaved={(c) => {
          if (c) { setCustomers((x) => [...x, c].sort((a, b) => a.name.localeCompare(b.name))); setS((x) => ({ ...x, customerId: c.id, currency: c.currency || x.currency })); }
          setNewCustomer(false);
        }} />
      </Dialog>
    </div>
  );
}
