import type { RecurringInvoice } from "@prisma/client";
import { toInputDate } from "./dates";
import { fromCents } from "./money";
import type { RecurringValues } from "@/components/app/recurring-form";
import type { RecurringItem } from "./recurring";

export function recurringToValues(r: RecurringInvoice): RecurringValues {
  const items = JSON.parse(r.itemsJson) as RecurringItem[];
  return {
    name: r.name, customerId: r.customerId ?? "", frequency: r.frequency as RecurringValues["frequency"], intervalCount: String(r.intervalCount),
    intervalUnit: r.intervalUnit as RecurringValues["intervalUnit"], startDate: toInputDate(r.startDate),
    endMode: r.maxOccurrences ? "count" : r.endDate ? "date" : "never", endDate: toInputDate(r.endDate), maxOccurrences: r.maxOccurrences ? String(r.maxOccurrences) : "12",
    paymentDays: String(r.paymentDays), currency: r.currency, discountType: r.discountType as "percent" | "fixed",
    discountValue: r.discountValue ? String(r.discountType === "fixed" ? fromCents(r.discountValue, r.currency) : r.discountValue) : "",
    autoSend: r.autoSend, notes: r.notes ?? "", terms: r.terms ?? "",
    items: items.map((i) => ({ description: i.description, quantity: String(i.quantity), unitPrice: String(fromCents(i.unitPrice, r.currency)), taxRate: i.taxRate ? String(i.taxRate) : "" })),
  };
}
