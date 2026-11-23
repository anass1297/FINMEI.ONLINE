export default function Loading() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="h-8 w-48 rounded-lg bg-muted" />
      <div className="grid gap-4 sm:grid-cols-3">{[0, 1, 2].map((i) => <div key={i} className="h-28 rounded-xl bg-muted" />)}</div>
      <div className="h-72 rounded-xl bg-muted" />
    </div>
  );
}
