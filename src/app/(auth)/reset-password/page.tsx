import Link from "next/link";
import { ResetForm } from "@/components/app/auth-forms";
export const metadata = { title: "Reset password" };
export default function Page({ searchParams }: { searchParams: { token?: string } }) {
  if (!searchParams.token) return <p className="text-sm">Missing token. <Link className="text-brand" href="/forgot-password">Request a new link</Link>.</p>;
  return <ResetForm token={searchParams.token} />;
}
