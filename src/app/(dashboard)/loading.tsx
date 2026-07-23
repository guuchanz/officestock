export default function Loading() {
  return (
    <div className="animate-pulse space-y-6" aria-busy="true" aria-label="Loading page">
      <div className="flex items-center justify-between">
        <div className="h-7 w-48 rounded-lg bg-slate-200" />
        <div className="h-9 w-32 rounded-lg bg-slate-200" />
      </div>

      <div className="card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="h-4 w-28 rounded bg-slate-200" />
          <div className="h-8 w-56 rounded-lg bg-slate-100" />
        </div>
        <div className="divide-y divide-slate-100">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-4">
              <div className="h-9 w-9 shrink-0 rounded-lg bg-slate-100" />
              <div className="h-3.5 flex-1 max-w-xs rounded bg-slate-100" />
              <div className="h-3.5 w-24 rounded bg-slate-100" />
              <div className="h-3.5 w-16 rounded bg-slate-100" />
              <div className="h-3.5 w-20 rounded bg-slate-100" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
