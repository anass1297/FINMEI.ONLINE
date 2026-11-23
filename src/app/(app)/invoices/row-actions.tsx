"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MoreHorizontal, Pencil, Copy, Download, Eye, Trash2 } from "lucide-react";
import { deleteInvoiceAction, duplicateInvoiceAction } from "@/actions/invoices";
import { useToast } from "@/components/ui/toast";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export function InvoiceRowActions({ id }: { id: string }) {
  const [open, setOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, start] = useTransition();
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const ref = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const toast = useToast();
  useEffect(() => {
    const h = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!ref.current?.contains(target) && !menuRef.current?.contains(target)) setOpen(false);
    };
    const closeOnViewportChange = () => setOpen(false);
    document.addEventListener("mousedown", h);
    window.addEventListener("resize", closeOnViewportChange);
    window.addEventListener("scroll", closeOnViewportChange, true);
    return () => {
      document.removeEventListener("mousedown", h);
      window.removeEventListener("resize", closeOnViewportChange);
      window.removeEventListener("scroll", closeOnViewportChange, true);
    };
  }, []);
  const toggleMenu = () => {
    if (!open && ref.current) {
      const rect = ref.current.getBoundingClientRect();
      const menuWidth = 176;
      setPosition({
        top: rect.bottom + 4,
        left: Math.max(8, Math.min(rect.right - menuWidth, window.innerWidth - menuWidth - 8)),
      });
    }
    setOpen((value) => !value);
  };
  const item = "flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-sm hover:bg-muted";
  return (
    <>
      <div ref={ref} className="relative">
        <button type="button" onClick={toggleMenu} className="rounded-md p-1.5 text-subtle hover:bg-muted hover:text-fg" aria-label="Invoice actions" aria-expanded={open}><MoreHorizontal size={16} /></button>
        {open && typeof document !== "undefined" && createPortal(
          <div ref={menuRef} className="fixed z-[100] w-44 rounded-lg border bg-surface p-1 shadow-pop animate-scale-in" style={{ top: position.top, left: position.left }}>
            <Link href={`/invoices/${id}`} className={item}><Eye size={14} /> View</Link>
            <Link href={`/invoices/${id}/edit`} className={item}><Pencil size={14} /> Modify</Link>
            <a href={`/api/invoices/${id}/pdf`} className={item}><Download size={14} /> Download PDF</a>
            <button type="button" className={item} onClick={() => start(async () => {
              const r = await duplicateInvoiceAction(id);
              if ("id" in r && r.id) { toast("Invoice duplicated"); router.push(`/invoices/${r.id}/edit`); }
              else if (r.error) toast(r.error, "error");
            })}><Copy size={14} /> Duplicate</button>
            <button type="button" className={`${item} text-danger hover:bg-danger/10`} onClick={() => { setOpen(false); setConfirmDelete(true); }}>
              <Trash2 size={14} /> Delete
            </button>
          </div>,
          document.body
        )}
      </div>
      <Dialog open={confirmDelete} onClose={() => setConfirmDelete(false)} title="Delete this invoice permanently?" description="This also deletes its payment records. This cannot be undone.">
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => setConfirmDelete(false)}>Cancel</Button>
          <Button type="button" variant="danger" loading={pending} onClick={() => start(async () => {
            const r = await deleteInvoiceAction(id);
            if (r.error) toast(r.error, "error");
            else {
              toast("Invoice deleted");
              setConfirmDelete(false);
              router.refresh();
            }
          })}>Delete invoice</Button>
        </div>
      </Dialog>
    </>
  );
}
