import { clsx } from "clsx";

interface MetricCardProps {
  label:  string;
  value:  string | number;
  icon:   React.ReactNode;
  color:  "indigo" | "rose" | "emerald" | "amber";
}

// Vivid gradient chips (Linear/Raycast-style) instead of flat muted fills —
// each card gets a two-stop gradient plus a matching glow, so the identity
// comes from a punch of color rather than a large tinted background.
const colors: Record<MetricCardProps["color"], { chip: string; glow: string; accent: string }> = {
  indigo:  {
    chip:   "bg-gradient-to-br from-[#6366F1] to-[#8B5CF6]",
    glow:   "shadow-[0_8px_20px_-6px_rgba(99,102,241,0.55)]",
    accent: "bg-[#6366F1]",
  },
  rose:    {
    chip:   "bg-gradient-to-br from-[#FB7185] to-[#E11D48]",
    glow:   "shadow-[0_8px_20px_-6px_rgba(225,29,72,0.5)]",
    accent: "bg-[#E11D48]",
  },
  emerald: {
    chip:   "bg-gradient-to-br from-[#34D399] to-[#059669]",
    glow:   "shadow-[0_8px_20px_-6px_rgba(5,150,105,0.5)]",
    accent: "bg-[#059669]",
  },
  amber:   {
    chip:   "bg-gradient-to-br from-[#FBBF24] to-[#F97316]",
    glow:   "shadow-[0_8px_20px_-6px_rgba(249,115,22,0.5)]",
    accent: "bg-[#F97316]",
  },
};

export default function MetricCard({ label, value, icon, color }: MetricCardProps) {
  const c = colors[color];
  return (
    <div className="card relative overflow-hidden p-5 pl-6 flex items-center gap-4">
      <span className={clsx("absolute inset-y-0 left-0 w-1", c.accent)} aria-hidden />
      <div className={clsx("flex h-11 w-11 items-center justify-center rounded-xl text-white shrink-0", c.chip, c.glow)}>
        {icon}
      </div>
      <div>
        <p className="text-xs font-medium text-slate-500">{label}</p>
        <p className="text-2xl font-bold mt-0.5 text-slate-900">{value}</p>
      </div>
    </div>
  );
}
