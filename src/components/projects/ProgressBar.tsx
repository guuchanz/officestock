import { clsx } from "clsx";

/**
 * `value` is always the derived Project.progress, 0-100. Never accepts a
 * hand-typed number — see the module design notes.
 */
export default function ProgressBar({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className="flex items-center gap-2 min-w-[7rem]">
      <div
        className="h-1.5 flex-1 rounded-full bg-slate-200 overflow-hidden"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className={clsx("h-full rounded-full", pct === 100 ? "bg-emerald-500" : "bg-[#1e3a5f]")}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs tabular-nums text-slate-500 w-9 text-right">{pct}%</span>
    </div>
  );
}
