import { addDays, addMonths } from "./dates";

export function advanceDate(d: Date, frequency: string, intervalCount = 1, intervalUnit = "MONTH") {
  switch (frequency) {
    case "WEEKLY": return addDays(d, 7);
    case "MONTHLY": return addMonths(d, 1);
    case "QUARTERLY": return addMonths(d, 3);
    case "YEARLY": return addMonths(d, 12);
    case "CUSTOM": {
      const n = Math.max(1, intervalCount);
      if (intervalUnit === "DAY") return addDays(d, n);
      if (intervalUnit === "WEEK") return addDays(d, 7 * n);
      if (intervalUnit === "YEAR") return addMonths(d, 12 * n);
      return addMonths(d, n);
    }
  }
  return addMonths(d, 1);
}

export function describeFrequency(r: { frequency: string; intervalCount: number; intervalUnit: string }) {
  if (r.frequency !== "CUSTOM") return ({ WEEKLY: "Weekly", MONTHLY: "Monthly", QUARTERLY: "Quarterly", YEARLY: "Annually" } as Record<string, string>)[r.frequency] ?? r.frequency;
  const unit = r.intervalUnit.toLowerCase();
  return `Every ${r.intervalCount} ${unit}${r.intervalCount > 1 ? "s" : ""}`;
}
