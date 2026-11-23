import { PDFDocument, PDFFont, PDFPage, rgb, StandardFonts, type RGB } from "pdf-lib";

export function hexToRgb(hex: string): RGB {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  const n = m ? parseInt(m[1]!, 16) : 0x4f46e5;
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

export function tint(c: RGB, amount: number): RGB {
  return rgb(c.red + (1 - c.red) * amount, c.green + (1 - c.green) * amount, c.blue + (1 - c.blue) * amount);
}

export const INK = rgb(0.06, 0.09, 0.16);
export const MUTED = rgb(0.39, 0.45, 0.55);
export const LINE = rgb(0.89, 0.91, 0.94);

export async function loadFonts(doc: PDFDocument, family: string) {
  const map = {
    serif: [StandardFonts.TimesRoman, StandardFonts.TimesRomanBold],
    mono: [StandardFonts.Courier, StandardFonts.CourierBold],
    sans: [StandardFonts.Helvetica, StandardFonts.HelveticaBold],
  } as const;
  const [r, b] = map[(family as keyof typeof map)] ?? map.sans;
  return { regular: await doc.embedFont(r), bold: await doc.embedFont(b) };
}

const cache = new WeakMap<PDFFont, Map<string, boolean>>();
/** Standard PDF fonts only support WinAnsi; strip characters they cannot encode. */
export function safe(font: PDFFont, text: string | null | undefined) {
  if (!text) return "";
  let c = cache.get(font);
  if (!c) { c = new Map(); cache.set(font, c); }
  let out = "";
  for (const ch of text.replace(/ | /g, " ")) {
    let ok = c.get(ch);
    if (ok === undefined) {
      try { font.encodeText(ch); ok = true; } catch { ok = false; }
      c.set(ch, ok);
    }
    out += ok ? ch : ch === "\t" ? " " : "";
  }
  return out;
}

export function wrap(font: PDFFont, text: string, size: number, maxWidth: number) {
  const lines: string[] = [];
  for (const para of text.split(/\r?\n/).map((p) => safe(font, p))) {
    let line = "";
    for (const word of para.split(" ")) {
      const test = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(test, size) <= maxWidth) line = test;
      else {
        if (line) lines.push(line);
        // hard-break very long words
        let w = word;
        while (font.widthOfTextAtSize(w, size) > maxWidth && w.length > 1) {
          let i = w.length;
          while (i > 1 && font.widthOfTextAtSize(w.slice(0, i), size) > maxWidth) i--;
          lines.push(w.slice(0, i));
          w = w.slice(i);
        }
        line = w;
      }
    }
    lines.push(line);
  }
  return lines;
}

export function text(page: PDFPage, font: PDFFont, s: string, x: number, y: number, size: number, color: RGB = INK, align: "left" | "right" | "center" = "left") {
  const t = safe(font, s);
  const w = font.widthOfTextAtSize(t, size);
  const dx = align === "right" ? x - w : align === "center" ? x - w / 2 : x;
  page.drawText(t, { x: dx, y, size, font, color });
}

export async function embedDataUrlImage(doc: PDFDocument, dataUrl: string | null | undefined) {
  if (!dataUrl) return null;
  const m = /^data:(image\/(png|jpeg|jpg));base64,(.+)$/.exec(dataUrl);
  if (!m) return null;
  const bytes = Buffer.from(m[3]!, "base64");
  try {
    return m[2] === "png" ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
  } catch {
    return null;
  }
}

export function pdfResponse(bytes: Uint8Array, filename: string, inline = false) {
  return new Response(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${filename.replace(/[^a-zA-Z0-9_.-]/g, "_")}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
