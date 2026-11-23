/** All amounts are stored in minor units (cents). */

const ZERO_DECIMAL = new Set(["JPY", "XOF", "KRW", "VND", "CLP"]);

export function decimalsFor(currency: string) {
  return ZERO_DECIMAL.has(currency) ? 0 : 2;
}

/** Converts cents → major units number (e.g. 1234 → 12.34) */
export function fromCents(cents: number, currency = "USD") {
  return cents / Math.pow(10, decimalsFor(currency));
}

/** Converts a major units value (string or number) → integer cents */
export function toCents(value: string | number | null | undefined, currency = "USD") {
  if (value === null || value === undefined || value === "") return 0;
  const n = typeof value === "number" ? value : Number(String(value).replace(/[^0-9.\-]/g, ""));
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * Math.pow(10, decimalsFor(currency)));
}

export function formatMoney(cents: number, currency = "USD", opts: { compact?: boolean } = {}) {
  const value = fromCents(cents, currency);
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      notation: opts.compact ? "compact" : "standard",
      maximumFractionDigits: opts.compact ? 1 : decimalsFor(currency),
      minimumFractionDigits: opts.compact ? 0 : decimalsFor(currency),
    }).format(value);
  } catch {
    return `${currency} ${value.toFixed(decimalsFor(currency))}`;
  }
}
