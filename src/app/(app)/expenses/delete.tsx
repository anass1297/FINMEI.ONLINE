"use client";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { deleteExpenseAction } from "@/actions/expenses";

export function DeleteExpense({ id, full }: { id: string; full?: boolean }) {
  const router = useRouter();
  return (
    <ConfirmButton size={full ? "md" : "icon"} title="Delete this expense?" description="Attached receipts will also be deleted." action={() => deleteExpenseAction(id)}
      successMessage="Expense deleted" onDone={() => full ? router.push("/expenses") : router.refresh()}>
      <Trash2 size={15} />{full && " Delete"}
    </ConfirmButton>
  );
}
