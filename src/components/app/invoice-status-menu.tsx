"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { FileText, Send, Wallet } from "lucide-react";
import { setInvoiceStatusAction } from "@/actions/invoices";
import { StatusBadge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";

export function InvoiceStatusMenu({ id, status, currency }: { id: string; status: string; currency?: string }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const ref = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const toast = useToast();
  const router = useRouter();

  useEffect(() => {
    const close = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!ref.current?.contains(target) && !menuRef.current?.contains(target)) setOpen(false);
    };
    const closeOnViewportChange = () => setOpen(false);
    document.addEventListener("mousedown", close);
    window.addEventListener("resize", closeOnViewportChange);
    window.addEventListener("scroll", closeOnViewportChange, true);
    return () => {
      document.removeEventListener("mousedown", close);
      window.removeEventListener("resize", closeOnViewportChange);
      window.removeEventListener("scroll", closeOnViewportChange, true);
    };
  }, []);

  const toggle = () => {
    if (!open && ref.current) {
      const rect = ref.current.getBoundingClientRect();
      setPosition({ top: rect.bottom + 4, left: Math.max(8, rect.left) });
    }
    setOpen((value) => !value);
  };

  const choose = (next: "DRAFT" | "SENT" | "PAID") => {
    start(async () => {
      const result = await setInvoiceStatusAction(id, next);
      if (result.error) toast(result.error, "error");
      else {
        toast(next === "PAID" ? "Invoice marked as paid" : next === "SENT" ? "Invoice marked as sent" : "Invoice changed to draft");
        router.refresh();
      }
      setOpen(false);
    });
  };

  const item = "flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-sm hover:bg-muted disabled:opacity-50";

  return (
    <div ref={ref} className="relative inline-block">
      <button type="button" onClick={toggle} disabled={pending} aria-label="Change invoice status" aria-expanded={open}>
        <StatusBadge status={status} />
      </button>
      {open && typeof document !== "undefined" && createPortal(
        <div ref={menuRef} className="fixed z-[100] w-44 rounded-lg border bg-surface p-1 shadow-pop animate-scale-in" style={{ top: position.top, left: position.left }}>
          <button type="button" className={item} onClick={() => choose("DRAFT")}><FileText size={14} /> Save as draft</button>
          <button type="button" className={item} onClick={() => choose("SENT")}><Send size={14} /> Send / mark sent</button>
          <button type="button" className={item} onClick={() => choose("PAID")}><Wallet size={14} /> Mark as paid</button>
        </div>,
        document.body
      )}
    </div>
  );
}
