"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireBusiness } from "@/lib/session";
import { toCents } from "@/lib/money";
import { parseInputDate } from "@/lib/dates";
import { ALLOWED_MIME, MAX_UPLOAD_BYTES, deleteFile, putFile } from "@/lib/storage";
import { CURRENCY_CODES } from "@/lib/currencies";
import { emptyToNull } from "@/lib/utils";
import { type ActionState, zodErrors } from "./types";

const ExpenseSchema = z.object({
  description: z.string().trim().min(1, "Description is required").max(300),
  vendor: z.preprocess(emptyToNull, z.string().max(120).nullable()),
  categoryId: z.preprocess(emptyToNull, z.string().nullable()),
  date: z.string().min(1, "Date is required"),
  amount: z.string().min(1, "Amount is required"),
  currency: z.string().refine((c) => CURRENCY_CODES.includes(c), "Unsupported currency"),
  taxRate: z.coerce.number().min(0).max(100).default(0),
  taxAmount: z.string().optional(),
  notes: z.preprocess(emptyToNull, z.string().max(4000).nullable()),
});

export async function saveExpenseAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const { business } = await requireBusiness();
  const id = String(fd.get("id") || "") || null;
  const raw = Object.fromEntries([...fd.entries()].filter(([, v]) => typeof v === "string"));
  const p = ExpenseSchema.safeParse(raw);
  if (!p.success) return zodErrors(p.error);
  const d = p.data;
  const date = parseInputDate(d.date);
  if (!date) return { error: "Invalid date", fieldErrors: { date: "Invalid date" } };
  const amount = toCents(d.amount, d.currency);
  if (amount <= 0) return { error: "Amount must be greater than zero", fieldErrors: { amount: "Must be greater than zero" } };
  // Amount is tax-inclusive. Derive tax if not given explicitly.
  let taxAmount = d.taxAmount ? toCents(d.taxAmount, d.currency) : Math.round(amount - amount / (1 + d.taxRate / 100));
  taxAmount = Math.min(Math.max(taxAmount, 0), amount);

  if (d.categoryId) {
    const cat = await db.expenseCategory.findFirst({ where: { id: d.categoryId, businessId: business.id } });
    if (!cat) return { error: "Invalid category" };
  }

  const files = fd.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  for (const f of files) {
    if (f.size > MAX_UPLOAD_BYTES) return { error: `${f.name} is larger than 10MB` };
    if (!ALLOWED_MIME.has(f.type)) return { error: `${f.name}: unsupported file type` };
  }
  if (files.length > 10) return { error: "Up to 10 files at a time" };

  const data = {
    description: d.description, vendor: d.vendor, categoryId: d.categoryId, date, amount, currency: d.currency,
    taxRate: d.taxRate, taxAmount, notes: d.notes,
  };

  let expenseId = id;
  if (id) {
    const r = await db.expense.updateMany({ where: { id, businessId: business.id }, data });
    if (!r.count) return { error: "Expense not found" };
  } else {
    expenseId = (await db.expense.create({ data: { ...data, businessId: business.id } })).id;
  }

  for (const f of files) {
    const key = await putFile(business.id, f.name, Buffer.from(await f.arrayBuffer()));
    await db.attachment.create({ data: { businessId: business.id, expenseId, filename: f.name.slice(0, 200), mimeType: f.type, size: f.size, storageKey: key } });
  }

  revalidatePath("/expenses");
  revalidatePath("/dashboard");
  redirect("/expenses");
}

export async function deleteExpenseAction(id: string) {
  const { business } = await requireBusiness();
  const e = await db.expense.findFirst({ where: { id, businessId: business.id }, include: { attachments: true } });
  if (!e) return { error: "Expense not found" };
  await db.expense.delete({ where: { id: e.id } });
  await Promise.all(e.attachments.map((a) => deleteFile(a.storageKey)));
  revalidatePath("/expenses");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function deleteAttachmentAction(id: string) {
  const { business } = await requireBusiness();
  const a = await db.attachment.findFirst({ where: { id, businessId: business.id } });
  if (!a) return { error: "File not found" };
  await db.attachment.delete({ where: { id: a.id } });
  await deleteFile(a.storageKey);
  revalidatePath(`/expenses/${a.expenseId}/edit`);
  return { ok: true };
}
