"use client";
import { useFormState, useFormStatus } from "react-dom";
import { createBusinessAction } from "@/actions/business";
import type { ActionState } from "@/actions/types";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { CURRENCIES } from "@/lib/currencies";

function Submit() {
  const { pending } = useFormStatus();
  return <Button type="submit" size="lg" className="w-full" loading={pending}>Create business</Button>;
}

export function OnboardingForm({ email }: { email: string }) {
  const [state, action] = useFormState<ActionState, FormData>(createBusinessAction, null);
  const fe = state?.fieldErrors ?? {};
  return (
    <form action={action} className="mt-6 space-y-4">
      {state?.error && !Object.keys(fe).length && <p className="text-sm text-danger">{state.error}</p>}
      <Field label="Business name" error={fe.name}><Input name="name" required placeholder="Acme Studio LLC" autoFocus /></Field>
      <Field label="Billing email" error={fe.email}><Input name="email" type="email" defaultValue={email} /></Field>
      <Field label="Default currency" error={fe.currency}>
        <Select name="currency" defaultValue="USD">
          {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code} — {c.name}</option>)}
        </Select>
      </Field>
      <Submit />
    </form>
  );
}
