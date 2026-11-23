import { db } from "@/lib/db";
import { providers } from "@/lib/payments/providers";
import { syncInvoicePayments } from "@/lib/invoices";

export const runtime = "nodejs";

/**
 * Payment provider webhooks (Stripe / PayPal) — architecture ready, providers not enabled yet.
 * A payment is only recorded after the provider's signature is verified AND the
 * event reports a completed payment. Processing is idempotent on providerRef.
 */
export async function POST(req: Request, { params }: { params: { provider: string } }) {
  const provider = providers[params.provider];
  if (!provider) return new Response("Unknown provider", { status: 404 });
  if (!provider.isConfigured()) return new Response("Provider not configured", { status: 503 });

  const raw = await req.text();
  let event;
  try {
    event = await provider.verifyWebhook(raw, req.headers);
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }
  if (!event || event.status !== "COMPLETED") return Response.json({ received: true });

  const inv = await db.invoice.findUnique({ where: { publicToken: event.invoicePublicToken } });
  if (!inv || inv.currency !== event.currency) return Response.json({ received: true, ignored: true });

  const exists = await db.payment.findUnique({ where: { providerRef: event.providerRef } });
  if (exists) return Response.json({ received: true, duplicate: true });

  await db.$transaction(async (tx) => {
    await tx.payment.create({
      data: {
        businessId: inv.businessId, invoiceId: inv.id, amount: event.amount, currency: event.currency, date: event.occurredAt,
        method: event.provider === "stripe" ? "STRIPE" : "PAYPAL", provider: event.provider, providerRef: event.providerRef, status: "COMPLETED",
      },
    });
    await syncInvoicePayments(tx, inv.id);
  });
  return Response.json({ received: true });
}
