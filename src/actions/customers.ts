"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireBusiness } from "@/lib/session";
import { emptyToNull } from "@/lib/utils";

const opt = (max = 200) => z.preprocess(emptyToNull, z.string().max(max).nullable().optional());

const CustomerSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  company: opt(), email: z.preprocess(emptyToNull, z.string().email("Invalid email").nullable().optional()),
  phone: opt(40), addressLine1: opt(), addressLine2: opt(), city: opt(80), state: opt(80),
  postalCode: opt(20), country: opt(80), taxId: opt(40), currency: opt(3), notes: opt(4000),
});
export type CustomerInput = z.input<typeof CustomerSchema>;

function fieldErrors(e: z.ZodError) {
  return Object.fromEntries(e.issues.map((i) => [i.path.join("."), i.message]));
}

export async function createCustomerAction(input: CustomerInput) {
  const { business } = await requireBusiness();
  const p = CustomerSchema.safeParse(input);
  if (!p.success) return { error: "Please fix the highlighted fields.", fieldErrors: fieldErrors(p.error) };
  const customer = await db.customer.create({ data: { ...p.data, businessId: business.id } });
  revalidatePath("/customers");
  return { ok: true, customer };
}

export async function updateCustomerAction(id: string, input: CustomerInput) {
  const { business } = await requireBusiness();
  const p = CustomerSchema.safeParse(input);
  if (!p.success) return { error: "Please fix the highlighted fields.", fieldErrors: fieldErrors(p.error) };
  const r = await db.customer.updateMany({ where: { id, businessId: business.id }, data: p.data });
  if (!r.count) return { error: "Customer not found" };
  revalidatePath("/customers");
  revalidatePath(`/customers/${id}`);
  return { ok: true };
}

export async function deleteCustomerAction(id: string) {
  const { business } = await requireBusiness();
  // Invoices keep a snapshot of customer details, so history survives deletion.
  const r = await db.customer.deleteMany({ where: { id, businessId: business.id } });
  if (!r.count) return { error: "Customer not found" };
  revalidatePath("/customers");
  return { ok: true };
}
