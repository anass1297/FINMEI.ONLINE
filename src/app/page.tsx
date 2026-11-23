import Link from "next/link";
import { getServerSession } from "next-auth";
import { ArrowRight, FileText, Repeat, Receipt, BarChart3, Building2, ShieldCheck, Users, Wallet, Check } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme";

const FEATURES = [
  { icon: FileText, title: "Beautiful invoices", body: "Live-preview editor, custom branding, taxes, discounts and pixel-perfect PDFs." },
  { icon: Repeat, title: "Recurring billing", body: "Weekly, monthly, quarterly, annual or custom cycles — generated automatically." },
  { icon: Wallet, title: "Payment tracking", body: "Partial and full payments, balances and statuses that update themselves." },
  { icon: Users, title: "Customer CRM", body: "Contact details, invoice history, lifetime revenue and open balance per client." },
  { icon: Receipt, title: "Expenses & receipts", body: "Categorize spending, attach receipts, export CSV and PDF for your accountant." },
  { icon: BarChart3, title: "Financial reports", body: "Profit & loss, aging, customer revenue and year-over-year comparisons." },
  { icon: Building2, title: "Multi-business", body: "Run several companies from one login, each with fully separate books." },
  { icon: ShieldCheck, title: "Private by design", body: "Strict tenant isolation, hashed tokens and signed sessions." },
];

export default async function Landing() {
  const session = await getServerSession(authOptions);
  return (
    <div className="min-h-screen overflow-x-hidden">
      <header className="sticky top-0 z-20 border-b bg-bg/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Logo />
          <div className="flex items-center gap-2">
            <ThemeToggle compact />
            {session ? (
              <Link href="/dashboard" className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand px-4 text-sm font-medium text-white">Open app <ArrowRight size={15} /></Link>
            ) : (<>
              <Link href="/login" className="hidden h-9 items-center rounded-lg px-4 text-sm font-medium hover:bg-muted sm:inline-flex">Sign in</Link>
              <Link href="/register" className="inline-flex h-9 items-center rounded-lg bg-brand px-4 text-sm font-medium text-white hover:bg-brand/90">Start free</Link>
            </>)}
          </div>
        </div>
      </header>

      <section className="relative">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[520px] bg-[radial-gradient(ellipse_at_top,rgb(var(--brand)/0.16),transparent_65%)]" />
        <div className="relative mx-auto max-w-6xl px-4 pb-16 pt-20 text-center sm:px-6 sm:pt-28">
          <span className="inline-flex items-center gap-2 rounded-full border bg-surface px-3 py-1 text-xs text-subtle"><span className="h-1.5 w-1.5 rounded-full bg-success" /> Invoicing · Expenses · Reports</span>
          <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-semibold tracking-tight sm:text-6xl">The calm way to run your business finances.</h1>
          <p className="mx-auto mt-5 max-w-xl text-base text-subtle sm:text-lg">Kontora brings invoices, customers, expenses, recurring billing and reports into one focused workspace — built for freelancers, agencies and small teams.</p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/register" className="inline-flex h-11 items-center gap-2 rounded-lg bg-brand px-6 text-sm font-medium text-white shadow-sm hover:bg-brand/90">Create free account <ArrowRight size={16} /></Link>
            <Link href="/login" className="inline-flex h-11 items-center rounded-lg border bg-surface px-6 text-sm font-medium hover:bg-muted">Sign in</Link>
          </div>
          <ul className="mt-6 flex flex-wrap justify-center gap-x-6 gap-y-2 text-xs text-subtle">
            {["No credit card", "Unlimited invoices", "PDF export", "Light & dark mode"].map((t) => <li key={t} className="flex items-center gap-1.5"><Check size={13} className="text-success" />{t}</li>)}
          </ul>

          <div className="card mx-auto mt-16 max-w-4xl overflow-hidden p-2 text-left shadow-pop">
            <div className="rounded-lg border bg-bg p-5">
              <div className="grid gap-3 sm:grid-cols-3">
                {[["Revenue", "$48,250.00", "text-fg"], ["Outstanding", "$6,420.00", "text-warning"], ["Net profit", "$31,980.00", "text-success"]].map(([k, v, c]) => (
                  <div key={k} className="rounded-lg border bg-surface p-4"><p className="text-xs text-subtle">{k}</p><p className={`num mt-1 text-xl font-semibold ${c}`}>{v}</p></div>
                ))}
              </div>
              <div className="mt-3 flex h-36 items-end gap-2 rounded-lg border bg-surface p-4">
                {[40, 52, 47, 63, 58, 70, 66, 78, 72, 88, 84, 96].map((h, i) => (
                  <div key={i} className="flex flex-1 items-end gap-0.5"><div className="flex-1 rounded-t bg-[#2a78d6] dark:bg-[#3987e5]" style={{ height: `${h}%` }} /><div className="flex-1 rounded-t bg-[#eb6834] dark:bg-[#d95926]" style={{ height: `${h * 0.45}%` }} /></div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <h2 className="text-center text-2xl font-semibold tracking-tight sm:text-3xl">Everything you need. Nothing you don&apos;t.</h2>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <div key={f.title} className="card p-5 transition hover:-translate-y-0.5 hover:shadow-pop">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-soft text-brand"><f.icon size={18} /></span>
              <h3 className="mt-4 text-sm font-semibold">{f.title}</h3>
              <p className="mt-1 text-sm text-subtle">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-8 text-xs text-subtle sm:flex-row sm:px-6">
          <Logo /><p>© {new Date().getFullYear()} Kontora. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
