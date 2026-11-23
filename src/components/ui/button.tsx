import { forwardRef } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

const variants = {
  primary: "bg-brand text-brand-fg hover:bg-brand/90 shadow-sm",
  secondary: "bg-surface border text-fg hover:bg-muted",
  ghost: "text-fg hover:bg-muted",
  danger: "bg-danger text-white hover:bg-danger/90",
  "danger-ghost": "text-danger hover:bg-danger/10",
};
const sizes = { sm: "h-8 px-3 text-xs gap-1.5", md: "h-9 px-4 text-sm gap-2", lg: "h-11 px-5 text-sm gap-2", icon: "h-9 w-9" };

type Common = { variant?: keyof typeof variants; size?: keyof typeof sizes; className?: string };
const base = "inline-flex items-center justify-center rounded-lg font-medium transition active:scale-[.98] disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 whitespace-nowrap";

export const Button = forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & Common & { loading?: boolean }>(
  ({ variant = "primary", size = "md", className, loading, children, disabled, ...props }, ref) => (
    <button ref={ref} className={cn(base, variants[variant], sizes[size], className)} disabled={disabled || loading} {...props}>
      {loading && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-r-transparent" />}
      {children}
    </button>
  )
);
Button.displayName = "Button";

export function LinkButton({ href, variant = "primary", size = "md", className, children, ...rest }: Common & { href: string; children: React.ReactNode; target?: string; prefetch?: boolean }) {
  return (
    <Link href={href} className={cn(base, variants[variant], sizes[size], className)} {...rest}>
      {children}
    </Link>
  );
}
