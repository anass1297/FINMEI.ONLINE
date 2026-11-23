"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireBusiness } from "@/lib/session";
import { toCents } from "@/lib/money";
import { parseInputDate, startOfDay } from "@/lib/dates";
import { runRecurringInvoices } from "@/lib/recurring";
import { CURRENCY_CODES } from "@/lib/currencies";
import { emptyToNull } from "@/lib/utils";

const Schema = z.object({
  name: z.string().trim().min(1, "Give this schedule a name").max(120),
  customerId: z.string().min(1, "Choose a customer"),
  frequency: z.enum(["WEEKLY", "MONTHLY", "QUARTERLY", "YEARLY", "CUSTOM"]),
  intervalCount: z.coerce.number().int().min(1).max(365).default(1),
  intervalUnit: z.enum(["DAY", "WEEK", "MONTH", "YEAR"]).default("MONTH"),
  startDate: z.string().min(1),
  endMode: z.enum(["never", "date", "count"]),
  endDate: z.string().optional(),
  maxOccurrences: z.coerce.number().int().min(1).max(1000).optional(),
  paymentDays: z.coerce.number().int().min(0).max(365),
  currency: z.string().refine((c) => CURRENCY_CODES.includes(c)),
  discountType: z.enum(["percent", "fixed"]),
  discountValue: z.union([z.string(), z.number()]).default(0),
  autoSend: z.boolean(),
  notes: z.preprocess(emptyToNull, z.string().max(4000).nullable().optional()),
  terms: z.preprocess(emptyToNull, z.string().max(4000).nullable().optional()),
  items: z.array(z.object({
    description: z.string().trim().min(1, "Item description required").max(2000),
    quantity: z.preprocess((v) => Number(v), z.number().min(0)),
    unitPrice: z.union([z.string(), z.number()]),
    taxRate: z.preprocess((v) => Number(v) || 0, z.number().min(0).max(100)),
  })).min(1, "Add at least one item"),
});
export type RecurringInput = z.input<typeof Schema>;

export async function saveRecurringAction(input: RecurringInput, id?: string) {
  const { business } = await requireBusiness();
  const p = Schema.safeParse(input);
  if (!p.success) return { error: p.error.issues[0]?.message ?? "Invalid schedule" };
  const d = p.data;
  const customer = await db.customer.findFirst({ where: { id: d.customerId, businessId: business.id } });
  if (!customer) return { error: "Customer not found" };
  const startDate = parseInputDate(d.startDate);
  if (!startDate) return { error: "Invalid start date" };
  const endDate = d.endMode === "date" ? parseInputDate(d.endDate) : null;
  if (d.endMode === "date" && (!endDate || endDate < startDate)) return { error: "End date must be after the start date" };

  const data = {
    name: d.name, customerId: customer.id, frequency: d.frequency, intervalCount: d.intervalCount, intervalUnit: d.intervalUnit,
    startDate, endDate, maxOccurrences: d.endMode === "count" ? d.maxOccurrences ?? null : null,
    paymentDays: d.paymentDays, currency: d.currency, discountType: d.discountType,
    discountValue: d.discountType === "fixed" ? toCents(d.discountValue, d.currency) : Math.min(Math.max(Number(d.discountValue) || 0, 0), 100),
    autoSend: d.autoSend, notes: d.notes ?? null, terms: d.terms ?? null,
    itemsJson: JSON.stringify(d.items.map((i) => ({ description: i.description, quantity: i.quantity, unitPrice: toCents(i.unitPrice, d.currency), taxRate: i.taxRate }))),
  };

  let rid = id;
  if (id) {
    const existing = await db.recurringInvoice.findFirst({ where: { id, businessId: business.id } });
    if (!existing) return { error: "Schedule not found" };
    // If start date changed and nothing generated yet, reset the next run.
    const nextRunDate = existing.generatedCount === 0 ? startDate : existing.nextRunDate;
    await db.recurringInvoice.update({ where: { id }, data: { ...data, nextRunDate, status: existing.status === "ENDED" ? "ACTIVE" : existing.status } });
  } else {
    rid = (await db.recurringInvoice.create({ data: { ...data, businessId: business.id, nextRunDate: startDate, status: "ACTIVE" } })).id;
  }
  // Generate immediately if the first run is today or in the past.
  if (startOfDay(startDate) <= new Date()) await runRecurringInvoices({ businessId: business.id });
  revalidatePath("/recurring");
  revalidatePath("/invoices");
  return { ok: true, id: rid };
}

export async function setRecurringStatusAction(id: string, status: "ACTIVE" | "PAUSED") {
  const { business } = await requireBusiness();
  const r = await db.recurringInvoice.updateMany({ where: { id, businessId: business.id, status: { not: "ENDED" } }, data: { status } });
  if (!r.count) return { error: "Schedule not found" };
  revalidatePath("/recurring");
  return { ok: true };
}

export async function deleteRecurringAction(id: string) {
  const { business } = await requireBusiness();
  // Already generated invoices are kept.
  await db.recurringInvoice.deleteMany({ where: { id, businessId: business.id } });
  revalidatePath("/recurring");
  return { ok: true };
}

export async function runRecurringNowAction() {
  const { business } = await requireBusiness();
  const r = await runRecurringInvoices({ businessId: business.id });
  revalidatePath("/recurring");
  revalidatePath("/invoices");
  return { ok: true, generated: r.generated };
}
