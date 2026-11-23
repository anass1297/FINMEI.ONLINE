"use server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { type ActionState, zodErrors } from "./types";

export async function updateProfileAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = z.object({ name: z.string().trim().min(2).max(80) }).safeParse(Object.fromEntries(fd));
  if (!parsed.success) return zodErrors(parsed.error);
  await db.user.update({ where: { id: user.id }, data: { name: parsed.data.name } });
  revalidatePath("/", "layout");
  return { ok: true, message: "Profile updated" };
}

export async function changePasswordAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = z.object({
    current: z.string().optional(),
    password: z.string().min(8, "At least 8 characters").regex(/[A-Za-z]/, "Include a letter").regex(/[0-9]/, "Include a number"),
    confirm: z.string(),
  }).refine((d) => d.password === d.confirm, { message: "Passwords don't match", path: ["confirm"] }).safeParse(Object.fromEntries(fd));
  if (!parsed.success) return zodErrors(parsed.error);
  if (user.passwordHash) {
    const ok = await bcrypt.compare(parsed.data.current || "", user.passwordHash);
    if (!ok) return { error: "Current password is incorrect.", fieldErrors: { current: "Incorrect password" } };
  }
  await db.user.update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash(parsed.data.password, 12) } });
  return { ok: true, message: user.passwordHash ? "Password changed" : "Password set — you can now also sign in with email" };
}

export async function deleteAccountAction(confirmEmail: string) {
  const user = await requireUser();
  if (confirmEmail.trim().toLowerCase() !== user.email) return { error: "Email doesn't match." };
  // Delete businesses the user solely owns, then the user.
  const owned = await db.membership.findMany({ where: { userId: user.id, role: "OWNER" }, select: { businessId: true } });
  await db.business.deleteMany({ where: { id: { in: owned.map((o) => o.businessId) } } });
  await db.user.delete({ where: { id: user.id } });
  return { ok: true };
}
