import Link from "next/link";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="flex flex-col px-6 py-6 sm:px-10">
        <div className="flex items-center justify-between">
          <Link href="/"><Logo /></Link>
          <ThemeToggle compact />
        </div>
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-12 animate-fade-in">{children}</div>
        <p className="text-center text-xs text-subtle">© {new Date().getFullYear()} Kontora. All rights reserved.</p>
      </div>
      <div className="relative hidden overflow-hidden bg-[#0d0b2a] lg:block">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(129,120,255,.45),transparent_45%),radial-gradient(circle_at_80%_70%,rgba(14,165,233,.3),transparent_45%)]" />
        <div className="relative flex h-full flex-col justify-end p-12 text-white">
          <div className="mb-10 max-w-md rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur">
            <div className="flex items-center justify-between text-xs text-white/60"><span>Net profit · YTD</span><span className="rounded-full bg-emerald-400/15 px-2 py-0.5 text-emerald-300">+18.4%</span></div>
            <div className="mt-2 text-3xl font-semibold tracking-tight">$84,920.00</div>
            <div className="mt-5 flex h-20 items-end gap-1.5">
              {[35, 48, 42, 60, 55, 72, 66, 80, 74, 90, 86, 100].map((h, i) => (
                <div key={i} className="flex-1 rounded-sm bg-gradient-to-t from-indigo-400/40 to-indigo-300" style={{ height: `${h}%` }} />
              ))}
            </div>
          </div>
          <h2 className="max-w-md text-3xl font-semibold leading-tight tracking-tight">Get paid faster. Know your numbers. Stay calm.</h2>
          <p className="mt-3 max-w-md text-white/60">Invoices, expenses, recurring billing and reports — one workspace for every business you run.</p>
        </div>
      </div>
    </div>
  );
}
