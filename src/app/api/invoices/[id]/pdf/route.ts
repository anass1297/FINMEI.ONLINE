import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { renderInvoicePdf } from "@/lib/pdf/invoice-pdf";
import { pdfResponse } from "@/lib/pdf/common";

export const runtime = "nodejs";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const uid = (session?.user as { id?: string } | undefined)?.id;
  if (!uid) return new Response("Unauthorized", { status: 401 });
  // Tenancy: the invoice's business must be one the user belongs to.
  const inv = await db.invoice.findFirst({
    where: { id: params.id, business: { memberships: { some: { userId: uid } } } },
    include: { items: true, business: true },
  });
  if (!inv) return new Response("Not found", { status: 404 });
  const bytes = await renderInvoicePdf(inv);
  const inline = new URL(req.url).searchParams.get("inline") === "1";
  return pdfResponse(bytes, `Invoice-${inv.number}.pdf`, inline);
}
