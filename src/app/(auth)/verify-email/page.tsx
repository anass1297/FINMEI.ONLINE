import { redirect } from "next/navigation";
import Link from "next/link";
import { XCircle } from "lucide-react";
import { verifyEmailToken } from "@/actions/auth";

export const metadata = { title: "Verify email" };
export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: { token?: string } }) {
  const ok = searchParams.token ? await verifyEmailToken(searchParams.token) : false;
  if (ok) redirect("/login?verified=1");
  return (
    <div className="text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-danger/10 text-danger"><XCircle /></div>
      <h1 className="text-2xl font-semibold tracking-tight">Link invalid or expired</h1>
      <p className="mt-2 text-sm text-subtle">Sign in to request a fresh verification email.</p>
      <Link href="/login" className="mt-6 inline-block text-sm font-medium text-brand hover:underline">Go to sign in</Link>
    </div>
  );
}
