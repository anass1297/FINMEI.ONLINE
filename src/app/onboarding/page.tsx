import { redirect } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { Logo } from "@/components/logo";
import { OnboardingForm } from "./form";

export const metadata = { title: "Set up your business" };
export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: { new?: string } }) {
  const user = await requireUser();
  const count = await db.membership.count({ where: { userId: user.id } });
  if (count > 0 && !searchParams.new) redirect("/dashboard");
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <Link href="/" className="mb-10"><Logo /></Link>
      <div className="card w-full max-w-md p-6 sm:p-8 animate-fade-in">
        <h1 className="text-xl font-semibold tracking-tight">{count ? "Add another business" : `Welcome${user.name ? `, ${user.name.split(" ")[0]}` : ""}!`}</h1>
        <p className="mt-1 text-sm text-subtle">{count ? "Each business keeps its own invoices, customers, expenses and reports." : "Let's set up your first business. You can change everything later."}</p>
        <OnboardingForm email={user.email} />
        {count > 0 && <Link href="/dashboard" className="mt-4 block text-center text-sm text-subtle hover:text-fg">Cancel</Link>}
      </div>
    </div>
  );
}
