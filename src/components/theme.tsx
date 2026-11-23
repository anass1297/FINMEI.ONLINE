"use client";
import { useEffect, useState } from "react";
import { Moon, Sun, Monitor } from "lucide-react";

export const themeScript = `(function(){try{var t=localStorage.getItem('theme')||'system';var d=t==='dark'||(t==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d)}catch(e){}})()`;

type Mode = "light" | "dark" | "system";

function apply(mode: Mode) {
  const dark = mode === "dark" || (mode === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
}

export function ThemeToggle({ compact }: { compact?: boolean }) {
  const [mode, setMode] = useState<Mode>("system");
  useEffect(() => {
    try { setMode((localStorage.getItem("theme") as Mode) || "system"); } catch {}
  }, []);
  const set = (m: Mode) => {
    setMode(m);
    try { localStorage.setItem("theme", m); } catch {}
    apply(m);
  };
  if (compact) {
    const next: Mode = mode === "dark" ? "light" : "dark";
    return (
      <button onClick={() => set(next)} className="flex h-9 w-9 items-center justify-center rounded-lg text-subtle hover:bg-muted hover:text-fg" aria-label="Toggle theme">
        <Sun size={17} className="hidden dark:block" /><Moon size={17} className="dark:hidden" />
      </button>
    );
  }
  const opts: [Mode, React.ReactNode, string][] = [["light", <Sun key="l" size={14} />, "Light"], ["dark", <Moon key="d" size={14} />, "Dark"], ["system", <Monitor key="s" size={14} />, "System"]];
  return (
    <div className="inline-flex rounded-lg border bg-muted p-0.5">
      {opts.map(([m, icon, label]) => (
        <button key={m} onClick={() => set(m)} className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition ${mode === m ? "bg-surface text-fg shadow-sm" : "text-subtle hover:text-fg"}`}>
          {icon}{label}
        </button>
      ))}
    </div>
  );
}
