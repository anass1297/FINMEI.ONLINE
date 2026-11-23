import { cn } from "@/lib/utils";

export function StatCard({ label, value, sub, icon, tone = "default", href }: { label: string; value: string; sub?: React.ReactNode; icon?: React.ReactNode; tone?: "default" | "success" | "warning" | "danger"; href?: string }) {
  const toneCls = { default: "bg-brand-soft text-brand", success: "bg-success/10 text-success", warning: "bg-warning/10 text-warning", danger: "bg-danger/10 text-danger" }[tone];
  const body = (
    <div className={cn("card h-full p-5 transition", href && "hover:-translate-y-0.5 hover:shadow-pop")}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium text-subtle">{label}</p>
        {icon && <span className={cn("flex h-8 w-8 items-center justify-center rounded-lg", toneCls)}>{icon}</span>}
      </div>
      <p className="num mt-3 text-2xl font-semibold tracking-tight">{value}</p>
      {sub && <p className="mt-1 text-xs text-subtle">{sub}</p>}
    </div>
  );
  return href ? <a href={href}>{body}</a> : body;
}
