"use client";
import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { forgotPasswordAction, registerAction, resendVerificationAction, resetPasswordAction } from "@/actions/auth";
import type { ActionState } from "@/actions/types";

function Submit({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return <Button type="submit" className="w-full" size="lg" loading={pending}>{children}</Button>;
}

function Alert({ tone, children }: { tone: "error" | "success"; children: React.ReactNode }) {
  return (
    <div className={`rounded-lg border px-3 py-2.5 text-sm ${tone === "error" ? "border-danger/30 bg-danger/5 text-danger" : "border-success/30 bg-success/5 text-success"}`}>{children}</div>
  );
}

function GoogleButton({ callbackUrl }: { callbackUrl: string }) {
  return (
    <Button type="button" variant="secondary" size="lg" className="w-full" onClick={() => signIn("google", { callbackUrl })}>
      <svg width="16" height="16" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>
      Continue with Google
    </Button>
  );
}

function Divider() {
  return <div className="my-5 flex items-center gap-3 text-xs text-subtle"><div className="h-px flex-1 bg-border" />or<div className="h-px flex-1 bg-border" /></div>;
}

const ERRORS: Record<string, string> = {
  CredentialsSignin: "Invalid email or password.",
  EmailNotVerified: "Please verify your email before signing in.",
  TooManyAttempts: "Too many attempts. Please wait 15 minutes.",
  OAuthAccountNotLinked: "This email is linked to another sign-in method.",
  AccessDenied: "Access denied.",
};

export function LoginForm({ google }: { google: boolean }) {
  const params = useSearchParams();
  const router = useRouter();
  const callbackUrl = params.get("callbackUrl") || "/dashboard";
  const [error, setError] = useState(params.get("error") ? ERRORS[params.get("error")!] ?? "Sign-in failed." : "");
  const [code, setCode] = useState(params.get("error") || "");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendState, resend] = useFormState<ActionState, FormData>(resendVerificationAction, null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const fd = new FormData(e.currentTarget);
    const res = await signIn("credentials", { email: fd.get("email"), password: fd.get("password"), redirect: false });
    setLoading(false);
    if (res?.ok && !res.error) {
      router.push(callbackUrl.startsWith("/") ? callbackUrl : "/dashboard");
      router.refresh();
    } else {
      setCode(res?.error || "CredentialsSignin");
      setError(ERRORS[res?.error || "CredentialsSignin"] ?? "Sign-in failed.");
    }
  }

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
      <p className="mt-1 text-sm text-subtle">Sign in to your FINMEI Financial workspace.</p>
      <div className="mt-8 space-y-4">
        {google && (<><GoogleButton callbackUrl={callbackUrl} /><Divider /></>)}
        {params.get("verified") && <Alert tone="success">Email verified — you can sign in now.</Alert>}
        {params.get("reset") && <Alert tone="success">Password updated — sign in with your new password.</Alert>}
        {error && (
          <Alert tone="error">
            {error}
            {code === "EmailNotVerified" && (
              <form action={resend} className="mt-2">
                <input type="hidden" name="email" value={email} />
                <button className="font-medium underline">Resend verification email</button>
              </form>
            )}
          </Alert>
        )}
        {resendState?.message && <Alert tone="success">{resendState.message}</Alert>}
        <form onSubmit={onSubmit} className="space-y-4">
          <Field label="Email"><Input name="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" /></Field>
          <Field label="Password">
            <Input name="password" type="password" autoComplete="current-password" required placeholder="••••••••" />
          </Field>
          <div className="flex justify-end"><Link href="/forgot-password" className="text-xs font-medium text-brand hover:underline">Forgot password?</Link></div>
          <Button type="submit" size="lg" className="w-full" loading={loading}>Sign in</Button>
        </form>
        <p className="text-center text-sm text-subtle">No account? <Link href="/register" className="font-medium text-brand hover:underline">Create one free</Link></p>
      </div>
    </>
  );
}

export function RegisterForm({ google }: { google: boolean }) {
  const [state, action] = useFormState<ActionState, FormData>(registerAction, null);
  if (state?.ok) {
    return (
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-success/10 text-success"><CheckCircle2 /></div>
        <h1 className="text-2xl font-semibold tracking-tight">Check your inbox</h1>
        <p className="mt-2 text-sm text-subtle">{state.message}</p>
        <Link href="/login" className="mt-6 inline-block text-sm font-medium text-brand hover:underline">Back to sign in</Link>
      </div>
    );
  }
  const fe = state?.fieldErrors ?? {};
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Create your account</h1>
      <p className="mt-1 text-sm text-subtle">Start invoicing in under two minutes.</p>
      <div className="mt-8 space-y-4">
        {google && (<><GoogleButton callbackUrl="/dashboard" /><Divider /></>)}
        {state?.error && !Object.keys(fe).length && <Alert tone="error">{state.error}</Alert>}
        <form action={action} className="space-y-4">
          <Field label="Full name" error={fe.name}><Input name="name" required autoComplete="name" placeholder="Alex Morgan" /></Field>
          <Field label="Work email" error={fe.email}><Input name="email" type="email" required autoComplete="email" placeholder="you@company.com" /></Field>
          <Field label="Password" error={fe.password} hint="8+ characters with a letter and a number"><Input name="password" type="password" required autoComplete="new-password" /></Field>
          <Submit>Create account</Submit>
        </form>
        <p className="text-center text-xs text-subtle">By creating an account you agree to our Terms and Privacy Policy.</p>
        <p className="text-center text-sm text-subtle">Already have an account? <Link href="/login" className="font-medium text-brand hover:underline">Sign in</Link></p>
      </div>
    </>
  );
}

export function ForgotForm() {
  const [state, action] = useFormState<ActionState, FormData>(forgotPasswordAction, null);
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Reset your password</h1>
      <p className="mt-1 text-sm text-subtle">Enter your email and we&apos;ll send you a reset link.</p>
      <div className="mt-8 space-y-4">
        {state?.ok && <Alert tone="success">{state.message}</Alert>}
        {state?.error && <Alert tone="error">{state.error}</Alert>}
        <form action={action} className="space-y-4">
          <Field label="Email"><Input name="email" type="email" required placeholder="you@company.com" /></Field>
          <Submit>Send reset link</Submit>
        </form>
        <p className="text-center text-sm"><Link href="/login" className="font-medium text-brand hover:underline">Back to sign in</Link></p>
      </div>
    </>
  );
}

export function ResetForm({ token }: { token: string }) {
  const [state, action] = useFormState<ActionState, FormData>(resetPasswordAction, null);
  const router = useRouter();
  if (state?.ok) { router.push("/login?reset=1"); }
  const fe = state?.fieldErrors ?? {};
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Choose a new password</h1>
      <div className="mt-8 space-y-4">
        {state?.error && !Object.keys(fe).length && <Alert tone="error">{state.error}</Alert>}
        <form action={action} className="space-y-4">
          <input type="hidden" name="token" value={token} />
          <Field label="New password" error={fe.password}><Input name="password" type="password" required autoComplete="new-password" /></Field>
          <Field label="Confirm password" error={fe.confirm}><Input name="confirm" type="password" required autoComplete="new-password" /></Field>
          <Submit>Update password</Submit>
        </form>
      </div>
    </>
  );
}
