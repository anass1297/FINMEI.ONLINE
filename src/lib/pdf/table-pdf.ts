import { PDFDocument, rgb } from "pdf-lib";
import { INK, LINE, loadFonts, MUTED, safe, text } from "./common";

export type TableColumn = { label: string; width: number; align?: "left" | "right" };

/** Generic, paginated report/table PDF used for expense & financial report exports. */
export async function renderTablePdf(opts: {
  title: string;
  subtitle?: string;
  businessName: string;
  columns: TableColumn[];
  rows: string[][];
  summary?: [string, string][];
  landscape?: boolean;
}) {
  const doc = await PDFDocument.create();
  doc.setTitle(opts.title);
  doc.setCreator("Kontora");
  const { regular, bold } = await loadFonts(doc, "sans");
  const [W, H] = opts.landscape ? [841.89, 595.28] : [595.28, 841.89];
  const M = 40;
  const totalW = opts.columns.reduce((a, c) => a + c.width, 0);
  const scale = (W - 2 * M) / totalW;
  const cols = opts.columns.map((c) => ({ ...c, w: c.width * scale }));
  const accent = rgb(0.31, 0.27, 0.9);

  let page = doc.addPage([W, H]);
  let y = H - M;

  text(page, bold, opts.businessName, M, y, 10, MUTED);
  y -= 22;
  text(page, bold, opts.title, M, y, 18, INK);
  y -= 16;
  if (opts.subtitle) { text(page, regular, opts.subtitle, M, y, 9, MUTED); y -= 10; }
  text(page, regular, `Generated ${new Date().toLocaleString("en-US")}`, W - M, H - M, 8, MUTED, "right");

  if (opts.summary?.length) {
    y -= 14;
    const bw = (W - 2 * M) / Math.min(opts.summary.length, 4);
    opts.summary.forEach(([k, v], i) => {
      const x = M + (i % 4) * bw;
      if (i > 0 && i % 4 === 0) y -= 48;
      page.drawRectangle({ x: x + 2, y: y - 38, width: bw - 4, height: 42, color: rgb(0.97, 0.97, 0.99), borderColor: LINE, borderWidth: 0.5 });
      text(page, regular, k, x + 10, y - 10, 8, MUTED);
      text(page, bold, v, x + 10, y - 28, 12, INK);
    });
    y -= 56;
  }

  const fit = (s: string, w: number, f = regular, size = 8.5) => {
    let t = safe(f, s);
    if (f.widthOfTextAtSize(t, size) <= w) return t;
    while (t.length > 1 && f.widthOfTextAtSize(t + "…", size) > w) t = t.slice(0, -1);
    return t + "…";
  };

  const head = () => {
    page.drawRectangle({ x: M, y: y - 6, width: W - 2 * M, height: 20, color: accent });
    let x = M;
    for (const c of cols) {
      const tx = c.align === "right" ? x + c.w - 6 : x + 6;
      text(page, bold, fit(c.label.toUpperCase(), c.w - 12, bold, 7.5), tx, y, 7.5, rgb(1, 1, 1), c.align === "right" ? "right" : "left");
      x += c.w;
    }
    y -= 22;
  };
  head();

  opts.rows.forEach((r, ri) => {
    if (y < M + 30) {
      page = doc.addPage([W, H]);
      y = H - M;
      head();
    }
    if (ri % 2 === 1) page.drawRectangle({ x: M, y: y - 5, width: W - 2 * M, height: 17, color: rgb(0.98, 0.98, 0.99) });
    let x = M;
    cols.forEach((c, ci) => {
      const v = fit(r[ci] ?? "", c.w - 12);
      text(page, regular, v, c.align === "right" ? x + c.w - 6 : x + 6, y, 8.5, INK, c.align === "right" ? "right" : "left");
      x += c.w;
    });
    y -= 17;
  });
  if (!opts.rows.length) text(page, regular, "No data for this period.", M + 6, y, 9, MUTED);

  page.drawLine({ start: { x: M, y: y + 8 }, end: { x: W - M, y: y + 8 }, thickness: 0.5, color: LINE });
  const pages = doc.getPages();
  pages.forEach((p, i) => text(p, regular, `Page ${i + 1} of ${pages.length}`, W - M, 22, 8, MUTED, "right"));
  return doc.save();
}
