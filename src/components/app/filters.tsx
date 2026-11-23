"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Calendar } from "lucide-react";

const PRESETS = [
  { v: "30d", l: "Last 30 days" }, { v: "90d", l: "Last 90 days" }, { v: "ytd", l: "Year to date" },
  { v: "12m", l: "Last 12 months" }, { v: "lastyear", l: "Last year" }, { v: "all", l: "All time" }, { v: "custom", l: "Custom range" },
];

/** Date range + currency filters, kept in the URL so views are shareable. */
export function RangeFilters({ preset, from, to, currency, currencies }: { preset: string; from: string; to: string; currency: string; currencies: string[] }) {
  const router = useRouter();
  const path = usePathname();
  const sp = useSearchParams();
  const [custom, setCustom] = useState({ from, to });
  const push = (patch: Record<string, string | null>) => {
    const p = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) v === null ? p.delete(k) : p.set(k, v);
    router.push(`${path}?${p.toString()}`);
  };
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative">
        <Calendar size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-subtle" />
        <select value={preset} onChange={(e) => e.target.value === "custom" ? push({ range: "custom", from: custom.from, to: custom.to }) : push({ range: e.target.value, from: null, to: null })} className="input h-9 w-auto pl-8" aria-label="Date range">
          {PRESETS.map((p) => <option key={p.v} value={p.v}>{p.l}</option>)}
        </select>
      </div>
      {preset === "custom" && (
        <div className="flex items-center gap-1.5">
          <input type="date" className="input h-9 w-auto" value={custom.from} onChange={(e) => setCustom({ ...custom, from: e.target.value })} aria-label="From" />
          <span className="text-subtle">–</span>
          <input type="date" className="input h-9 w-auto" value={custom.to} onChange={(e) => setCustom({ ...custom, to: e.target.value })} aria-label="To" />
          <button onClick={() => push({ range: "custom", ...custom })} className="h-9 rounded-lg bg-fg px-3 text-sm font-medium text-bg">Apply</button>
        </div>
      )}
      <select value={currency} onChange={(e) => push({ currency: e.target.value })} className="input h-9 w-auto" aria-label="Currency">
        {currencies.map((c) => <option key={c} value={c}>{c}</option>)}
      </select>
    </div>
  );
}
