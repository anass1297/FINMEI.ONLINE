export function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
export function endOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}
export function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
export function addMonths(d: Date, n: number) {
  const x = new Date(d);
  const day = x.getDate();
  x.setDate(1);
  x.setMonth(x.getMonth() + n);
  const last = new Date(x.getFullYear(), x.getMonth() + 1, 0).getDate();
  x.setDate(Math.min(day, last));
  return x;
}
export function toInputDate(d: Date | string | null | undefined) {
  if (!d) return "";
  const x = new Date(d);
  const y = x.getFullYear();
  const m = String(x.getMonth() + 1).padStart(2, "0");
  const day = String(x.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
/** Parses YYYY-MM-DD as a local-noon date (avoids timezone day-shift). */
export function parseInputDate(s: string | null | undefined): Date | null {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) {
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  }
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0);
}
export function formatDate(d: Date | string | null | undefined, style: "short" | "long" = "short") {
  if (!d) return "—";
  return new Intl.DateTimeFormat("en-US", style === "long"
    ? { year: "numeric", month: "long", day: "numeric" }
    : { year: "numeric", month: "short", day: "numeric" }).format(new Date(d));
}
export function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
export function monthLabel(key: string) {
  const [y, m] = key.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", { month: "short", year: "2-digit" }).format(new Date(y!, m! - 1, 1));
}
export function monthsBetween(from: Date, to: Date) {
  const keys: string[] = [];
  const cur = new Date(from.getFullYear(), from.getMonth(), 1);
  const end = new Date(to.getFullYear(), to.getMonth(), 1);
  while (cur <= end && keys.length < 120) {
    keys.push(monthKey(cur));
    cur.setMonth(cur.getMonth() + 1);
  }
  return keys;
}

export type RangePreset = "30d" | "90d" | "ytd" | "12m" | "lastyear" | "all" | "custom";

export function resolveRange(preset?: string, fromS?: string, toS?: string): { from: Date; to: Date; preset: RangePreset } {
  const now = new Date();
  const to = endOfDay(now);
  switch (preset) {
    case "30d": return { from: startOfDay(addDays(now, -29)), to, preset };
    case "90d": return { from: startOfDay(addDays(now, -89)), to, preset };
    case "ytd": return { from: new Date(now.getFullYear(), 0, 1), to, preset };
    case "lastyear": return { from: new Date(now.getFullYear() - 1, 0, 1), to: endOfDay(new Date(now.getFullYear() - 1, 11, 31)), preset };
    case "all": return { from: new Date(2000, 0, 1), to, preset };
    case "custom": {
      const f = parseInputDate(fromS);
      const t = parseInputDate(toS);
      if (f && t) return { from: startOfDay(f), to: endOfDay(t), preset };
      break;
    }
  }
  return { from: new Date(now.getFullYear(), now.getMonth() - 11, 1), to, preset: "12m" };
}
