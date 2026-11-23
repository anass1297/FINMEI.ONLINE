import { cn } from "@/lib/utils";

const tones = {
  gray: "bg-muted text-subtle ring-border",
  blue: "bg-sky-500/10 text-sky-600 dark:text-sky-400 ring-sky-500/20",
  green: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ring-emerald-500/20",
  amber: "bg-amber-500/10 text-amber-600 dark:text-amber-400 ring-amber-500/20",
  red: "bg-red-500/10 text-red-600 dark:text-red-400 ring-red-500/20",
  violet: "bg-violet-500/10 text-violet-600 dark:text-violet-400 ring-violet-500/20",
};
export type Tone = keyof typeof tones;

export function Badge({ tone = "gray", children, className }: { tone?: Tone; children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset", tones[tone], className)}>
      {children}
    </span>
  );
}

const STATUS: Record<string, [string, Tone]> = {
  DRAFT: ["Draft", "gray"],
  SENT: ["Sent", "blue"],
  PARTIAL: ["Partially paid", "violet"],
  PAID: ["Paid", "green"],
  OVERDUE: ["Overdue", "red"],
  CANCELLED: ["Cancelled", "gray"],
  ACTIVE: ["Active", "green"],
  PAUSED: ["Paused", "amber"],
  ENDED: ["Ended", "gray"],
};

export function StatusBadge({ status }: { status: string }) {
  const [label, tone] = STATUS[status] ?? [status, "gray"];
  return (
    <Badge tone={tone}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {label}
    </Badge>
  );
}
