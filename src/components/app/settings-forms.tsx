"use client";
import { useEffect, useState, useTransition } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { signOut } from "next-auth/react";
import type { Business, ExpenseCategory } from "@prisma/client";
import { Upload, X, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { ThemeToggle } from "@/components/theme";
import { addCategoryAction, deleteCategoryAction, updateBusinessAction } from "@/actions/business";
import { changePasswordAction, deleteAccountAction, updateProfileAction } from "@/actions/profile";
import type { ActionState } from "@/actions/types";
import { CURRENCIES } from "@/lib/currencies";
import { cn } from "@/lib/utils";

function Save({ label = "Save changes" }: { label?: string }) {
  const { pending } = useFormStatus();
  return <Button type="submit" loading={pending}>{label}</Button>;
}

function useResultToast(state: ActionState) {
  const toast = useToast();
  useEffect(() => {
    if (state?.ok && state.message) toast(state.message);
    else if (state?.error) toast(state.error, "error");
  }, [state, toast]);
}

function Section({ title, description, section, children, action = updateBusinessAction }: { title: string; description?: string; section: string; children: (fe: Record<string, string>) => React.ReactNode; action?: (s: ActionState, fd: FormData) => Promise<ActionState> }) {
  const [state, formAction] = useFormState<ActionState, FormData>(action, null);
  useResultToast(state);
  return (
    <Card>
      <CardHeader title={title} description={description} />
      <form action={formAction}>
        <input type="hidden" name="_section" value={section} />
        <div className="p-5">{children(state?.fieldErrors ?? {})}</div>
        <div className="flex items-center justify-end gap-3 border-t bg-muted/30 px-5 py-3">
          {state?.error && !state.fieldErrors && <p className="mr-auto text-sm text-danger">{state.error}</p>}
          <Save />
        </div>
      </form>
    </Card>
  );
}

export function BusinessSettings({ b, categories }: { b: Business; categories: ExpenseCategory[] }) {
  const [logo, setLogo] = useState<string | null>(b.logo);
  const [removeLogo, setRemoveLogo] = useState(false);
  const [color, setColor] = useState(b.brandColor);
  const [template, setTemplate] = useState(b.invoiceTemplate);
  const [cats, setCats] = useState(categories);
  const [newCat, setNewCat] = useState({ name: "", color: "#6366f1" });
  const [, start] = useTransition();
  const toast = useToast();
  const v = (k: keyof Business) => (b[k] as string | null) ?? "";

  return (
    <div className="space-y-6">
      <Section title="Business profile" description="Shown on invoices and customer-facing pages." section="profile">
        {(fe) => (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Business name" error={fe.name}><Input name="name" defaultValue={b.name} required /></Field>
            <Field label="Default currency" error={fe.currency}><Select name="currency" defaultValue={b.currency}>{CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code} — {c.name}</option>)}</Select></Field>
            <Field label="Email" error={fe.email}><Input name="email" type="email" defaultValue={v("email")} /></Field>
            <Field label="Phone"><Input name="phone" defaultValue={v("phone")} /></Field>
            <Field label="Website"><Input name="website" defaultValue={v("website")} placeholder="https://" /></Field>
            <Field label="Tax ID / VAT number"><Input name="taxId" defaultValue={v("taxId")} /></Field>
            <Field label="Address line 1" className="sm:col-span-2"><Input name="addressLine1" defaultValue={v("addressLine1")} /></Field>
            <Field label="Address line 2" className="sm:col-span-2"><Input name="addressLine2" defaultValue={v("addressLine2")} /></Field>
            <Field label="City"><Input name="city" defaultValue={v("city")} /></Field>
            <Field label="State / Region"><Input name="state" defaultValue={v("state")} /></Field>
            <Field label="Postal code"><Input name="postalCode" defaultValue={v("postalCode")} /></Field>
            <Field label="Country"><Input name="country" defaultValue={v("country")} /></Field>
          </div>
        )}
      </Section>

      <Section title="Invoice numbering & defaults" description="Applied to new invoices." section="invoicing">
        {(fe) => (
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Prefix" error={fe.invoicePrefix}><Input name="invoicePrefix" defaultValue={b.invoicePrefix} /></Field>
            <Field label="Next number" error={fe.nextInvoiceNumber}><Input name="nextInvoiceNumber" type="number" min={1} defaultValue={b.nextInvoiceNumber} /></Field>
            <Field label="Digits (zero padding)" error={fe.invoiceNumberPad}><Input name="invoiceNumberPad" type="number" min={1} max={10} defaultValue={b.invoiceNumberPad} /></Field>
            <Field label="Default payment terms (days)" error={fe.defaultPaymentDays}><Input name="defaultPaymentDays" type="number" min={0} defaultValue={b.defaultPaymentDays} /></Field>
            <Field label="Default tax rate %" error={fe.defaultTaxRate}><Input name="defaultTaxRate" inputMode="decimal" defaultValue={b.defaultTaxRate} /></Field>
            <Field label="Tax label" error={fe.taxLabel} hint="VAT, GST, Sales tax…"><Input name="taxLabel" defaultValue={b.taxLabel} /></Field>
            <Field label="Default notes" className="sm:col-span-3"><Textarea name="defaultNotes" defaultValue={v("defaultNotes")} placeholder="Thank you for your business!" /></Field>
            <Field label="Default terms" className="sm:col-span-3"><Textarea name="defaultTerms" defaultValue={v("defaultTerms")} placeholder="Late payments incur a 1.5% monthly fee." /></Field>
          </div>
        )}
      </Section>

      <Section title="Bank account & payment details" description="Printed on every invoice so customers know how to pay you." section="payment">
        {() => (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Bank name"><Input name="bankName" defaultValue={v("bankName")} /></Field>
            <Field label="Account holder"><Input name="bankAccountName" defaultValue={v("bankAccountName")} /></Field>
            <Field label="Account number"><Input name="bankAccountNumber" defaultValue={v("bankAccountNumber")} /></Field>
            <Field label="IBAN"><Input name="iban" defaultValue={v("iban")} /></Field>
            <Field label="SWIFT / BIC"><Input name="swift" defaultValue={v("swift")} /></Field>
            <div className="hidden sm:block" />
            <Field label="Default payment instructions" className="sm:col-span-2"><Textarea name="paymentInstructions" defaultValue={v("paymentInstructions")} placeholder="Please include the invoice number as payment reference." /></Field>
          </div>
        )}
      </Section>

      <Section title="Invoice branding" description="Logo, accent color, font and template." section="branding">
        {(fe) => (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex h-20 w-40 items-center justify-center overflow-hidden rounded-lg border bg-white">
                {logo && !removeLogo ? <img src={logo} alt="Logo" className="max-h-16 max-w-[140px] object-contain" /> : <span className="text-xs text-slate-400">No logo</span>}
              </div>
              <div className="flex flex-col gap-2">
                <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border bg-surface px-4 text-sm font-medium hover:bg-muted">
                  <Upload size={15} /> Upload logo
                  <input type="file" name="logo" accept="image/png,image/jpeg" className="hidden" onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    if (f.size > 512 * 1024) { toast("Logo must be 512KB or smaller", "error"); e.target.value = ""; return; }
                    setRemoveLogo(false);
                    const r = new FileReader(); r.onload = () => setLogo(r.result as string); r.readAsDataURL(f);
                  }} />
                </label>
                {logo && !removeLogo && <button type="button" onClick={() => setRemoveLogo(true)} className="text-left text-xs text-danger hover:underline">Remove logo</button>}
                <p className="text-xs text-subtle">PNG or JPEG, max 512KB</p>
              </div>
              <input type="hidden" name="_removeLogo" value={removeLogo ? "1" : "0"} />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Brand color" error={fe.brandColor}>
                <div className="flex gap-2"><input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-9 w-12 cursor-pointer rounded-lg border bg-surface p-1" /><Input name="brandColor" value={color} onChange={(e) => setColor(e.target.value)} className="font-mono" /></div>
              </Field>
              <Field label="Font"><Select name="invoiceFont" defaultValue={b.invoiceFont}><option value="sans">Sans-serif</option><option value="serif">Serif</option><option value="mono">Monospace</option></Select></Field>
              <Field label="Template">
                <input type="hidden" name="invoiceTemplate" value={template} />
                <div className="flex gap-1.5">{["modern", "classic", "minimal"].map((t) => (
                  <button key={t} type="button" onClick={() => setTemplate(t)} className={cn("h-9 flex-1 rounded-lg border text-xs font-medium capitalize", template === t ? "border-brand bg-brand-soft text-brand" : "hover:bg-muted")}>{t}</button>
                ))}</div>
              </Field>
            </div>
          </div>
        )}
      </Section>

      <Card>
        <CardHeader title="Expense categories" description="Organize spending for reports." />
        <div className="p-5">
          <div className="flex flex-wrap gap-2">
            {cats.map((c) => (
              <span key={c.id} className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs">
                <span className="h-2 w-2 rounded-full" style={{ background: c.color }} />{c.name}
                <button aria-label={`Delete ${c.name}`} className="text-subtle hover:text-danger" onClick={() => start(async () => { await deleteCategoryAction(c.id); setCats(cats.filter((x) => x.id !== c.id)); toast("Category removed"); })}><X size={12} /></button>
              </span>
            ))}
          </div>
          <div className="mt-4 flex max-w-md gap-2">
            <input type="color" value={newCat.color} onChange={(e) => setNewCat({ ...newCat, color: e.target.value })} className="h-9 w-12 rounded-lg border bg-surface p-1" />
            <Input value={newCat.name} onChange={(e) => setNewCat({ ...newCat, name: e.target.value })} placeholder="New category name" />
            <Button variant="secondary" disabled={!newCat.name.trim()} onClick={() => start(async () => {
              const r = await addCategoryAction(newCat.name, newCat.color);
              if ("category" in r && r.category) { setCats([...cats, r.category]); setNewCat({ name: "", color: newCat.color }); toast("Category added"); } else toast(r.error ?? "Failed", "error");
            })}><Plus size={15} /> Add</Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

export function ProfileSettings({ name, email, hasPassword, google }: { name: string; email: string; hasPassword: boolean; google: boolean }) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();
  return (
    <div className="space-y-6">
      <Section title="Profile" section="profile" action={updateProfileAction}>
        {(fe) => (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Full name" error={fe.name}><Input name="name" defaultValue={name} required /></Field>
            <Field label="Email" hint={google ? "Linked to Google sign-in" : "Contact support to change your email"}><Input value={email} disabled /></Field>
          </div>
        )}
      </Section>
      <Section title={hasPassword ? "Change password" : "Set a password"} description={hasPassword ? undefined : "You signed up with Google. Add a password to also sign in with email."} section="password" action={changePasswordAction}>
        {(fe) => (
          <div className="grid gap-4 sm:grid-cols-3">
            {hasPassword && <Field label="Current password" error={fe.current}><Input name="current" type="password" autoComplete="current-password" /></Field>}
            <Field label="New password" error={fe.password}><Input name="password" type="password" autoComplete="new-password" /></Field>
            <Field label="Confirm new password" error={fe.confirm}><Input name="confirm" type="password" autoComplete="new-password" /></Field>
          </div>
        )}
      </Section>
      <Card>
        <CardHeader title="Appearance" />
        <div className="p-5"><ThemeToggle /></div>
      </Card>
      <Card className="border-danger/30">
        <CardHeader title="Danger zone" description="Permanently delete your account and every business you own." />
        <div className="flex flex-wrap gap-3 p-5">
          <Button variant="secondary" onClick={() => signOut({ callbackUrl: "/login" })}>Sign out</Button>
          <Button variant="danger" onClick={() => setDeleteOpen(true)}>Delete account</Button>
        </div>
      </Card>
      <Dialog open={deleteOpen} onClose={() => setDeleteOpen(false)} title="Delete your account?" description="All businesses you own — with their invoices, customers, expenses and files — will be permanently deleted.">
        <Field label={`Type ${email} to confirm`} error={err}><Input value={confirm} onChange={(e) => setConfirm(e.target.value)} /></Field>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setDeleteOpen(false)}>Cancel</Button>
          <Button variant="danger" loading={pending} disabled={confirm.trim().toLowerCase() !== email} onClick={() => start(async () => {
            const r = await deleteAccountAction(confirm);
            if (r.error) setErr(r.error); else signOut({ callbackUrl: "/" });
          })}>Delete forever</Button>
        </div>
      </Dialog>
    </div>
  );
}

