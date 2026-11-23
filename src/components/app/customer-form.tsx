"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Customer } from "@prisma/client";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { createCustomerAction, updateCustomerAction, type CustomerInput } from "@/actions/customers";
import { CURRENCIES } from "@/lib/currencies";

const KEYS = ["name", "company", "email", "phone", "addressLine1", "addressLine2", "city", "state", "postalCode", "country", "taxId", "currency", "notes"] as const;

export function CustomerForm({ customer, onSaved, onCancel }: { customer?: Partial<Customer>; onSaved?: (c: Customer | null) => void; onCancel?: () => void }) {
  const [v, setV] = useState<Record<string, string>>(() => Object.fromEntries(KEYS.map((k) => [k, (customer?.[k] as string) ?? ""])));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const toast = useToast();
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setV((s) => ({ ...s, [k]: e.target.value }));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      const input = v as CustomerInput;
      const r = customer?.id ? await updateCustomerAction(customer.id, input) : await createCustomerAction(input);
      if ("error" in r && r.error) { setError(r.error); setErrors(("fieldErrors" in r && r.fieldErrors) || {}); return; }
      toast(customer?.id ? "Customer updated" : "Customer created");
      onSaved?.("customer" in r ? (r.customer as Customer) : null);
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {error && !Object.keys(errors).length && <p className="text-sm text-danger">{error}</p>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Contact name *" error={errors.name}><Input value={v.name} onChange={set("name")} required autoFocus /></Field>
        <Field label="Company"><Input value={v.company} onChange={set("company")} /></Field>
        <Field label="Email" error={errors.email}><Input type="email" value={v.email} onChange={set("email")} /></Field>
        <Field label="Phone"><Input value={v.phone} onChange={set("phone")} /></Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Address line 1" className="sm:col-span-2"><Input value={v.addressLine1} onChange={set("addressLine1")} /></Field>
        <Field label="Address line 2" className="sm:col-span-2"><Input value={v.addressLine2} onChange={set("addressLine2")} /></Field>
        <Field label="City"><Input value={v.city} onChange={set("city")} /></Field>
        <Field label="State / Region"><Input value={v.state} onChange={set("state")} /></Field>
        <Field label="Postal code"><Input value={v.postalCode} onChange={set("postalCode")} /></Field>
        <Field label="Country"><Input value={v.country} onChange={set("country")} /></Field>
        <Field label="Tax ID / VAT number"><Input value={v.taxId} onChange={set("taxId")} /></Field>
        <Field label="Preferred currency">
          <Select value={v.currency} onChange={set("currency")}>
            <option value="">Business default</option>
            {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
          </Select>
        </Field>
      </div>
      <Field label="Internal notes"><Textarea value={v.notes} onChange={set("notes")} placeholder="Only visible to your team" /></Field>
      <div className="flex justify-end gap-2 pt-2">
        {onCancel && <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>}
        <Button type="submit" loading={pending}>{customer?.id ? "Save changes" : "Create customer"}</Button>
      </div>
    </form>
  );
}

export function CustomerDialogButton({ customer, children, variant = "primary", size = "md", defaultOpen = false }: { customer?: Partial<Customer>; children: React.ReactNode; variant?: "primary" | "secondary" | "ghost"; size?: "sm" | "md"; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const router = useRouter();
  return (
    <>
      <Button variant={variant} size={size} onClick={() => setOpen(true)}>{children}</Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={customer?.id ? "Edit customer" : "New customer"} className="sm:max-w-2xl">
        <CustomerForm customer={customer} onCancel={() => setOpen(false)} onSaved={() => { setOpen(false); router.refresh(); }} />
      </Dialog>
    </>
  );
}
