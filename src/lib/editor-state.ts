import type { Business, Invoice, InvoiceItem } from "@prisma/client";
import { addDays, toInputDate } from "./dates";
import { fromCents } from "./money";
import type { EditorState } from "@/components/app/invoice-editor";

export function defaultEditorState(b: Business, customerId = "", currency?: string): EditorState {
  const issue = new Date();
  return {
    customerId, number: "", issueDate: toInputDate(issue), dueDate: toInputDate(addDays(issue, b.defaultPaymentDays)),
    paymentDays: b.defaultPaymentDays, currency: currency || b.currency, discountType: "percent", discountValue: "",
    taxLabel: b.taxLabel, notes: b.defaultNotes ?? "", terms: b.defaultTerms ?? "", paymentInstructions: b.paymentInstructions ?? "",
    template: b.invoiceTemplate as EditorState["template"], color: b.brandColor, font: b.invoiceFont as EditorState["font"],
    items: [{ description: "", quantity: "1", unitPrice: "", taxRate: b.defaultTaxRate ? String(b.defaultTaxRate) : "" }],
  };
}

export function invoiceToEditorState(inv: Invoice & { items: InvoiceItem[] }): EditorState {
  return {
    customerId: inv.customerId ?? "", number: inv.number, issueDate: toInputDate(inv.issueDate), dueDate: toInputDate(inv.dueDate),
    paymentDays: inv.paymentDays, currency: inv.currency, discountType: inv.discountType as EditorState["discountType"],
    discountValue: inv.discountValue ? String(inv.discountType === "fixed" ? fromCents(inv.discountValue, inv.currency) : inv.discountValue) : "",
    taxLabel: inv.taxLabel, notes: inv.notes ?? "", terms: inv.terms ?? "", paymentInstructions: inv.paymentInstructions ?? "",
    template: inv.template as EditorState["template"], color: inv.color, font: inv.font as EditorState["font"],
    items: [...inv.items].sort((a, b) => a.sortOrder - b.sortOrder).map((i) => ({
      description: i.description, quantity: String(i.quantity), unitPrice: String(fromCents(i.unitPrice, inv.currency)), taxRate: i.taxRate ? String(i.taxRate) : "",
    })),
  };
}
