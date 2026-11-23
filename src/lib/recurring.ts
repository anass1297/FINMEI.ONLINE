import crypto from "crypto";
import { db } from "./db";
import { addDays, startOfDay } from "./dates";
import { advanceDate } from "./recurring-client";
export { advanceDate, describeFrequency } from "./recurring-client";
import { computeTotals } from "./calc";
import { reserveInvoiceNumber, snapshotCustomer, refreshOverdue } from "./invoices";

export type RecurringItem = { description: string; quantity: number; unitPrice: number; taxRate: number };

/**
 * Generates all invoices that are due (nextRunDate ≤ now). Idempotent per run date:
 * the schedule's nextRunDate is advanced in the same transaction as invoice creation.
 */
export async function runRecurringInvoices(opts: { businessId?: string; now?: Date } = {}) {
  const now = opts.now ?? new Date();
  const due = await db.recurringInvoice.findMany({
    where: { status: "ACTIVE", nextRunDate: { lte: now }, ...(opts.businessId ? { businessId: opts.businessId } : {}) },
    include: { business: true, customer: true },
  });

  const created: string[] = [];
  for (const r of due) {
    let next = r.nextRunDate;
    let count = r.generatedCount;
    let guard = 0;
    while (next <= now && guard++ < 24) {
      if (r.endDate && next > r.endDate) break;
      if (r.maxOccurrences && count >= r.maxOccurrences) break;
      const items = JSON.parse(r.itemsJson) as RecurringItem[];
      const totals = computeTotals(items, r.discountType, r.discountValue);
      const issueDate = startOfDay(next);
      issueDate.setHours(12);
      const runDate = next;
      const inv = await db.$transaction(async (tx) => {
        const number = await reserveInvoiceNumber(tx, r.businessId);
        const invoice = await tx.invoice.create({
          data: {
            businessId: r.businessId,
            customerId: r.customerId,
            recurringId: r.id,
            number,
            status: r.autoSend ? "SENT" : "DRAFT",
            sentAt: r.autoSend ? now : null,
            issueDate,
            dueDate: addDays(issueDate, r.paymentDays),
            paymentDays: r.paymentDays,
            currency: r.currency,
            discountType: r.discountType,
            discountValue: r.discountValue,
            subtotal: totals.subtotal,
            discountTotal: totals.discountTotal,
            taxTotal: totals.taxTotal,
            total: totals.total,
            taxLabel: r.business.taxLabel,
            notes: r.notes,
            terms: r.terms,
            paymentInstructions: r.business.paymentInstructions,
            template: r.business.invoiceTemplate,
            color: r.business.brandColor,
            font: r.business.invoiceFont,
            customerSnapshot: snapshotCustomer(r.customer),
            publicToken: crypto.randomBytes(18).toString("base64url"),
            items: { create: items.map((it, i) => ({ ...it, sortOrder: i })) },
          },
        });
        const nextRun = advanceDate(runDate, r.frequency, r.intervalCount, r.intervalUnit);
        const newCount = count + 1;
        const ended = (r.maxOccurrences && newCount >= r.maxOccurrences) || (r.endDate && nextRun > r.endDate);
        await tx.recurringInvoice.update({
          where: { id: r.id },
          data: { nextRunDate: nextRun, generatedCount: newCount, lastRunAt: now, status: ended ? "ENDED" : "ACTIVE" },
        });
        return { invoice, nextRun, ended };
      });
      created.push(inv.invoice.id);
      next = inv.nextRun;
      count++;
      if (inv.ended) break;
    }
  }
  await refreshOverdue(opts.businessId);
  return { generated: created.length, invoiceIds: created };
}
