import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { getFile } from "@/lib/storage";

export const runtime = "nodejs";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const uid = (session?.user as { id?: string } | undefined)?.id;
  if (!uid) return new Response("Unauthorized", { status: 401 });
  const a = await db.attachment.findFirst({ where: { id: params.id, business: { memberships: { some: { userId: uid } } } } });
  if (!a) return new Response("Not found", { status: 404 });
  const data = await getFile(a.storageKey).catch(() => null);
  if (!data) return new Response("File missing", { status: 404 });
  const inline = a.mimeType.startsWith("image/") || a.mimeType === "application/pdf";
  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": a.mimeType,
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${a.filename.replace(/[^a-zA-Z0-9_.-]/g, "_")}"`,
      "Cache-Control": "private, max-age=300",
      "Content-Security-Policy": "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox",
    },
  });
}
