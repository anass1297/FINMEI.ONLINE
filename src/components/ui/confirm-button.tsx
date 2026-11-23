"use client";
import { useState, useTransition } from "react";
import { Dialog } from "./dialog";
import { Button } from "./button";
import { useToast } from "./toast";

/** Button that asks for confirmation, then runs a server action. */
export function ConfirmButton({ action, title, description, confirmLabel = "Delete", children, variant = "danger-ghost", size = "sm", onDone, successMessage }: {
  action: () => Promise<unknown>;
  title: string; description?: string; confirmLabel?: string; children: React.ReactNode;
  variant?: "danger-ghost" | "secondary" | "ghost" | "danger"; size?: "sm" | "md" | "icon"; onDone?: () => void; successMessage?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const toast = useToast();
  return (
    <>
      <Button type="button" variant={variant} size={size} onClick={() => setOpen(true)}>{children}</Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={title} description={description}>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="danger" loading={pending} onClick={() => start(async () => {
            const r = (await action()) as { error?: string } | undefined;
            if (r && r.error) toast(r.error, "error");
            else { if (successMessage) toast(successMessage); setOpen(false); onDone?.(); }
          })}>{confirmLabel}</Button>
        </div>
      </Dialog>
    </>
  );
}
