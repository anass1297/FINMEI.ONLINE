/**
 * Single source of truth for invoice math. Used by the live editor preview
 * AND recomputed on the server on every save — client totals are never trusted.
 */
export type LineInput = { quantity: number; unitPrice: number; taxRate: number };

export type Totals = {
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  total: number;
  lines: number[];
};

export function lineAmount(l: LineInput) {
  return Math.round((Number(l.quantity) || 0) * (Number(l.unitPrice) || 0));
}

export function computeTotals(
  items: LineInput[],
  discountType: string,
  discountValue: number
): Totals {
  const lines = items.map(lineAmount);
  const subtotal = lines.reduce((a, b) => a + b, 0);

  let discountTotal = 0;
  if (discountType === "percent") {
    discountTotal = Math.round(subtotal * Math.min(Math.max(discountValue || 0, 0), 100) / 100);
  } else {
    discountTotal = Math.min(Math.max(Math.round(discountValue || 0), 0), subtotal);
  }

  // Discount is distributed proportionally across lines before tax.
  const ratio = subtotal > 0 ? (subtotal - discountTotal) / subtotal : 0;
  const taxTotal = Math.round(
    items.reduce((acc, item, i) => acc + lines[i]! * ratio * ((Number(item.taxRate) || 0) / 100), 0)
  );

  return { subtotal, discountTotal, taxTotal, total: subtotal - discountTotal + taxTotal, lines };
}
