import { clsx } from "clsx";

interface MetricCardProps {
  label:  string;
  value:  string | number;
  icon:   React.ReactNode;
  color:  "blue" | "red" | "green" | "amber";
}

const colors = {
  blue:  { bg: "bg-blue-50",   icon: "bg-blue-100 text-blue-600",   val: "text-blue-700"  },
  red:   { bg: "bg-red-50",    icon: "bg-red-100 text-red-600",     val: "text-red-700"   },
  green: { bg: "bg-green-50",  icon: "bg-green-100 text-green-600", val: "text-green-700" },
  amber: { bg: "bg-amber-50",  icon: "bg-amber-100 text-amber-600", val: "text-amber-700" },
};

export default function MetricCard({ label, value, icon, color }: MetricCardProps) {
  const c = colors[color];
  return (
    <div className={clsx("card p-5 flex items-center gap-4", c.bg)}>
      <div className={clsx("flex h-11 w-11 items-center justify-center rounded-xl shrink-0", c.icon)}>
        {icon}
      </div>
      <div>
        <p className="text-xs font-medium text-slate-500">{label}</p>
        <p className={clsx("text-2xl font-bold mt-0.5", c.val)}>{value}</p>
      </div>
    </div>
  );
}
