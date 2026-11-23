import { db } from "@/lib/db";
import { renderInvoicePdf } from "@/lib/pdf/invoice-pdf";
import { pdfResponse } from "@/lib/pdf/common";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function GET(req: Request, { params }: { params: { token: string } }) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? "local";
  if (!rateLimit(`pubpdf:${ip}`, 60, 60_000)) return new Response("Too many requests", { status: 429 });
  const inv = await db.invoice.findUnique({ where: { publicToken: params.token }, include: { items: true, business: true } });
  // Drafts are never publicly visible.
  if (!inv || inv.status === "DRAFT") return new Response("Not found", { status: 404 });
  return pdfResponse(await renderInvoicePdf(inv), `Invoice-${inv.number}.pdf`);
}
