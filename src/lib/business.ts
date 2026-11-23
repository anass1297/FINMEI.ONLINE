import { db } from "./db";

export const DEFAULT_EXPENSE_CATEGORIES: [string, string][] = [
  ["Software & Subscriptions", "#6366f1"],
  ["Office & Supplies", "#0ea5e9"],
  ["Travel", "#f59e0b"],
  ["Meals & Entertainment", "#ec4899"],
  ["Marketing & Advertising", "#10b981"],
  ["Contractors", "#8b5cf6"],
  ["Rent & Utilities", "#ef4444"],
  ["Equipment", "#14b8a6"],
  ["Professional Fees", "#f97316"],
  ["Taxes & Licenses", "#64748b"],
  ["Other", "#94a3b8"],
];

export async function createBusinessForUser(userId: string, data: { name: string; currency: string; email?: string | null }) {
  return db.$transaction(async (tx) => {
    const business = await tx.business.create({
      data: {
        name: data.name,
        currency: data.currency,
        email: data.email ?? null,
        memberships: { create: { userId, role: "OWNER" } },
        expenseCategories: { create: DEFAULT_EXPENSE_CATEGORIES.map(([name, color]) => ({ name, color })) },
      },
    });
    await tx.user.update({ where: { id: userId }, data: { activeBusinessId: business.id } });
    return business;
  });
}
