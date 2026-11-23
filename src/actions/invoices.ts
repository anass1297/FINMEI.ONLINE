"use server";
import crypto from "crypto";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireBusiness } from "@/lib/session";
import { computeTotals } from "@/lib/calc";
import { toCents } from "@/lib/money";
import { parseInputDate, addDays, formatDate } from "@/lib/dates";
import { deriveStatus, reserveInvoiceNumber, snapshotCustomer, syncInvoicePayments } from "@/lib/invoices";
import { appUrl, sendInvoiceEmail } from "@/lib/email";
import { formatMoney } from "@/lib/money";
import { CURRENCY_CODES } from "@/lib/currencies";
import { emptyToNull } from "@/lib/utils";

const opt = (max = 4000) => z.preprocess(emptyToNull, z.string().max(max).nullable().optional());

const ItemSchema = z.object({
  description: z.string().trim().min(1, "Description required").max(2000),
  quantity: z.preprocess((v) => Number(v), z.number().min(0).max(1_000_000)),
  unitPrice: z.union([z.string(), z.number()]), // major units
  taxRate: z.preprocess((v) => Number(v) || 0, z.number().min(0).max(100)),
});

const InvoiceSchema = z.object({
  customerId: z.preprocess(emptyToNull, z.string().nullable().optional()),
  number: z.preprocess(emptyToNull, z.string().trim().max(40).nullable().optional()),
  issueDate: z.string().min(1, "Issue date required"),
  dueDate: z.string().min(1, "Due date required"),
  paymentDays: z.coerce.number().int().min(0).max(365),
  currency: z.string().refine((c) => CURRENCY_CODES.includes(c), "Unsupported currency"),
  discountType: z.enum(["percent", "fixed"]),
  discountValue: z.union([z.string(), z.number()]).default(0),
  taxLabel: z.string().trim().max(20).default("Tax"),
  notes: opt(), terms: opt(), paymentInstructions: opt(),
  template: z.enum(["modern", "classic", "minimal"]),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  font: z.enum(["sans", "serif", "mono"]),
  items: z.array(ItemSchema).min(1, "Add at least one line item").max(200),
});
export type InvoiceInput = z.input<typeof InvoiceSchema>;

function newPublicToken() {
  return crypto.randomBytes(18).toString("base64url");
}

function revalidateInvoices(id?: string) {
  revalidatePath("/invoices");
  revalidatePath("/dashboard");
  revalidatePath("/payments");
  revalidatePath("/reports");
  if (id) revalidatePath(`/invoices/${id}`);
}

export async function saveInvoiceAction(input: InvoiceInput, opts: { id?: string; intent: "draft" | "send" | "save" }) {
  const { business } = await requireBusiness();
  const p = InvoiceSchema.safeParse(input);
  if (!p.success) {
    return { error: p.error.issues[0]?.message ?? "Invalid invoice", fieldErrors: Object.fromEntries(p.error.issues.map((i) => [i.path.join("."), i.message])) };
  }
  const d = p.data;
  const issueDate = parseInputDate(d.issueDate);
  const dueDate = parseInputDate(d.dueDate);
  if (!issueDate || !dueDate) return { error: "Invalid dates" };
  if (dueDate < issueDate) return { error: "Due date can't be before the issue date" };

  let customer = null;
  if (d.customerId) {
    customer = await db.customer.findFirst({ where: { id: d.customerId, businessId: business.id } });
    if (!customer) return { error: "Customer not found" };
  }
  if (opts.intent === "send" && !customer) return { error: "Choose a customer before sending" };

  const items = d.items.map((it, i) => ({
    description: it.description, quantity: it.quantity, unitPrice: toCents(it.unitPrice, d.currency), taxRate: it.taxRate, sortOrder: i,
  }));
  const discountValue = d.discountType === "fixed" ? toCents(d.discountValue, d.currency) : Math.min(Math.max(Number(d.discountValue) || 0, 0), 100);
  const totals = computeTotals(items, d.discountType, discountValue);

  const data = {
    customerId: customer?.id ?? null,
    issueDate, dueDate, paymentDays: d.paymentDays, currency: d.currency,
    discountType: d.discountType, discountValue,
    subtotal: totals.subtotal, discountTotal: totals.discountTotal, taxTotal: totals.taxTotal, total: totals.total,
    taxLabel: d.taxLabel || "Tax", notes: d.notes ?? null, terms: d.terms ?? null, paymentInstructions: d.paymentInstructions ?? null,
    template: d.template, color: d.color, font: d.font,
    customerSnapshot: snapshotCustomer(customer),
  };

  try {
    if (opts.id) {
      const existing = await db.invoice.findFirst({ where: { id: opts.id, businessId: business.id } });
      if (!existing) return { error: "Invoice not found" };
      if (existing.status === "CANCELLED") return { error: "Cancelled invoices can't be edited. Restore it first." };
      if (totals.total < existing.amountPaid) return { error: "Total can't be lower than the amount already paid. Remove payments first." };
      const number = d.number && d.number !== existing.number ? d.number : existing.number;
      const updated = await db.$transaction(async (tx) => {
        await tx.invoiceItem.deleteMany({ where: { invoiceId: existing.id } });
        const base = opts.intent === "send" && existing.status === "DRAFT" ? "SENT" : existing.status;
        await tx.invoice.update({
          where: { id: existing.id },
          data: {
            ...data, number,
            status: deriveStatus({ status: base, total: totals.total, amountPaid: existing.amountPaid, dueDate }),
            sentAt: base !== "DRAFT" ? existing.sentAt ?? new Date() : null,
            items: { create: items },
          },
        });
        return syncInvoicePayments(tx, existing.id);
      });
      revalidateInvoices(updated.id);
      return { ok: true, id: updated.id };
    }

    const created = await db.$transaction(async (tx) => {
      const number = d.number || (await reserveInvoiceNumber(tx, business.id));
      const status = opts.intent === "send" ? deriveStatus({ status: "SENT", total: totals.total, amountPaid: 0, dueDate }) : "DRAFT";
      return tx.invoice.create({
        data: {
          ...data, businessId: business.id, number, status,
          sentAt: status !== "DRAFT" ? new Date() : null,
          publicToken: newPublicToken(),
          items: { create: items },
        },
      });
    });
    revalidateInvoices(created.id);
    return { ok: true, id: created.id };
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") return { error: "That invoice number is already used. Choose another." };
    throw e;
  }
}

async function owned(id: string) {
  const { business } = await requireBusiness();
  const inv = await db.invoice.findFirst({ where: { id, businessId: business.id }, include: { items: true, customer: true } });
  return { business, inv };
}

export async function deleteInvoiceAction(id: string) {
  const { business, inv } = await owned(id);
  if (!inv) return { error: "Invoice not found" };
  await db.invoice.delete({ where: { id: inv.id, businessId: business.id } });
  revalidateInvoices();
  return { ok: true };
}

export async function duplicateInvoiceAction(id: string) {
  const { business, inv } = await owned(id);
  if (!inv) return { error: "Invoice not found" };
  const issue = new Date();
  issue.setHours(12, 0, 0, 0);
  const copy = await db.$transaction(async (tx) => {
    const number = await reserveInvoiceNumber(tx, business.id);
    return tx.invoice.create({
      data: {
        businessId: business.id, customerId: inv.customerId, number, status: "DRAFT",
        issueDate: issue, dueDate: addDays(issue, inv.paymentDays), paymentDays: inv.paymentDays, currency: inv.currency,
        discountType: inv.discountType, discountValue: inv.discountValue,
        subtotal: inv.subtotal, discountTotal: inv.discountTotal, taxTotal: inv.taxTotal, total: inv.total,
        taxLabel: inv.taxLabel, notes: inv.notes, terms: inv.terms, paymentInstructions: inv.paymentInstructions,
        template: inv.template, color: inv.color, font: inv.font,
        customerSnapshot: inv.customer ? snapshotCustomer(inv.customer) : inv.customerSnapshot,
        publicToken: newPublicToken(),
        items: { create: inv.items.map(({ description, quantity, unitPrice, taxRate, sortOrder }) => ({ description, quantity, unitPrice, taxRate, sortOrder })) },
      },
    });
  });
  revalidateInvoices();
  return { ok: true, id: copy.id };
}

export async function markSentAction(id: string) {
  const { inv } = await owned(id);
  if (!inv) return { error: "Invoice not found" };
  if (inv.status !== "DRAFT") return { ok: true };
  await db.invoice.update({
    where: { id: inv.id },
    data: { status: deriveStatus({ status: "SENT", total: inv.total, amountPaid: inv.amountPaid, dueDate: inv.dueDate }), sentAt: new Date() },
  });
  revalidateInvoices(id);
  return { ok: true };
}

export async function setInvoiceStatusAction(id: string, status: "DRAFT" | "SENT" | "PAID") {
  const { business, inv } = await owned(id);
  if (!inv) return { error: "Invoice not found" };
  if (inv.status === "CANCELLED") return { error: "Cancelled invoices can't change status. Restore it first." };
  if (status === "DRAFT" && inv.amountPaid > 0) {
    return { error: "This invoice has payments. Remove them before changing it to Draft." };
  }

  await db.$transaction(async (tx) => {
    if (status === "PAID") {
      const balance = inv.total - inv.amountPaid;
      if (balance > 0) {
        await tx.payment.create({
          data: {
            businessId: business.id,
            invoiceId: inv.id,
            amount: balance,
            currency: inv.currency,
            date: new Date(),
            method: "OTHER",
            reference: null,
            notes: "Marked as paid",
            provider: "manual",
            status: "COMPLETED",
          },
        });
      }
      await tx.invoice.update({ where: { id: inv.id }, data: { status: "PAID", paidAt: new Date() } });
      await syncInvoicePayments(tx, inv.id);
      return;
    }

    if (status === "DRAFT") {
      if (inv.amountPaid > 0) return { error: "This invoice has payments. Remove them before changing it to Draft." };
      await tx.invoice.update({ where: { id: inv.id }, data: { status: "DRAFT", sentAt: null, paidAt: null } });
      return;
    }

    await tx.invoice.update({
      where: { id: inv.id },
      data: { status: deriveStatus({ status: "SENT", total: inv.total, amountPaid: inv.amountPaid, dueDate: inv.dueDate }), sentAt: inv.sentAt ?? new Date(), paidAt: null },
    });
  });

  revalidateInvoices(id);
  return { ok: true };
}

export async function sendInvoiceEmailAction(id: string, to: string, message: string) {
  const { business, inv } = await owned(id);
  if (!inv) return { error: "Invoice not found" };
  if (!z.string().email().safeParse(to).success) return { error: "Enter a valid recipient email" };
  if (inv.status === "CANCELLED") return { error: "Cancelled invoices can't be sent" };
  await sendInvoiceEmail({
    to, businessName: business.name, number: inv.number, total: formatMoney(inv.total - inv.amountPaid, inv.currency),
    dueDate: formatDate(inv.dueDate, "long"), url: appUrl(`/i/${inv.publicToken}`), message: message.slice(0, 2000),
  });
  if (inv.status === "DRAFT") await markSentAction(id);
  else await db.invoice.update({ where: { id }, data: { sentAt: new Date() } });
  revalidateInvoices(id);
  return { ok: true };
}

export async function cancelInvoiceAction(id: string) {
  const { inv } = await owned(id);
  if (!inv) return { error: "Invoice not found" };
  if (inv.amountPaid > 0) return { error: "This invoice has payments. Remove them before cancelling." };
  await db.invoice.update({ where: { id }, data: { status: "CANCELLED" } });
  revalidateInvoices(id);
  return { ok: true };
}

export async function restoreInvoiceAction(id: string) {
  const { inv } = await owned(id);
  if (!inv) return { error: "Invoice not found" };
  await db.invoice.update({ where: { id }, data: { status: inv.sentAt ? deriveStatus({ status: "SENT", total: inv.total, amountPaid: inv.amountPaid, dueDate: inv.dueDate }) : "DRAFT" } });
  revalidateInvoices(id);
  return { ok: true };
}

export async function regenerateLinkAction(id: string) {
  const { inv } = await owned(id);
  if (!inv) return { error: "Invoice not found" };
  const updated = await db.invoice.update({ where: { id }, data: { publicToken: newPublicToken() } });
  revalidateInvoices(id);
  return { ok: true, token: updated.publicToken };
}

// ── Payments ───────────────────────────────────────────
const PaymentSchema = z.object({
  amount: z.union([z.string(), z.number()]),
  date: z.string().min(1),
  method: z.string().min(1).max(40),
  reference: opt(120),
  notes: opt(1000),
});

export async function recordPaymentAction(invoiceId: string, input: z.input<typeof PaymentSchema>) {
  const { business, inv } = await owned(invoiceId);
  if (!inv) return { error: "Invoice not found" };
  if (inv.status === "CANCELLED") return { error: "Can't record payments on a cancelled invoice" };
  const p = PaymentSchema.safeParse(input);
  if (!p.success) return { error: p.error.issues[0]?.message ?? "Invalid payment" };
  const amount = toCents(p.data.amount, inv.currency);
  const balance = inv.total - inv.amountPaid;
  if (amount <= 0) return { error: "Amount must be greater than zero" };
  if (amount > balance) return { error: `Amount exceeds the balance due (${formatMoney(balance, inv.currency)})` };
  const date = parseInputDate(p.data.date);
  if (!date) return { error: "Invalid date" };
  if (date > addDays(new Date(), 1)) return { error: "Payment date can't be in the future" };

  await db.$transaction(async (tx) => {
    await tx.payment.create({
      data: {
        businessId: business.id, invoiceId: inv.id, amount, currency: inv.currency, date,
        method: p.data.method, reference: p.data.reference ?? null, notes: p.data.notes ?? null,
        provider: "manual", status: "COMPLETED",
      },
    });
    await syncInvoicePayments(tx, inv.id);
  });
  revalidateInvoices(inv.id);
  revalidatePath("/payments");
  return { ok: true };
}

export async function deletePaymentAction(paymentId: string) {
  const { business } = await requireBusiness();
  const pay = await db.payment.findFirst({ where: { id: paymentId, businessId: business.id } });
  if (!pay) return { error: "Payment not found" };
  await db.$transaction(async (tx) => {
    await tx.payment.delete({ where: { id: pay.id } });
    await syncInvoicePayments(tx, pay.invoiceId);
  });
  revalidateInvoices(pay.invoiceId);
  revalidatePath("/payments");
  return { ok: true };
}
