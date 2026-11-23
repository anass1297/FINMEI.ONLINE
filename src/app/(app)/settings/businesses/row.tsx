"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2, ArrowRightLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { deleteBusinessAction, switchBusinessAction } from "@/actions/business";

export function BusinessRowActions({ id, active, canDelete, name }: { id: string; active: boolean; canDelete: boolean; name: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <div className="mt-4 flex justify-between gap-2">
      {!active ? <Button size="sm" variant="secondary" loading={pending} onClick={() => start(async () => { await switchBusinessAction(id); router.push("/dashboard"); router.refresh(); })}><ArrowRightLeft size={14} /> Switch to</Button> : <span />}
      {canDelete && (
        <ConfirmButton title={`Delete ${name}?`} description="All invoices, customers, expenses, payments and files for this business will be permanently deleted." confirmLabel="Delete business"
          action={() => deleteBusinessAction(id)} successMessage="Business deleted" onDone={() => router.refresh()}><Trash2 size={14} /> Delete</ConfirmButton>
      )}
    </div>
  );
}
