"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { signOut } from "next-auth/react";
import {
  LayoutDashboard, FileText, Users, Receipt, Repeat, CreditCard, BarChart3, Settings, Building2,
  ChevronsUpDown, Check, Plus, LogOut, User as UserIcon, Menu, X, Search,
} from "lucide-react";
import { cn, initials } from "@/lib/utils";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme";
import { switchBusinessAction } from "@/actions/business";

type Biz = { id: string; name: string; logo: string | null; brandColor: string; currency: string };

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/invoices", label: "Invoices", icon: FileText },
  { href: "/recurring", label: "Recurring", icon: Repeat },
  { href: "/customers", label: "Customers", icon: Users },
  { href: "/expenses", label: "Expenses", icon: Receipt },
  { href: "/payments", label: "Payments", icon: CreditCard },
  { href: "/reports", label: "Reports", icon: BarChart3 },
];
const NAV2 = [
  { href: "/settings/business", label: "Business settings", icon: Settings },
  { href: "/settings/businesses", label: "All businesses", icon: Building2 },
];

function useOutside(ref: React.RefObject<HTMLElement>, cb: () => void) {
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) cb(); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [ref, cb]);
}

function BizAvatar({ b, size = 28 }: { b: Pick<Biz, "name" | "logo" | "brandColor">; size?: number }) {
  if (b.logo) return <img src={b.logo} alt="" className="rounded-md border bg-white object-contain" style={{ width: size, height: size }} />;
  return <span className="flex items-center justify-center rounded-md text-[11px] font-semibold text-white" style={{ width: size, height: size, background: b.brandColor }}>{initials(b.name)}</span>;
}

function BusinessSwitcher({ current, all }: { current: Biz; all: Biz[] }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();
  useOutside(ref, () => setOpen(false));
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(!open)} className={cn("flex w-full items-center gap-2.5 rounded-lg border bg-surface px-2.5 py-2 text-left transition hover:bg-muted", pending && "opacity-60")}>
        <BizAvatar b={current} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{current.name}</span>
          <span className="block text-[11px] text-subtle">{current.currency}</span>
        </span>
        <ChevronsUpDown size={14} className="text-subtle" />
      </button>
      {open && (
        <div className="absolute left-0 right-0 top-full z-40 mt-1 rounded-lg border bg-surface p-1 shadow-pop animate-scale-in">
          <p className="px-2 py-1.5 text-[11px] font-medium uppercase tracking-wide text-subtle">Businesses</p>
          {all.map((b) => (
            <button key={b.id} onClick={() => { setOpen(false); if (b.id !== current.id) start(async () => { await switchBusinessAction(b.id); router.refresh(); }); }}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted">
              <BizAvatar b={b} size={22} />
              <span className="flex-1 truncate text-left">{b.name}</span>
              {b.id === current.id && <Check size={14} className="text-brand" />}
            </button>
          ))}
          <div className="my-1 h-px bg-border" />
          <Link href="/onboarding?new=1" onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-subtle hover:bg-muted hover:text-fg">
            <Plus size={14} /> New business
          </Link>
        </div>
      )}
    </div>
  );
}

function NavLink({ href, label, icon: Icon, onClick }: { href: string; label: string; icon: React.ElementType; onClick?: () => void }) {
  const path = usePathname();
  const active = path === href || (href !== "/dashboard" && path.startsWith(href + "/")) || path === href;
  return (
    <Link href={href} onClick={onClick} className={cn("group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition",
      active ? "bg-brand-soft text-brand" : "text-subtle hover:bg-muted hover:text-fg")}>
      <Icon size={17} className={cn(active ? "text-brand" : "text-subtle group-hover:text-fg")} />
      {label}
    </Link>
  );
}

function UserMenu({ user }: { user: { name: string | null; email: string; image: string | null } }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useOutside(ref, () => setOpen(false));
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(!open)} className="flex items-center gap-2 rounded-full p-0.5 hover:ring-2 hover:ring-border" aria-label="Account menu">
        {user.image ? <img src={user.image} alt="" className="h-8 w-8 rounded-full" /> :
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-sky-500 text-xs font-semibold text-white">{initials(user.name || user.email)}</span>}
      </button>
      {open && (
        <div className="absolute right-0 top-full z-40 mt-2 w-60 rounded-lg border bg-surface p-1 shadow-pop animate-scale-in">
          <div className="px-3 py-2">
            <p className="truncate text-sm font-medium">{user.name}</p>
            <p className="truncate text-xs text-subtle">{user.email}</p>
          </div>
          <div className="my-1 h-px bg-border" />
          <Link href="/settings/profile" onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-muted"><UserIcon size={15} /> Profile & security</Link>
          <Link href="/settings/business" onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-muted"><Settings size={15} /> Business settings</Link>
          <div className="my-1 h-px bg-border" />
          <button onClick={() => signOut({ callbackUrl: "/login" })} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-danger hover:bg-danger/10"><LogOut size={15} /> Sign out</button>
        </div>
      )}
    </div>
  );
}

export function AppShell({ children, business, businesses, user }: { children: React.ReactNode; business: Biz; businesses: Biz[]; user: { name: string | null; email: string; image: string | null } }) {
  const [mobile, setMobile] = useState(false);
  const path = usePathname();
  useEffect(() => setMobile(false), [path]);

  const sidebar = (
    <div className="flex h-full flex-col gap-4 p-3">
      <div className="flex items-center justify-center px-1.5 pb-2 pt-3"><Link href="/dashboard" className="flex w-full justify-center"><Logo /></Link>
        <button className="rounded-md p-1 text-subtle lg:hidden" onClick={() => setMobile(false)} aria-label="Close menu"><X size={18} /></button></div>
      <BusinessSwitcher current={business} all={businesses} />
      <nav className="flex flex-col gap-0.5">{NAV.map((n) => <NavLink key={n.href} {...n} />)}</nav>
      <div className="mt-auto flex flex-col gap-0.5">
        <p className="px-2.5 pb-1 text-[11px] font-medium uppercase tracking-wide text-subtle">Workspace</p>
        {NAV2.map((n) => <NavLink key={n.href} {...n} />)}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r bg-surface/60 backdrop-blur lg:block">{sidebar}</aside>
      {mobile && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40 animate-fade-in" onClick={() => setMobile(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 border-r bg-surface animate-fade-in">{sidebar}</aside>
        </div>
      )}
      <div className="lg:pl-64">
        <header className="no-print sticky top-0 z-20 flex h-14 items-center gap-3 border-b bg-bg/80 px-4 backdrop-blur sm:px-6">
          <button className="rounded-md p-1.5 text-subtle hover:bg-muted lg:hidden" onClick={() => setMobile(true)} aria-label="Open menu"><Menu size={20} /></button>
          <form action="/invoices" className="relative hidden max-w-xs flex-1 sm:block">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-subtle" />
            <input name="q" placeholder="Search invoices…" className="input h-8 pl-9 text-[13px]" />
          </form>
          <div className="ml-auto flex items-center gap-2">
            <Link href="/invoices/new" className="hidden h-8 items-center gap-1.5 rounded-lg bg-brand px-3 text-xs font-medium text-brand-fg shadow-sm hover:bg-brand/90 sm:inline-flex"><Plus size={14} /> New invoice</Link>
            <ThemeToggle compact />
            <UserMenu user={user} />
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8 animate-fade-in">{children}</main>
      </div>
    </div>
  );
}
