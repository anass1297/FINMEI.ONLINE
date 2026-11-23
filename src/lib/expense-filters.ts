import type { Prisma } from "@prisma/client";
import { endOfDay, parseInputDate, startOfDay } from "./dates";

export type ExpenseSearch = { from?: string; to?: string; category?: string; q?: string; currency?: string };

export function expenseWhere(businessId: string, sp: ExpenseSearch): Prisma.ExpenseWhereInput {
  const where: Prisma.ExpenseWhereInput = { businessId };
  const from = parseInputDate(sp.from), to = parseInputDate(sp.to);
  if (from || to) where.date = { ...(from ? { gte: startOfDay(from) } : {}), ...(to ? { lte: endOfDay(to) } : {}) };
  if (sp.category === "none") where.categoryId = null;
  else if (sp.category) where.categoryId = sp.category;
  if (sp.currency) where.currency = sp.currency;
  if (sp.q) where.OR = [{ description: { contains: sp.q } }, { vendor: { contains: sp.q } }, { notes: { contains: sp.q } }];
  return where;
}
