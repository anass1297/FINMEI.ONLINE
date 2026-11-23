import { cn } from "@/lib/utils";

export function Field({ label, error, hint, className, children, htmlFor }: { label?: string; error?: string; hint?: string; className?: string; children: React.ReactNode; htmlFor?: string }) {
  return (
    <div className={cn("min-w-0", className)}>
      {label && <label htmlFor={htmlFor} className="label">{label}</label>}
      {children}
      {error ? <p className="mt-1 text-xs text-danger">{error}</p> : hint ? <p className="mt-1 text-xs text-subtle">{hint}</p> : null}
    </div>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn("input", props.className)} />;
}
export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea rows={3} {...props} className={cn("input resize-y", props.className)} />;
}
export function Select({ className, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cn("input", className)}>{children}</select>;
}
