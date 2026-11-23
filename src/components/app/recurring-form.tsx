"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Customer } from "@prisma/client";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { saveRecurringAction, type RecurringInput } from "@/actions/recurring";
import { computeTotals } from "@/lib/calc";
import { formatMoney, toCents } from "@/lib/money";
import { CURRENCIES } from "@/lib/currencies";
import { advanceDate } from "@/lib/recurring-client";
import { formatDate, parseInputDate } from "@/lib/dates";

type Item = { description: string; quantity: string; unitPrice: string; taxRate: string };
export type RecurringValues = Omit<RecurringInput, "items" | "autoSend" | "intervalCount" | "maxOccurrences" | "paymentDays" | "discountValue" | "notes" | "terms"> & {
  notes: string; terms: string;
  items: Item[]; autoSend: boolean; intervalCount: string; maxOccurrences: string; paymentDays: string; discountValue: string; endDate: string;
};

export function RecurringForm({ initial, customers, id }: { initial: RecurringValues; customers: Customer[]; id?: string }) {
  const [v, setV] = useState(initial);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();
  const toast = useToast();
  const set = <K extends keyof RecurringValues>(k: K, val: RecurringValues[K]) => setV((x) => ({ ...x, [k]: val }));
  const setItem = (i: number, k: keyof Item, val: string) => setV((x) => ({ ...x, items: x.items.map((it, j) => (j === i ? { ...it, [k]: val } : it)) }));

  const cents = v.items.map((i) => ({ quantity: Number(i.quantity) || 0, unitPrice: toCents(i.unitPrice, v.currency), taxRate: Number(i.taxRate) || 0 }));
  const totals = computeTotals(cents, v.discountType, v.discountType === "fixed" ? toCents(v.discountValue, v.currency) : Number(v.discountValue) || 0);

  const preview: Date[] = [];
  let d = parseInputDate(v.startDate);
  for (let i = 0; d && i < 4; i++) { preview.push(d); d = advanceDate(d, v.frequency, Number(v.intervalCount) || 1, v.intervalUnit ?? "MONTH"); }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    start(async () => {
      const r = await saveRecurringAction({
        ...v, intervalCount: Number(v.intervalCount) || 1, paymentDays: Number(v.paymentDays) || 0,
        maxOccurrences: v.endMode === "count" ? Number(v.maxOccurrences) || 1 : undefined, items: v.items,
      }, id);
      if (r.error) { setError(r.error); return; }
      toast(id ? "Schedule updated" : "Recurring invoice scheduled");
      router.push("/recurring"); router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        {error && <p className="rounded-lg border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">{error}</p>}
        <Card>
          <CardHeader title="Schedule" />
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <Field label="Schedule name"><Input value={v.name} onChange={(e) => set("name", e.target.value)} placeholder="Monthly retainer — Acme" required /></Field>
            <Field label="Customer">
              <Select value={v.customerId} onChange={(e) => set("customerId", e.target.value)} required>
                <option value="">Select a customer…</option>
                {customers.map((c) => <option key={c.id} value={c.id}>{c.company || c.name}</option>)}
              </Select>
            </Field>
            <Field label="Frequency">
              <Select value={v.frequency} onChange={(e) => set("frequency", e.target.value as RecurringValues["frequency"])}>
                <option value="WEEKLY">Weekly</option><option value="MONTHLY">Monthly</option><option value="QUARTERLY">Quarterly</option><option value="YEARLY">Annually</option><option value="CUSTOM">Custom…</option>
              </Select>
            </Field>
            {v.frequency === "CUSTOM" ? (
              <Field label="Repeat every">
                <div className="flex gap-2">
                  <Input type="number" min={1} value={v.intervalCount} onChange={(e) => set("intervalCount", e.target.value)} className="w-20" />
                  <Select value={v.intervalUnit} onChange={(e) => set("intervalUnit", e.target.value as RecurringValues["intervalUnit"])}><option value="DAY">day(s)</option><option value="WEEK">week(s)</option><option value="MONTH">month(s)</option><option value="YEAR">year(s)</option></Select>
                </div>
              </Field>
            ) : <div className="hidden sm:block" />}
            <Field label="First invoice date"><Input type="date" value={v.startDate} onChange={(e) => set("startDate", e.target.value)} required /></Field>
            <Field label="Ends">
              <Select value={v.endMode} onChange={(e) => set("endMode", e.target.value as RecurringValues["endMode"])}><option value="never">Never</option><option value="date">On a date</option><option value="count">After a number of invoices</option></Select>
            </Field>
            {v.endMode === "date" && <Field label="End date"><Input type="date" value={v.endDate} onChange={(e) => set("endDate", e.target.value)} /></Field>}
            {v.endMode === "count" && <Field label="Number of invoices"><Input type="number" min={1} value={v.maxOccurrences} onChange={(e) => set("maxOccurrences", e.target.value)} /></Field>}
            <Field label="Payment terms (days)"><Input type="number" min={0} value={v.paymentDays} onChange={(e) => set("paymentDays", e.target.value)} /></Field>
            <Field label="Currency"><Select value={v.currency} onChange={(e) => set("currency", e.target.value)}>{CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}</Select></Field>
          </div>
          <label className="flex items-start gap-3 border-t p-5 text-sm">
            <input type="checkbox" checked={v.autoSend} onChange={(e) => set("autoSend", e.target.checked)} className="mt-0.5 h-4 w-4 accent-[rgb(var(--brand))]" />
            <span><span className="font-medium">Issue automatically</span><span className="block text-subtle">Generated invoices are marked as sent. Otherwise they are created as drafts for you to review.</span></span>
          </label>
        </Card>
        <Card>
          <CardHeader title="Line items" />
          <div className="divide-y">
            {v.items.map((it, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 p-4">
                <Input className="col-span-12 sm:col-span-5" value={it.description} placeholder="Description" onChange={(e) => setItem(i, "description", e.target.value)} />
                <Input className="col-span-3 sm:col-span-2" inputMode="decimal" value={it.quantity} placeholder="Qty" onChange={(e) => setItem(i, "quantity", e.target.value)} />
                <Input className="col-span-4 sm:col-span-2" inputMode="decimal" value={it.unitPrice} placeholder="Price" onChange={(e) => setItem(i, "unitPrice", e.target.value)} />
                <Input className="col-span-3 sm:col-span-2" inputMode="decimal" value={it.taxRate} placeholder="Tax %" onChange={(e) => setItem(i, "taxRate", e.target.value)} />
                <Button type="button" variant="danger-ghost" size="icon" className="col-span-2 sm:col-span-1" disabled={v.items.length === 1} onClick={() => set("items", v.items.filter((_, j) => j !== i))} aria-label="Remove"><Trash2 size={15} /></Button>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-end justify-between gap-4 border-t p-4">
            <Button type="button" variant="secondary" size="sm" onClick={() => set("items", [...v.items, { description: "", quantity: "1", unitPrice: "", taxRate: "" }])}><Plus size={14} /> Add line</Button>
            <div className="flex gap-2">
              <Select value={v.discountType} onChange={(e) => set("discountType", e.target.value as "percent" | "fixed")} className="w-32"><option value="percent">Discount %</option><option value="fixed">Discount amt</option></Select>
              <Input value={v.discountValue} onChange={(e) => set("discountValue", e.target.value)} placeholder="0" className="w-24" inputMode="decimal" />
            </div>
          </div>
        </Card>
        <Card>
          <CardHeader title="Notes" />
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <Field label="Notes"><Textarea value={v.notes ?? ""} onChange={(e) => set("notes", e.target.value)} /></Field>
            <Field label="Terms"><Textarea value={v.terms ?? ""} onChange={(e) => set("terms", e.target.value)} /></Field>
          </div>
        </Card>
      </div>
      <div className="space-y-6">
        <Card className="p-5 lg:sticky lg:top-20">
          <p className="text-xs font-medium text-subtle">Each invoice</p>
          <p className="num mt-1 text-2xl font-semibold">{formatMoney(totals.total, v.currency)}</p>
          <dl className="num mt-3 space-y-1 text-xs text-subtle">
            <div className="flex justify-between"><dt>Subtotal</dt><dd>{formatMoney(totals.subtotal, v.currency)}</dd></div>
            {totals.discountTotal > 0 && <div className="flex justify-between"><dt>Discount</dt><dd>-{formatMoney(totals.discountTotal, v.currency)}</dd></div>}
            <div className="flex justify-between"><dt>Tax</dt><dd>{formatMoney(totals.taxTotal, v.currency)}</dd></div>
          </dl>
          <div className="mt-5 border-t pt-4">
            <p className="label">Upcoming invoices</p>
            <ul className="space-y-1.5 text-sm">{preview.map((p, i) => <li key={i} className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-brand" />{formatDate(p, "long")}</li>)}</ul>
          </div>
          <div className="mt-6 flex gap-2">
            <Button type="button" variant="secondary" onClick={() => router.push("/recurring")} className="flex-1">Cancel</Button>
            <Button type="submit" loading={pending} className="flex-1">{id ? "Save" : "Create schedule"}</Button>
          </div>
        </Card>
      </div>
    </form>
  );
}
