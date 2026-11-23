"use client";
import { useState, useTransition } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import type { Attachment, ExpenseCategory } from "@prisma/client";
import { Paperclip, Upload, X, Plus, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { saveExpenseAction, deleteAttachmentAction } from "@/actions/expenses";
import { addCategoryAction } from "@/actions/business";
import type { ActionState } from "@/actions/types";
import { CURRENCIES } from "@/lib/currencies";
import { formatMoney, toCents } from "@/lib/money";

export type ExpenseValues = { id?: string; description: string; vendor: string; categoryId: string; date: string; amount: string; currency: string; taxRate: string; notes: string };

function Submit({ edit }: { edit: boolean }) {
  const { pending } = useFormStatus();
  return <Button type="submit" loading={pending}>{edit ? "Save changes" : "Save expense"}</Button>;
}

function size(n: number) {
  return n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.ceil(n / 1024)} KB`;
}

export function ExpenseForm({ initial, categories: initialCats, attachments = [] }: { initial: ExpenseValues; categories: ExpenseCategory[]; attachments?: Attachment[] }) {
  const [state, action] = useFormState<ActionState, FormData>(saveExpenseAction, null);
  const [v, setV] = useState(initial);
  const [cats, setCats] = useState(initialCats);
  const [newCat, setNewCat] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [, start] = useTransition();
  const router = useRouter();
  const toast = useToast();
  const fe = state?.fieldErrors ?? {};
  const set = (k: keyof ExpenseValues) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setV({ ...v, [k]: e.target.value });

  const amount = toCents(v.amount, v.currency);
  const tax = Math.round(amount - amount / (1 + (Number(v.taxRate) || 0) / 100));

  return (
    <form action={(fd) => { files.forEach((f) => fd.append("files", f)); return action(fd); }} className="grid gap-6 lg:grid-cols-3">
      {v.id && <input type="hidden" name="id" value={v.id} />}
      <div className="space-y-6 lg:col-span-2">
        {state?.error && <p className="rounded-lg border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">{state.error}</p>}
        <Card>
          <CardHeader title="Expense details" />
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <Field label="Description *" error={fe.description} className="sm:col-span-2"><Input name="description" value={v.description} onChange={set("description")} required placeholder="e.g. Figma annual plan" /></Field>
            <Field label="Vendor / supplier"><Input name="vendor" value={v.vendor} onChange={set("vendor")} placeholder="Figma Inc." /></Field>
            <Field label="Transaction date *" error={fe.date}><Input type="date" name="date" value={v.date} onChange={set("date")} required /></Field>
            <Field label="Category" className="sm:col-span-2">
              <div className="flex gap-2">
                <Select name="categoryId" value={v.categoryId} onChange={set("categoryId")}>
                  <option value="">Uncategorized</option>
                  {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </Select>
                <Input value={newCat} onChange={(e) => setNewCat(e.target.value)} placeholder="New category" className="max-w-[170px]" />
                <Button type="button" variant="secondary" size="icon" aria-label="Add category" disabled={!newCat.trim()} onClick={() => start(async () => {
                  const r = await addCategoryAction(newCat, "#64748b");
                  if ("category" in r && r.category) { setCats([...cats, r.category].sort((a, b) => a.name.localeCompare(b.name))); setV({ ...v, categoryId: r.category.id }); setNewCat(""); toast("Category added"); }
                  else toast(r.error ?? "Failed", "error");
                })}><Plus size={15} /></Button>
              </div>
            </Field>
          </div>
        </Card>
        <Card>
          <CardHeader title="Amount & tax" description="Enter the total paid including tax. Tax is calculated from the rate." />
          <div className="grid gap-4 p-5 sm:grid-cols-3">
            <Field label="Total amount *" error={fe.amount}><Input name="amount" inputMode="decimal" value={v.amount} onChange={set("amount")} required placeholder="0.00" /></Field>
            <Field label="Currency"><Select name="currency" value={v.currency} onChange={set("currency")}>{CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}</Select></Field>
            <Field label="Tax / VAT rate %" hint={`Tax portion: ${formatMoney(tax, v.currency)}`}><Input name="taxRate" inputMode="decimal" value={v.taxRate} onChange={set("taxRate")} placeholder="0" /></Field>
          </div>
        </Card>
        <Card>
          <CardHeader title="Notes" />
          <div className="p-5"><Textarea name="notes" value={v.notes} onChange={set("notes")} placeholder="Business purpose, project, etc." /></div>
        </Card>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader title="Receipts & documents" description="PDF, images, CSV, DOCX, XLSX · up to 10MB each" />
          <div className="space-y-3 p-5">
            <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 text-center text-sm text-subtle transition hover:border-brand hover:bg-brand-soft/40"
              onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); setFiles([...files, ...Array.from(e.dataTransfer.files)]); }}>
              <Upload size={20} />
              <span><span className="font-medium text-brand">Click to upload</span> or drag & drop</span>
              <input type="file" multiple className="hidden" accept=".pdf,.png,.jpg,.jpeg,.webp,.heic,.gif,.csv,.txt,.docx,.xlsx" onChange={(e) => { setFiles([...files, ...Array.from(e.target.files ?? [])]); e.target.value = ""; }} />
            </label>
            {files.map((f, i) => (
              <div key={i} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
                <Paperclip size={14} className="text-subtle" /><span className="flex-1 truncate">{f.name}</span><span className="text-xs text-subtle">{size(f.size)}</span>
                <button type="button" onClick={() => setFiles(files.filter((_, j) => j !== i))} className="text-subtle hover:text-danger" aria-label="Remove"><X size={14} /></button>
              </div>
            ))}
            {attachments.map((a) => (
              <div key={a.id} className="flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-sm">
                <FileText size={14} className="text-subtle" />
                <a href={`/api/attachments/${a.id}`} target="_blank" className="flex-1 truncate hover:text-brand">{a.filename}</a>
                <span className="text-xs text-subtle">{size(a.size)}</span>
                <button type="button" aria-label="Delete file" className="text-subtle hover:text-danger" onClick={() => start(async () => { await deleteAttachmentAction(a.id); toast("File removed"); router.refresh(); })}><X size={14} /></button>
              </div>
            ))}
          </div>
        </Card>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => router.push("/expenses")}>Cancel</Button>
          <Submit edit={Boolean(v.id)} />
        </div>
      </div>
    </form>
  );
}
