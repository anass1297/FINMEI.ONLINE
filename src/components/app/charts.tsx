"use client";
import { useEffect, useState } from "react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, Line, ComposedChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { formatMoney } from "@/lib/money";

// Validated categorical slots (light / dark) — revenue, expenses, profit.
const LIGHT = { s1: "#2a78d6", s2: "#eb6834", s3: "#1baf7a", s1soft: "#9dc3ef", grid: "#e7e9ef", tick: "#646f87" };
const DARK = { s1: "#3987e5", s2: "#d95926", s3: "#199e70", s1soft: "#2a4a73", grid: "#262b38", tick: "#919aaf" };

function usePalette() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const el = document.documentElement;
    const update = () => setDark(el.classList.contains("dark"));
    update();
    const obs = new MutationObserver(update);
    obs.observe(el, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);
  return dark ? DARK : LIGHT;
}

type TooltipPayload = { name: string; value: number; color: string; dataKey: string }[];
function ChartTooltip({ active, payload, label, currency }: { active?: boolean; payload?: TooltipPayload; label?: string; currency: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-surface px-3 py-2 text-xs shadow-pop">
      <p className="mb-1.5 font-medium text-subtle">{label}</p>
      {payload.map((p) => (
        <div key={p.dataKey} className="flex items-center gap-2 py-0.5">
          <span className="h-0.5 w-3 rounded" style={{ background: p.color }} />
          <span className="num font-semibold text-fg">{formatMoney(p.value, currency)}</span>
          <span className="text-subtle">{p.name}</span>
        </div>
      ))}
    </div>
  );
}

const axis = (c: typeof LIGHT, currency: string) => ({
  x: { tick: { fill: c.tick, fontSize: 11 }, axisLine: false, tickLine: false, dy: 6 },
  y: { tick: { fill: c.tick, fontSize: 11 }, axisLine: false, tickLine: false, width: 64, tickFormatter: (v: number) => formatMoney(v, currency, { compact: true }) },
});

function LegendText(value: string) {
  return <span className="text-xs text-subtle">{value}</span>;
}

export type MonthPoint = { label: string; invoiced: number; collected: number; expenses: number; profit: number };

/** Monthly revenue: collected (cash in) vs invoiced. */
export function RevenueChart({ data, currency, height = 260 }: { data: MonthPoint[]; currency: string; height?: number }) {
  const c = usePalette();
  const a = axis(c, currency);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="gRev" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={c.s1} stopOpacity={0.22} /><stop offset="100%" stopColor={c.s1} stopOpacity={0} /></linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke={c.grid} />
        <XAxis dataKey="label" {...a.x} />
        <YAxis {...a.y} />
        <Tooltip content={<ChartTooltip currency={currency} />} cursor={{ stroke: c.tick, strokeWidth: 1, strokeDasharray: "3 3" }} />
        <Legend iconType="plainline" iconSize={14} formatter={LegendText} wrapperStyle={{ paddingTop: 8 }} />
        <Area type="monotoneX" dataKey="collected" name="Collected" stroke={c.s1} strokeWidth={2} fill="url(#gRev)" activeDot={{ r: 4, strokeWidth: 2 }} />
        <Area type="monotoneX" dataKey="invoiced" name="Invoiced" stroke={c.s1soft} strokeWidth={2} strokeDasharray="4 3" fill="none" activeDot={{ r: 4 }} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/** Monthly expenses — single series, so no legend box. */
export function ExpenseChart({ data, currency, height = 260 }: { data: MonthPoint[]; currency: string; height?: number }) {
  const c = usePalette();
  const a = axis(c, currency);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap="28%">
        <CartesianGrid vertical={false} stroke={c.grid} />
        <XAxis dataKey="label" {...a.x} />
        <YAxis {...a.y} />
        <Tooltip content={<ChartTooltip currency={currency} />} cursor={{ fill: c.grid, opacity: 0.5 }} />
        <Bar dataKey="expenses" name="Expenses" fill={c.s2} radius={[4, 4, 0, 0]} maxBarSize={28} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Profit & loss: revenue vs expense bars, net profit line — one shared money axis. */
export function ProfitLossChart({ data, currency, height = 300 }: { data: MonthPoint[]; currency: string; height?: number }) {
  const c = usePalette();
  const a = axis(c, currency);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={2} barCategoryGap="24%">
        <CartesianGrid vertical={false} stroke={c.grid} />
        <XAxis dataKey="label" {...a.x} />
        <YAxis {...a.y} />
        <Tooltip content={<ChartTooltip currency={currency} />} cursor={{ fill: c.grid, opacity: 0.5 }} />
        <Legend formatter={LegendText} wrapperStyle={{ paddingTop: 8 }} />
        <Bar dataKey="collected" name="Revenue" fill={c.s1} radius={[4, 4, 0, 0]} maxBarSize={22} />
        <Bar dataKey="expenses" name="Expenses" fill={c.s2} radius={[4, 4, 0, 0]} maxBarSize={22} />
        <Line type="monotoneX" dataKey="profit" name="Net profit" stroke={c.s3} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} legendType="plainline" />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

export type ComparisonPoint = { month: string; revenueThis: number; revenueLast: number };
/** Year-over-year revenue: same entity, two periods — this year solid, last year soft. */
export function YearComparisonChart({ data, currency, year }: { data: ComparisonPoint[]; currency: string; year: number }) {
  const c = usePalette();
  const a = axis(c, currency);
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={2} barCategoryGap="24%">
        <CartesianGrid vertical={false} stroke={c.grid} />
        <XAxis dataKey="month" {...a.x} />
        <YAxis {...a.y} />
        <Tooltip content={<ChartTooltip currency={currency} />} cursor={{ fill: c.grid, opacity: 0.5 }} />
        <Legend formatter={LegendText} wrapperStyle={{ paddingTop: 8 }} />
        <Bar dataKey="revenueLast" name={String(year - 1)} fill={c.s1soft} radius={[4, 4, 0, 0]} maxBarSize={18} />
        <Bar dataKey="revenueThis" name={String(year)} fill={c.s1} radius={[4, 4, 0, 0]} maxBarSize={18} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Ranked magnitude list (one hue) — used for expense categories & top customers. */
export function RankedBars({ rows, currency, emptyLabel = "No data" }: { rows: { name: string; amount: number }[]; currency: string; emptyLabel?: string }) {
  const c = usePalette();
  const max = Math.max(...rows.map((r) => r.amount), 1);
  const total = rows.reduce((s, r) => s + r.amount, 0) || 1;
  if (!rows.length) return <p className="py-8 text-center text-sm text-subtle">{emptyLabel}</p>;
  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={r.name} className="group" title={`${r.name}: ${formatMoney(r.amount, currency)}`}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate">{r.name}</span>
            <span className="num shrink-0 font-medium">{formatMoney(r.amount, currency)} <span className="text-xs font-normal text-subtle">{Math.round((r.amount / total) * 100)}%</span></span>
          </div>
          <div className="h-2 rounded bg-muted">
            <div className="h-2 rounded transition-all group-hover:opacity-80" style={{ width: `${Math.max((r.amount / max) * 100, 1.5)}%`, background: c.s2 }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
