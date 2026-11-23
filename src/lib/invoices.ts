import type { Prisma, PrismaClient } from "@prisma/client";
import { db } from "./db";
import { startOfDay } from "./dates";

type Tx = Prisma.TransactionClient | PrismaClient;

export const INVOICE_STATUSES = ["DRAFT", "SENT", "PARTIAL", "PAID", "OVERDUE", "CANCELLED"] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

/** Atomically reserves the next invoice number for a business. */
export async function reserveInvoiceNumber(tx: Tx, businessId: string) {
  const b = await tx.business.update({
    where: { id: businessId },
    data: { nextInvoiceNumber: { increment: 1 } },
    select: { invoicePrefix: true, nextInvoiceNumber: true, invoiceNumberPad: true },
  });
  const n = b.nextInvoiceNumber - 1;
  return `${b.invoicePrefix}${String(n).padStart(b.invoiceNumberPad, "0")}`;
}

export async function previewNextNumber(businessId: string) {
  const b = await db.business.findUniqueOrThrow({
    where: { id: businessId },
    select: { invoicePrefix: true, nextInvoiceNumber: true, invoiceNumberPad: true },
  });
  return `${b.invoicePrefix}${String(b.nextInvoiceNumber).padStart(b.invoiceNumberPad, "0")}`;
}

/**
 * Derives the status from payments and dates. DRAFT and CANCELLED are manual
 * states; everything else is computed. PAID requires recorded payments ≥ total.
 */
export function deriveStatus(inv: { status: string; total: number; amountPaid: number; dueDate: Date }): InvoiceStatus {
  if (inv.status === "CANCELLED" || inv.status === "DRAFT") return inv.status as InvoiceStatus;
  if (inv.total > 0 && inv.amountPaid >= inv.total) return "PAID";
  if (inv.amountPaid > 0 && inv.dueDate >= startOfDay(new Date())) return "PARTIAL";
  if (inv.dueDate < startOfDay(new Date())) return "OVERDUE";
  return inv.amountPaid > 0 ? "PARTIAL" : "SENT";
}

/** Recomputes amountPaid from completed payments and updates status. */
export async function syncInvoicePayments(tx: Tx, invoiceId: string) {
  const inv = await tx.invoice.findUniqueOrThrow({ where: { id: invoiceId } });
  const agg = await tx.payment.aggregate({
    where: { invoiceId, status: "COMPLETED" },
    _sum: { amount: true },
    _max: { date: true },
  });
  const amountPaid = agg._sum.amount ?? 0;
  // A draft that receives a payment is considered issued.
  const base = inv.status === "DRAFT" && amountPaid > 0 ? "SENT" : inv.status;
  const status = deriveStatus({ status: base, total: inv.total, amountPaid, dueDate: inv.dueDate });
  return tx.invoice.update({
    where: { id: invoiceId },
    data: { amountPaid, status, paidAt: status === "PAID" ? agg._max.date ?? new Date() : null },
  });
}

/** Flags past-due invoices as OVERDUE. Cheap; called on dashboard/list loads and by cron. */
export async function refreshOverdue(businessId?: string) {
  const today = startOfDay(new Date());
  await db.invoice.updateMany({
    where: { ...(businessId ? { businessId } : {}), status: { in: ["SENT", "PARTIAL"] }, dueDate: { lt: today } },
    data: { status: "OVERDUE" },
  });
}

export function balanceDue(inv: { total: number; amountPaid: number; status: string }) {
  if (inv.status === "CANCELLED") return 0;
  return Math.max(inv.total - inv.amountPaid, 0);
}

export type CustomerSnapshot = {
  name: string; company?: string | null; email?: string | null; phone?: string | null;
  addressLine1?: string | null; addressLine2?: string | null; city?: string | null; state?: string | null;
  postalCode?: string | null; country?: string | null; taxId?: string | null;
};

export function snapshotCustomer(c: CustomerSnapshot | null | undefined) {
  if (!c) return null;
  const { name, company, email, phone, addressLine1, addressLine2, city, state, postalCode, country, taxId } = c;
  return JSON.stringify({ name, company, email, phone, addressLine1, addressLine2, city, state, postalCode, country, taxId });
}

export function parseSnapshot(s: string | null | undefined): CustomerSnapshot | null {
  if (!s) return null;
  try { return JSON.parse(s); } catch { return null; }
}
