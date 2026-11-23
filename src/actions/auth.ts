"use server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { consumeToken, issueToken } from "@/lib/tokens";
import { sendPasswordResetEmail, sendVerificationEmail, smtpConfigured } from "@/lib/email";
import { rateLimit } from "@/lib/rate-limit";
import { requireVerification } from "@/lib/auth";
import { type ActionState, zodErrors } from "./types";

const password = z.string().min(8, "At least 8 characters").max(128).regex(/[A-Za-z]/, "Include a letter").regex(/[0-9]/, "Include a number");

function ip() {
  return headers().get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
}

export async function registerAction(_: ActionState, fd: FormData): Promise<ActionState> {
  if (!rateLimit(`register:${ip()}`, 8, 60 * 60_000)) return { error: "Too many attempts. Try again later." };
  const parsed = z.object({
    name: z.string().trim().min(2, "Enter your name").max(80),
    email: z.string().trim().toLowerCase().email("Enter a valid email"),
    password,
  }).safeParse(Object.fromEntries(fd));
  if (!parsed.success) return zodErrors(parsed.error);
  const { name, email } = parsed.data;

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    // Don't reveal account existence beyond what's necessary for UX.
    return { error: "An account with this email already exists. Try signing in." };
  }
  const user = await db.user.create({
    data: {
      name, email,
      passwordHash: await bcrypt.hash(parsed.data.password, 12),
      emailVerified: requireVerification ? null : new Date(),
    },
  });
  const token = await issueToken(user.id, "VERIFY_EMAIL", 24 * 60);
  await sendVerificationEmail(email, token);
  return {
    ok: true,
    message: requireVerification
      ? `We sent a verification link to ${email}.${smtpConfigured() ? "" : " (Dev mode: the link is printed in the server console.)"}`
      : "Account created. You can sign in now.",
  };
}

export async function resendVerificationAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const email = String(fd.get("email") || "").trim().toLowerCase();
  if (!rateLimit(`resend:${email}:${ip()}`, 3, 15 * 60_000)) return { error: "Please wait before requesting another email." };
  const user = await db.user.findUnique({ where: { email } });
  if (user && !user.emailVerified) {
    const token = await issueToken(user.id, "VERIFY_EMAIL", 24 * 60);
    await sendVerificationEmail(email, token);
  }
  return { ok: true, message: "If that account needs verification, a new link is on its way." };
}

export async function verifyEmailToken(token: string) {
  const userId = await consumeToken(token, "VERIFY_EMAIL");
  if (!userId) return false;
  await db.user.update({ where: { id: userId }, data: { emailVerified: new Date() } });
  return true;
}

export async function forgotPasswordAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const email = String(fd.get("email") || "").trim().toLowerCase();
  if (!z.string().email().safeParse(email).success) return { fieldErrors: { email: "Enter a valid email" }, error: "Enter a valid email" };
  if (!rateLimit(`forgot:${ip()}`, 5, 15 * 60_000)) return { error: "Too many requests. Try again later." };
  const user = await db.user.findUnique({ where: { email } });
  if (user) {
    const token = await issueToken(user.id, "RESET_PASSWORD", 60);
    await sendPasswordResetEmail(email, token);
  }
  // Same response whether or not the account exists (prevents enumeration).
  return { ok: true, message: `If an account exists for ${email}, you'll receive a reset link shortly.${smtpConfigured() ? "" : " (Dev mode: check the server console.)"}` };
}

export async function resetPasswordAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const parsed = z.object({ token: z.string().min(10), password, confirm: z.string() })
    .refine((d) => d.password === d.confirm, { message: "Passwords don't match", path: ["confirm"] })
    .safeParse(Object.fromEntries(fd));
  if (!parsed.success) return zodErrors(parsed.error);
  const userId = await consumeToken(parsed.data.token, "RESET_PASSWORD");
  if (!userId) return { error: "This reset link is invalid or has expired." };
  await db.user.update({
    where: { id: userId },
    // Completing a reset via email also proves ownership of the address.
    data: { passwordHash: await bcrypt.hash(parsed.data.password, 12), emailVerified: new Date() },
  });
  return { ok: true, message: "Password updated. You can now sign in." };
}
