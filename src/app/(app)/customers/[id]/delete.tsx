"use client";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { deleteCustomerAction } from "@/actions/customers";

export function DeleteCustomer({ id }: { id: string }) {
  const router = useRouter();
  return (
    <ConfirmButton size="md" title="Delete this customer?" description="Existing invoices are kept (with a snapshot of the customer details) but will no longer be linked."
      action={() => deleteCustomerAction(id)} successMessage="Customer deleted" onDone={() => router.push("/customers")}>
      <Trash2 size={15} /> Delete
    </ConfirmButton>
  );
}
