/**
 * Demo data: `npm run db:seed`
 * Login: demo@kontora.app / Demo1234
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { computeTotals } from "../src/lib/calc";
import { DEFAULT_EXPENSE_CATEGORIES } from "../src/lib/business";

const db = new PrismaClient();
const token = () => crypto.randomBytes(18).toString("base64url");
const day = (offset: number) => { const d = new Date(); d.setDate(d.getDate() + offset); d.setHours(12, 0, 0, 0); return d; };

async function main() {
  await db.user.deleteMany({ where: { email: "demo@kontora.app" } });
  const user = await db.user.create({ data: { email: "demo@kontora.app", name: "Alex Morgan", passwordHash: await bcrypt.hash("Demo1234", 12), emailVerified: new Date() } });

  const biz = await db.business.create({
    data: {
      name: "Northwind Studio", email: "billing@northwind.studio", phone: "+1 415 555 0134", website: "northwind.studio", taxId: "US-84-1234567",
      addressLine1: "500 Market Street, Suite 12", city: "San Francisco", state: "CA", postalCode: "94105", country: "United States",
      currency: "USD", invoicePrefix: "NW-", defaultTaxRate: 8.5, taxLabel: "Sales tax", defaultNotes: "Thank you for your business!",
      defaultTerms: "Payment due within 30 days. Late payments may incur a 1.5% monthly fee.",
      bankName: "First Republic", bankAccountName: "Northwind Studio LLC", bankAccountNumber: "000123456789", swift: "FRBBUS6S",
      paymentInstructions: "Please include the invoice number as your payment reference.", brandColor: "#4f46e5",
      memberships: { create: { userId: user.id, role: "OWNER" } },
      expenseCategories: { create: DEFAULT_EXPENSE_CATEGORIES.map(([name, color]) => ({ name, color })) },
    },
  });
  const second = await db.business.create({
    data: { name: "Morgan Consulting", currency: "EUR", invoicePrefix: "MC-", brandColor: "#0ea5e9", taxLabel: "VAT", defaultTaxRate: 20, country: "France", city: "Paris",
      memberships: { create: { userId: user.id, role: "OWNER" } }, expenseCategories: { create: DEFAULT_EXPENSE_CATEGORIES.map(([name, color]) => ({ name, color })) } },
  });
  await db.user.update({ where: { id: user.id }, data: { activeBusinessId: biz.id } });

  const customers = await Promise.all([
    { name: "Jordan Lee", company: "Acme Robotics", email: "ap@acme-robotics.com", city: "Austin", state: "TX", country: "United States", addressLine1: "88 Congress Ave" },
    { name: "Priya Shah", company: "Lumen Health", email: "finance@lumenhealth.io", city: "Boston", state: "MA", country: "United States", taxId: "US-22-9988776" },
    { name: "Sam Okafor", company: "Bright Coffee Co.", email: "sam@brightcoffee.co", city: "Portland", state: "OR", country: "United States" },
    { name: "Elena García", company: "Vela Travel", email: "elena@velatravel.es", city: "Madrid", country: "Spain", currency: "EUR" },
    { name: "Chris Park", email: "chris.park@gmail.com", city: "Seattle", state: "WA", country: "United States" },
  ].map((c) => db.customer.create({ data: { ...c, businessId: biz.id } })));

  const catalog = [
    ["Brand identity design", 4200_00], ["Website design & build", 8500_00], ["Monthly retainer — design support", 2400_00],
    ["UX audit", 1800_00], ["Landing page", 1600_00], ["Illustration set (10)", 950_00], ["Hourly consulting", 150_00],
  ] as const;

  let n = 1;
  for (let m = 11; m >= 0; m--) {
    const count = 2 + (m % 3);
    for (let k = 0; k < count; k++) {
      const cust = customers[(m + k) % customers.length]!;
      const [desc, price] = catalog[(m * 3 + k) % catalog.length]!;
      const qty = desc === "Hourly consulting" ? 8 + ((m + k) % 12) : 1;
      const items: { description: string; quantity: number; unitPrice: number; taxRate: number; sortOrder: number }[] = [{ description: desc, quantity: qty, unitPrice: price, taxRate: 8.5, sortOrder: 0 }];
      if (k % 2 === 0) items.push({ description: "Project management", quantity: 4, unitPrice: 95_00, taxRate: 8.5, sortOrder: 1 });
      const t = computeTotals(items, "percent", k === 1 ? 5 : 0);
      const issue = day(-m * 30 - k * 6 - 2);
      const due = new Date(issue); due.setDate(due.getDate() + 30);
      const currency = cust.currency || "USD";
      let status = "PAID", paid = t.total;
      if (m === 0 && k === 0) { status = "DRAFT"; paid = 0; }
      else if (m <= 1) { status = due < new Date() ? "OVERDUE" : "SENT"; paid = 0; if (k === 1) { paid = Math.round(t.total / 2); status = due < new Date() ? "OVERDUE" : "PARTIAL"; } }
      else if (m === 2 && k === 0) { status = "OVERDUE"; paid = 0; }
      const inv = await db.invoice.create({
        data: {
          businessId: biz.id, customerId: cust.id, number: `NW-${String(n++).padStart(4, "0")}`, status, issueDate: issue, dueDate: due, paymentDays: 30, currency,
          discountType: "percent", discountValue: k === 1 ? 5 : 0, subtotal: t.subtotal, discountTotal: t.discountTotal, taxTotal: t.taxTotal, total: t.total, amountPaid: paid,
          taxLabel: "Sales tax", notes: "Thank you for your business!", paymentInstructions: biz.paymentInstructions,
          customerSnapshot: JSON.stringify(cust), publicToken: token(), sentAt: status === "DRAFT" ? null : issue, paidAt: status === "PAID" ? due : null,
          items: { create: items },
        },
      });
      if (paid > 0) {
        const pd = new Date(issue); pd.setDate(pd.getDate() + 12 + k * 3);
        await db.payment.create({ data: { businessId: biz.id, invoiceId: inv.id, amount: paid, currency, date: pd > new Date() ? new Date() : pd, method: k % 2 ? "CARD" : "BANK_TRANSFER", reference: `TX-${10000 + n}` } });
      }
    }
  }
  await db.business.update({ where: { id: biz.id }, data: { nextInvoiceNumber: n } });

  const cats = await db.expenseCategory.findMany({ where: { businessId: biz.id } });
  const cat = (name: string) => cats.find((c) => c.name === name)!.id;
  const expenses: [string, string, string, number][] = [
    ["Figma Professional", "Figma", "Software & Subscriptions", 45_00], ["Adobe Creative Cloud", "Adobe", "Software & Subscriptions", 89_99],
    ["Coworking membership", "WeWork", "Rent & Utilities", 450_00], ["Client lunch", "Tartine", "Meals & Entertainment", 86_40],
    ["Freelance illustrator", "Mia Chen", "Contractors", 1200_00], ["LinkedIn ads", "LinkedIn", "Marketing & Advertising", 300_00],
    ["Flight to Austin", "United", "Travel", 412_00], ["Accountant fees", "Pine & Co CPA", "Professional Fees", 350_00],
  ];
  for (let m = 11; m >= 0; m--) {
    for (let k = 0; k < expenses.length; k++) {
      if ((m + k) % 3 === 0 && k > 2) continue;
      const [description, vendor, c, amount] = expenses[k]!;
      const amt = Math.round(amount * (1 + ((m * 7 + k) % 5) / 20));
      await db.expense.create({ data: { businessId: biz.id, description, vendor, categoryId: cat(c), date: day(-m * 30 - k * 3), amount: amt, currency: "USD", taxRate: 8.5, taxAmount: Math.round(amt - amt / 1.085) } });
    }
  }

  await db.recurringInvoice.create({
    data: {
      businessId: biz.id, customerId: customers[1]!.id, name: "Lumen Health — monthly retainer", frequency: "MONTHLY", startDate: day(-60), nextRunDate: day(10),
      generatedCount: 2, currency: "USD", paymentDays: 15, autoSend: true,
      itemsJson: JSON.stringify([{ description: "Monthly retainer — design support", quantity: 1, unitPrice: 2400_00, taxRate: 8.5 }]),
      notes: "Thank you for your continued partnership.",
    },
  });
  await db.customer.create({ data: { businessId: second.id, name: "Claire Dubois", company: "Atelier Lumière", email: "claire@atelier-lumiere.fr", country: "France", currency: "EUR" } });

  console.log("Seeded. Login: demo@kontora.app / Demo1234");
}
main().finally(() => db.$disconnect());
