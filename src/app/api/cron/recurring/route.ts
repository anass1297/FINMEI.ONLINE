import { runRecurringInvoices } from "@/lib/recurring";
import { refreshOverdue } from "@/lib/invoices";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Daily job: generates due recurring invoices and flags overdue invoices.
 * Call with `Authorization: Bearer $CRON_SECRET` (e.g. Vercel Cron, GitHub Actions, crontab + curl).
 */
async function handle(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) return new Response("Unauthorized", { status: 401 });
  const result = await runRecurringInvoices();
  await refreshOverdue();
  return Response.json({ ok: true, ...result, ranAt: new Date().toISOString() });
}
export { handle as GET, handle as POST };
