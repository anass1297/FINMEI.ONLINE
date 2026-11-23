"use client";
export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center text-center">
      <h2 className="text-lg font-semibold">Something went wrong</h2>
      <p className="mt-1 text-sm text-subtle">Please try again. If the problem persists, contact support.</p>
      <button onClick={reset} className="mt-4 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white">Try again</button>
    </div>
  );
}
