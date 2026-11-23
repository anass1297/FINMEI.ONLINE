import type { Business, Invoice, InvoiceItem } from "@prisma/client";
import { lineAmount } from "./calc";
import { parseSnapshot } from "./invoices";
import type { DocBusiness, DocInvoice } from "@/components/app/invoice-document";

export function toDocBusiness(b: Business): DocBusiness {
  const { name, logo, email, phone, website, taxId, addressLine1, addressLine2, city, state, postalCode, country, bankName, bankAccountName, bankAccountNumber, iban, swift } = b;
  return { name, logo, email, phone, website, taxId, addressLine1, addressLine2, city, state, postalCode, country, bankName, bankAccountName, bankAccountNumber, iban, swift };
}

export function toDocInvoice(inv: Invoice & { items: InvoiceItem[] }): DocInvoice {
  return {
    number: inv.number, status: inv.status, issueDate: inv.issueDate, dueDate: inv.dueDate, currency: inv.currency,
    items: [...inv.items].sort((a, b) => a.sortOrder - b.sortOrder).map((i) => ({ description: i.description, quantity: i.quantity, unitPrice: i.unitPrice, taxRate: i.taxRate, amount: lineAmount(i) })),
    subtotal: inv.subtotal, discountTotal: inv.discountTotal, discountType: inv.discountType, discountValue: inv.discountValue,
    taxTotal: inv.taxTotal, total: inv.total, amountPaid: inv.amountPaid, taxLabel: inv.taxLabel,
    notes: inv.notes, terms: inv.terms, paymentInstructions: inv.paymentInstructions,
    template: inv.template, color: inv.color, font: inv.font, customer: parseSnapshot(inv.customerSnapshot),
  };
}
