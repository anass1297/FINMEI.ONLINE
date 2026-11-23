"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Pause, Play, Pencil, Trash2, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { useToast } from "@/components/ui/toast";
import { deleteRecurringAction, runRecurringNowAction, setRecurringStatusAction } from "@/actions/recurring";

export function RecurringRowActions({ id, status }: { id: string; status: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const toast = useToast();
  return (
    <div className="flex items-center justify-end gap-1">
      {status !== "ENDED" && (
        <Button size="icon" variant="ghost" loading={pending} aria-label={status === "ACTIVE" ? "Pause" : "Resume"} onClick={() => start(async () => {
          await setRecurringStatusAction(id, status === "ACTIVE" ? "PAUSED" : "ACTIVE");
          toast(status === "ACTIVE" ? "Schedule paused" : "Schedule resumed"); router.refresh();
        })}>{!pending && (status === "ACTIVE" ? <Pause size={15} /> : <Play size={15} />)}</Button>
      )}
      <Link href={`/recurring/${id}/edit`} className="rounded-md p-2 text-subtle hover:bg-muted hover:text-fg" aria-label="Edit"><Pencil size={15} /></Link>
      <ConfirmButton size="icon" title="Delete this schedule?" description="Invoices already generated are kept." action={() => deleteRecurringAction(id)} successMessage="Schedule deleted" onDone={() => router.refresh()}><Trash2 size={15} /></ConfirmButton>
    </div>
  );
}

export function RunNowButton() {
  const [pending, start] = useTransition();
  const router = useRouter();
  const toast = useToast();
  return (
    <Button variant="secondary" loading={pending} onClick={() => start(async () => {
      const r = await runRecurringNowAction();
      toast(r.generated ? `Generated ${r.generated} invoice${r.generated > 1 ? "s" : ""}` : "No invoices due right now");
      router.refresh();
    })}><Zap size={15} /> Run now</Button>
  );
}
