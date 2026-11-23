"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Pencil, Download, Link2, Send, Copy, Ban, RotateCcw, Trash2, Wallet, CheckCheck, X, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { useToast } from "@/components/ui/toast";
import { PAYMENT_METHODS } from "@/lib/payments/providers";
import {
  cancelInvoiceAction, deleteInvoiceAction, deletePaymentAction, duplicateInvoiceAction, markSentAction,
  recordPaymentAction, regenerateLinkAction, restoreInvoiceAction, sendInvoiceEmailAction,
} from "@/actions/invoices";

export function InvoiceToolbar({ id, status, balance, balanceMajor, currency, publicUrl, customerEmail, today }: {
  id: string; status: string; balance: number; balanceMajor: string; currency: string; publicUrl: string; customerEmail: string; today: string;
}) {
  const [pay, setPay] = useState(false);
  const [send, setSend] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();
  const toast = useToast();
  const run = (fn: () => Promise<{ error?: string; ok?: boolean; id?: string } | undefined>, msg: string, after?: (r: { id?: string }) => void) =>
    start(async () => {
      const r = (await fn()) ?? {};
      if (r.error) toast(r.error, "error");
      else { toast(msg); after ? after(r) : router.refresh(); }
    });

  const cancelled = status === "CANCELLED";

  return (
    <div className="no-print flex flex-wrap gap-2">
      {!cancelled && balance > 0 && status !== "DRAFT" && <Button onClick={() => setPay(true)}><Wallet size={15} /> Record payment</Button>}
      {status === "DRAFT" && <Button loading={pending} onClick={() => run(() => markSentAction(id), "Marked as sent")}><CheckCheck size={15} /> Mark as sent</Button>}
      {!cancelled && <Button variant="secondary" onClick={() => setSend(true)}><Send size={15} /> Email</Button>}
      {!cancelled && <Link href={`/invoices/${id}/edit`} className="inline-flex h-9 items-center gap-2 rounded-lg border bg-surface px-4 text-sm font-medium hover:bg-muted"><Pencil size={15} /> Edit</Link>}
      <a href={`/api/invoices/${id}/pdf`} className="inline-flex h-9 items-center gap-2 rounded-lg border bg-surface px-4 text-sm font-medium hover:bg-muted"><Download size={15} /> PDF</a>
      <Button variant="secondary" onClick={async () => { await navigator.clipboard.writeText(publicUrl); toast("Public link copied"); }}><Link2 size={15} /> Copy link</Button>
      <Button variant="ghost" loading={pending} onClick={() => run(() => duplicateInvoiceAction(id), "Invoice duplicated", (r) => router.push(`/invoices/${r.id}/edit`))}><Copy size={15} /> Duplicate</Button>
      <ConfirmButton variant="ghost" size="md" confirmLabel="Regenerate" title="Regenerate public link?" description="The current link will stop working immediately. Use this if a link was shared by mistake."
        action={() => regenerateLinkAction(id)} successMessage="New link generated" onDone={() => router.refresh()}><RefreshCw size={15} /> New link</ConfirmButton>
      {cancelled ? (
        <Button variant="ghost" loading={pending} onClick={() => run(() => restoreInvoiceAction(id), "Invoice restored")}><RotateCcw size={15} /> Restore</Button>
      ) : (
        <ConfirmButton variant="ghost" size="md" confirmLabel="Cancel invoice" title="Cancel this invoice?" description="It will be excluded from revenue and outstanding totals. You can restore it later."
          action={() => cancelInvoiceAction(id)} successMessage="Invoice cancelled" onDone={() => router.refresh()}><Ban size={15} /> Cancel</ConfirmButton>
      )}
      <ConfirmButton size="md" title="Delete this invoice permanently?" description="This also deletes its payment records. This cannot be undone."
        action={() => deleteInvoiceAction(id)} successMessage="Invoice deleted" onDone={() => router.push("/invoices")}><Trash2 size={15} /> Delete</ConfirmButton>

      <PaymentDialog open={pay} onClose={() => setPay(false)} id={id} balanceMajor={balanceMajor} currency={currency} today={today} />
      <SendDialog open={send} onClose={() => setSend(false)} id={id} defaultTo={customerEmail} publicUrl={publicUrl} />
    </div>
  );
}

function PaymentDialog({ open, onClose, id, balanceMajor, currency, today }: { open: boolean; onClose: () => void; id: string; balanceMajor: string; currency: string; today: string }) {
  const [v, setV] = useState({ amount: balanceMajor, date: today, method: "BANK_TRANSFER", reference: "", notes: "" });
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();
  const toast = useToast();
  return (
    <Dialog open={open} onClose={onClose} title="Record a payment" description="Only record money you have actually received. The invoice status updates automatically.">
      <form className="space-y-4" onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await recordPaymentAction(id, v);
          if (r.error) { setError(r.error); return; }
          toast("Payment recorded"); onClose(); router.refresh();
        });
      }}>
        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={`Amount (${currency})`} hint={`Balance due: ${balanceMajor}`}><Input inputMode="decimal" required value={v.amount} onChange={(e) => setV({ ...v, amount: e.target.value })} /></Field>
          <Field label="Payment date"><Input type="date" required max={today} value={v.date} onChange={(e) => setV({ ...v, date: e.target.value })} /></Field>
          <Field label="Method"><Select value={v.method} onChange={(e) => setV({ ...v, method: e.target.value })}>{PAYMENT_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}</Select></Field>
          <Field label="Reference"><Input value={v.reference} placeholder="Transaction ID, check no." onChange={(e) => setV({ ...v, reference: e.target.value })} /></Field>
        </div>
        <Field label="Notes"><Textarea value={v.notes} onChange={(e) => setV({ ...v, notes: e.target.value })} /></Field>
        <div className="flex flex-wrap justify-between gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={() => setV({ ...v, amount: balanceMajor })}>Pay full balance</Button>
          <div className="flex gap-2"><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" loading={pending}>Record payment</Button></div>
        </div>
      </form>
    </Dialog>
  );
}

function SendDialog({ open, onClose, id, defaultTo, publicUrl }: { open: boolean; onClose: () => void; id: string; defaultTo: string; publicUrl: string }) {
  const [to, setTo] = useState(defaultTo);
  const [message, setMessage] = useState("Hi, please find your invoice below. Let us know if you have any questions.");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();
  const toast = useToast();
  return (
    <Dialog open={open} onClose={onClose} title="Email invoice" description="Your customer receives a secure link to view and download the PDF.">
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); start(async () => {
        const r = await sendInvoiceEmailAction(id, to, message);
        if (r.error) { setError(r.error); return; }
        toast("Invoice emailed"); onClose(); router.refresh();
      }); }}>
        {error && <p className="text-sm text-danger">{error}</p>}
        <Field label="To"><Input type="email" required value={to} onChange={(e) => setTo(e.target.value)} /></Field>
        <Field label="Message"><Textarea rows={4} value={message} onChange={(e) => setMessage(e.target.value)} /></Field>
        <p className="break-all rounded-lg bg-muted px-3 py-2 text-xs text-subtle">{publicUrl}</p>
        <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" loading={pending}><Send size={15} /> Send</Button></div>
      </form>
    </Dialog>
  );
}

export function DeletePaymentButton({ id }: { id: string }) {
  const router = useRouter();
  return (
    <ConfirmButton size="icon" title="Delete this payment?" description="The invoice balance and status will be recalculated." action={() => deletePaymentAction(id)} successMessage="Payment removed" onDone={() => router.refresh()}>
      <X size={14} />
    </ConfirmButton>
  );
}
