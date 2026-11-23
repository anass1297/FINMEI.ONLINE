export type ActionState = { ok?: boolean; error?: string; message?: string; fieldErrors?: Record<string, string> } | null;

import type { ZodError } from "zod";
export function zodErrors(e: ZodError): ActionState {
  const fieldErrors: Record<string, string> = {};
  for (const i of e.issues) fieldErrors[i.path.join(".")] ??= i.message;
  return { error: "Please fix the highlighted fields.", fieldErrors };
}
