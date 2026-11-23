import "server-only";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { cache } from "react";
import { authOptions } from "./auth";
import { db } from "./db";

/** Returns the signed-in user (fresh from the DB) or redirects to /login. */
export const requireUser = cache(async () => {
  const session = await getServerSession(authOptions);
  const uid = (session?.user as { id?: string } | undefined)?.id;
  if (!uid) redirect("/login");
  const user = await db.user.findUnique({ where: { id: uid } });
  if (!user) redirect("/login");
  return user;
});

/**
 * Tenancy guard. Resolves the active business for the current user and
 * verifies membership. EVERY business-scoped query must use the returned id.
 */
export const requireBusiness = cache(async () => {
  const user = await requireUser();
  let membership = user.activeBusinessId
    ? await db.membership.findUnique({
        where: { userId_businessId: { userId: user.id, businessId: user.activeBusinessId } },
        include: { business: true },
      })
    : null;
  if (!membership) {
    membership = await db.membership.findFirst({
      where: { userId: user.id },
      include: { business: true },
      orderBy: { createdAt: "asc" },
    });
    if (!membership) redirect("/onboarding");
    await db.user.update({ where: { id: user.id }, data: { activeBusinessId: membership.businessId } });
  }
  return { user, business: membership.business, role: membership.role };
});

export async function listUserBusinesses(userId: string) {
  const m = await db.membership.findMany({
    where: { userId },
    include: { business: { select: { id: true, name: true, logo: true, currency: true, brandColor: true } } },
    orderBy: { createdAt: "asc" },
  });
  return m.map((x) => ({ ...x.business, role: x.role }));
}
