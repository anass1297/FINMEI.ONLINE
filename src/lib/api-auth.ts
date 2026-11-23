import { getServerSession } from "next-auth";
import { authOptions } from "./auth";
import { db } from "./db";

/** Resolves the active business for API route handlers (returns null when unauthorized). */
export async function apiBusiness() {
  const session = await getServerSession(authOptions);
  const uid = (session?.user as { id?: string } | undefined)?.id;
  if (!uid) return null;
  const user = await db.user.findUnique({ where: { id: uid } });
  if (!user) return null;
  const m = (user.activeBusinessId
    ? await db.membership.findUnique({ where: { userId_businessId: { userId: uid, businessId: user.activeBusinessId } }, include: { business: true } })
    : null) ?? await db.membership.findFirst({ where: { userId: uid }, include: { business: true }, orderBy: { createdAt: "asc" } });
  return m ? { user, business: m.business } : null;
}
