"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireBusiness, requireUser } from "@/lib/session";
import { createBusinessForUser } from "@/lib/business";
import { CURRENCY_CODES } from "@/lib/currencies";
import { emptyToNull } from "@/lib/utils";
import { type ActionState, zodErrors } from "./types";

const opt = z.preprocess(emptyToNull, z.string().max(500).nullable());

export async function createBusinessAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = z.object({
    name: z.string().trim().min(2, "Enter a business name").max(120),
    currency: z.string().refine((c) => CURRENCY_CODES.includes(c), "Pick a currency"),
    email: z.preprocess(emptyToNull, z.string().email().nullable()),
  }).safeParse(Object.fromEntries(fd));
  if (!parsed.success) return zodErrors(parsed.error);
  const count = await db.membership.count({ where: { userId: user.id } });
  if (count >= 25) return { error: "Business limit reached." };
  await createBusinessForUser(user.id, parsed.data);
  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function switchBusinessAction(businessId: string) {
  const user = await requireUser();
  const m = await db.membership.findUnique({ where: { userId_businessId: { userId: user.id, businessId } } });
  if (!m) return { error: "Not allowed" };
  await db.user.update({ where: { id: user.id }, data: { activeBusinessId: businessId } });
  revalidatePath("/", "layout");
  return { ok: true };
}

const MAX_LOGO = 512 * 1024;

export async function updateBusinessAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const { business, role } = await requireBusiness();
  if (role === "MEMBER") return { error: "Only owners and admins can edit business settings." };
  const section = String(fd.get("_section") || "profile");

  const schemas = {
    profile: z.object({
      name: z.string().trim().min(2).max(120),
      email: z.preprocess(emptyToNull, z.string().email("Invalid email").nullable()),
      phone: opt, website: opt, taxId: opt,
      addressLine1: opt, addressLine2: opt, city: opt, state: opt, postalCode: opt, country: opt,
      currency: z.string().refine((c) => CURRENCY_CODES.includes(c), "Unsupported currency"),
    }),
    invoicing: z.object({
      invoicePrefix: z.string().max(12).regex(/^[A-Za-z0-9\-_/#.]*$/, "Letters, numbers and - _ / # . only"),
      nextInvoiceNumber: z.coerce.number().int().min(1).max(99_999_999),
      invoiceNumberPad: z.coerce.number().int().min(1).max(10),
      defaultPaymentDays: z.coerce.number().int().min(0).max(365),
      defaultTaxRate: z.coerce.number().min(0).max(100),
      taxLabel: z.string().trim().min(1).max(20),
      defaultNotes: opt, defaultTerms: opt,
    }),
    payment: z.object({
      bankName: opt, bankAccountName: opt, bankAccountNumber: opt, iban: opt, swift: opt, paymentInstructions: opt,
    }),
    branding: z.object({
      brandColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a hex color like #4f46e5"),
      invoiceFont: z.enum(["sans", "serif", "mono"]),
      invoiceTemplate: z.enum(["modern", "classic", "minimal"]),
    }),
  } as const;

  const schema = schemas[section as keyof typeof schemas];
  if (!schema) return { error: "Unknown section" };
  const raw = Object.fromEntries([...fd.entries()].filter(([k, v]) => !k.startsWith("_") && typeof v === "string"));
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return zodErrors(parsed.error);

  const data: Record<string, unknown> = { ...parsed.data };

  if (section === "branding") {
    const file = fd.get("logo");
    if (fd.get("_removeLogo") === "1") data.logo = null;
    else if (file instanceof File && file.size > 0) {
      if (file.size > MAX_LOGO) return { error: "Logo must be 512KB or smaller." };
      if (!["image/png", "image/jpeg"].includes(file.type)) return { error: "Logo must be PNG or JPEG." };
      data.logo = `data:${file.type};base64,${Buffer.from(await file.arrayBuffer()).toString("base64")}`;
    }
  }
  if (section === "invoicing") {
    // Prevent lowering the counter below an existing invoice number to avoid duplicates
    const n = data.nextInvoiceNumber as number;
    const candidate = `${data.invoicePrefix}${String(n).padStart(data.invoiceNumberPad as number, "0")}`;
    const clash = await db.invoice.findFirst({ where: { businessId: business.id, number: candidate } });
    if (clash) return { error: `Invoice ${candidate} already exists. Choose a higher next number.` };
  }

  await db.business.update({ where: { id: business.id }, data });
  revalidatePath("/", "layout");
  return { ok: true, message: "Settings saved" };
}

export async function deleteBusinessAction(businessId: string) {
  const user = await requireUser();
  const m = await db.membership.findUnique({ where: { userId_businessId: { userId: user.id, businessId } } });
  if (!m || m.role !== "OWNER") return { error: "Only the owner can delete a business." };
  const count = await db.membership.count({ where: { userId: user.id } });
  if (count <= 1) return { error: "You need at least one business. Create another before deleting this one." };
  await db.business.delete({ where: { id: businessId } });
  if (user.activeBusinessId === businessId) await db.user.update({ where: { id: user.id }, data: { activeBusinessId: null } });
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function addCategoryAction(name: string, color: string) {
  const { business } = await requireBusiness();
  const n = name.trim().slice(0, 60);
  if (!n) return { error: "Enter a name" };
  const c = /^#[0-9a-f]{6}$/i.test(color) ? color : "#64748b";
  try {
    const cat = await db.expenseCategory.create({ data: { businessId: business.id, name: n, color: c } });
    revalidatePath("/expenses");
    return { ok: true, category: cat };
  } catch {
    return { error: "That category already exists." };
  }
}

export async function deleteCategoryAction(id: string) {
  const { business } = await requireBusiness();
  await db.expenseCategory.deleteMany({ where: { id, businessId: business.id } });
  revalidatePath("/settings/business");
  return { ok: true };
}
