import { PDFDocument, rgb } from "pdf-lib";
import type { Business, Invoice, InvoiceItem, Payment } from "@prisma/client";
import { formatMoney } from "../money";
import { formatDate } from "../dates";
import { lineAmount } from "../calc";
import { parseSnapshot } from "../invoices";
import { embedDataUrlImage, hexToRgb, INK, LINE, loadFonts, MUTED, text, tint, wrap } from "./common";

type Full = Invoice & { items: InvoiceItem[]; business: Business; payments?: Payment[] };

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "DRAFT", SENT: "DUE", PARTIAL: "PARTIALLY PAID", PAID: "PAID", OVERDUE: "OVERDUE", CANCELLED: "CANCELLED",
};

export async function renderInvoicePdf(inv: Full) {
  const doc = await PDFDocument.create();
  doc.setTitle(`Invoice ${inv.number}`);
  doc.setAuthor(inv.business.name);
  doc.setCreator("Kontora");

  const W = 595.28, H = 841.89, M = 48;
  const { regular, bold } = await loadFonts(doc, inv.font);
  const accent = hexToRgb(inv.color);
  const logo = await embedDataUrlImage(doc, inv.business.logo);
  const b = inv.business;
  const cust = parseSnapshot(inv.customerSnapshot);
  const money = (c: number) => formatMoney(c, inv.currency);

  let page = doc.addPage([W, H]);
  let y = H - M;

  // ── Header ───────────────────────────────────────────
  if (inv.template === "modern") {
    page.drawRectangle({ x: 0, y: H - 8, width: W, height: 8, color: accent });
  } else if (inv.template === "classic") {
    page.drawRectangle({ x: 0, y: H - 130, width: W, height: 130, color: tint(accent, 0.92) });
  }

  let leftY = y;
  if (logo) {
    const s = Math.min(130 / logo.width, 52 / logo.height, 1);
    page.drawImage(logo, { x: M, y: leftY - logo.height * s, width: logo.width * s, height: logo.height * s });
    leftY -= logo.height * s + 12;
  }
  text(page, bold, b.name, M, leftY - 12, 13, INK);
  leftY -= 28;
  const bizLines = [
    b.addressLine1, b.addressLine2,
    [b.postalCode, b.city].filter(Boolean).join(" "),
    [b.state, b.country].filter(Boolean).join(", "),
    b.email, b.phone, b.website, b.taxId ? `Tax ID: ${b.taxId}` : null,
  ].filter(Boolean) as string[];
  for (const l of bizLines) { text(page, regular, l, M, leftY, 9, MUTED); leftY -= 12; }

  const R = W - M;
  text(page, bold, "INVOICE", R, y - 22, 24, inv.template === "minimal" ? INK : accent, "right");
  text(page, regular, `# ${inv.number}`, R, y - 40, 10, MUTED, "right");
  let ry = y - 66;
  const meta: [string, string][] = [
    ["Issue date", formatDate(inv.issueDate)],
    ["Due date", formatDate(inv.dueDate)],
    ["Status", STATUS_LABEL[inv.status] ?? inv.status],
  ];
  for (const [k, v] of meta) {
    text(page, regular, k, R - 110, ry, 9, MUTED);
    text(page, bold, v, R, ry, 9, INK, "right");
    ry -= 14;
  }

  y = Math.min(leftY, ry) - 18;

  // ── Bill to ──────────────────────────────────────────
  text(page, bold, "BILL TO", M, y, 8, accent);
  y -= 14;
  if (cust) {
    text(page, bold, cust.company || cust.name, M, y, 11, INK); y -= 14;
    const cl = [
      cust.company ? cust.name : null, cust.addressLine1, cust.addressLine2,
      [cust.postalCode, cust.city].filter(Boolean).join(" "),
      [cust.state, cust.country].filter(Boolean).join(", "),
      cust.email, cust.phone, cust.taxId ? `Tax ID: ${cust.taxId}` : null,
    ].filter(Boolean) as string[];
    for (const l of cl) { text(page, regular, l, M, y, 9, MUTED); y -= 12; }
  } else {
    text(page, regular, "—", M, y, 10, MUTED); y -= 14;
  }

  // Amount due box (right)
  const due = Math.max(inv.total - inv.amountPaid, 0);
  const boxW = 170, boxH = 50, boxY = y + 10;
  page.drawRectangle({ x: R - boxW, y: boxY, width: boxW, height: boxH, color: tint(accent, 0.9) });
  text(page, regular, inv.status === "PAID" ? "Paid in full" : "Amount due", R - boxW + 12, boxY + boxH - 16, 8, MUTED);
  text(page, bold, money(inv.status === "PAID" ? inv.total : due), R - boxW + 12, boxY + 12, 15, INK);

  y -= 24;

  // ── Items table ──────────────────────────────────────
  const cols = { desc: M + 8, qty: R - 230, price: R - 150, tax: R - 80, amt: R - 8 };
  const drawHead = () => {
    page.drawRectangle({ x: M, y: y - 8, width: W - 2 * M, height: 24, color: inv.template === "minimal" ? rgb(0.96, 0.97, 0.98) : accent });
    const hc = inv.template === "minimal" ? MUTED : rgb(1, 1, 1);
    text(page, bold, "DESCRIPTION", cols.desc, y, 8, hc);
    text(page, bold, "QTY", cols.qty, y, 8, hc, "right");
    text(page, bold, "UNIT PRICE", cols.price, y, 8, hc, "right");
    text(page, bold, "TAX", cols.tax, y, 8, hc, "right");
    text(page, bold, "AMOUNT", cols.amt, y, 8, hc, "right");
    y -= 28;
  };
  drawHead();

  const items = [...inv.items].sort((a, b) => a.sortOrder - b.sortOrder);
  for (const it of items) {
    const lines = wrap(regular, it.description, 10, cols.qty - cols.desc - 50);
    const rowH = Math.max(lines.length * 13, 13) + 10;
    if (y - rowH < 160) {
      page = doc.addPage([W, H]);
      y = H - M;
      drawHead();
    }
    lines.forEach((l, i) => text(page, regular, l, cols.desc, y - i * 13, 10, INK));
    text(page, regular, String(+it.quantity.toFixed(3)), cols.qty, y, 10, INK, "right");
    text(page, regular, money(it.unitPrice), cols.price, y, 10, INK, "right");
    text(page, regular, it.taxRate ? `${+it.taxRate.toFixed(3)}%` : "—", cols.tax, y, 10, MUTED, "right");
    text(page, bold, money(lineAmount(it)), cols.amt, y, 10, INK, "right");
    y -= rowH;
    page.drawLine({ start: { x: M, y: y + 6 }, end: { x: R, y: y + 6 }, thickness: 0.5, color: LINE });
  }

  // ── Totals ───────────────────────────────────────────
  if (y < 230) { page = doc.addPage([W, H]); y = H - M; }
  y -= 10;
  const tl = R - 200;
  const row = (k: string, v: string, strong = false, color = INK) => {
    text(page, strong ? bold : regular, k, tl, y, strong ? 11 : 10, strong ? INK : MUTED);
    text(page, strong ? bold : regular, v, R - 8, y, strong ? 11 : 10, color, "right");
    y -= strong ? 20 : 16;
  };
  row("Subtotal", money(inv.subtotal));
  if (inv.discountTotal) row(inv.discountType === "percent" ? `Discount (${+inv.discountValue.toFixed(2)}%)` : "Discount", `-${money(inv.discountTotal)}`);
  if (inv.taxTotal) row(inv.taxLabel || "Tax", money(inv.taxTotal));
  page.drawLine({ start: { x: tl, y: y + 10 }, end: { x: R, y: y + 10 }, thickness: 1, color: LINE });
  y -= 4;
  row("Total", money(inv.total), true);
  if (inv.amountPaid) {
    row("Paid", `-${money(inv.amountPaid)}`);
    row("Balance due", money(due), true, accent);
  }

  // ── Notes / payment details ─────────────────────────
  const blocks: [string, string][] = [];
  const bank = [
    b.bankName && `Bank: ${b.bankName}`, b.bankAccountName && `Account name: ${b.bankAccountName}`,
    b.bankAccountNumber && `Account no.: ${b.bankAccountNumber}`, b.iban && `IBAN: ${b.iban}`, b.swift && `SWIFT/BIC: ${b.swift}`,
  ].filter(Boolean).join("\n");
  if (inv.paymentInstructions || bank) blocks.push(["PAYMENT DETAILS", [inv.paymentInstructions, bank].filter(Boolean).join("\n")]);
  if (inv.notes) blocks.push(["NOTES", inv.notes]);
  if (inv.terms) blocks.push(["TERMS", inv.terms]);

  y -= 10;
  for (const [title, body] of blocks) {
    const lines = wrap(regular, body, 9, W - 2 * M);
    if (y - lines.length * 12 - 30 < M) { page = doc.addPage([W, H]); y = H - M; }
    text(page, bold, title, M, y, 8, accent);
    y -= 14;
    for (const l of lines) { text(page, regular, l, M, y, 9, MUTED); y -= 12; }
    y -= 10;
  }

  // ── Footer on all pages ─────────────────────────────
  const pages = doc.getPages();
  pages.forEach((p, i) => {
    text(p, regular, `${b.name} · Invoice ${inv.number}`, M, 28, 8, MUTED);
    text(p, regular, `Page ${i + 1} of ${pages.length}`, W - M, 28, 8, MUTED, "right");
  });

  return doc.save();
}
