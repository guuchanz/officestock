"use client";

import { useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";

export interface LineChartSeries {
  key:   string;
  label: string;
  color: string;
  data:  number[];
}

interface LineChartProps {
  series:        LineChartSeries[];
  xLabels:       string[];
  yFormatter?:   (v: number) => string;
  emptyMessage?: string;
  xAxisLabel?:   string;
  yAxisLabel?:   string;
}

const VIEW_W = 720;
const VIEW_H = 280;
const MARGIN = { top: 16, right: 12, bottom: 42, left: 48 };
const PLOT_W = VIEW_W - MARGIN.left - MARGIN.right;
const PLOT_H = VIEW_H - MARGIN.top - MARGIN.bottom;

function niceMax(value: number): number {
  if (value <= 0) return 4;
  const exp = Math.floor(Math.log10(value));
  const base = Math.pow(10, exp);
  const fraction = value / base;
  const niceFraction = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10;
  return niceFraction * base;
}

// Monotone cubic interpolation (Fritsch-Carlson) — smooth, no overshoot past data bounds.
function smoothPath(points: { x: number; y: number }[]): string {
  const n = points.length;
  if (n === 0) return "";
  if (n === 1) return `M${points[0].x},${points[0].y}`;

  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);

  const d: number[] = [];
  for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));

  const m: number[] = [d[0]];
  for (let i = 1; i < n - 1; i++) m.push(d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2);
  m.push(d[d.length - 1]);

  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) {
      m[i] = 0;
      m[i + 1] = 0;
      continue;
    }
    const a = m[i] / d[i];
    const b = m[i + 1] / d[i];
    const s = a * a + b * b;
    if (s > 9) {
      const t = 3 / Math.sqrt(s);
      m[i] = t * a * d[i];
      m[i + 1] = t * b * d[i];
    }
  }

  let path = `M${xs[0].toFixed(2)},${ys[0].toFixed(2)}`;
  for (let i = 0; i < n - 1; i++) {
    const dx = (xs[i + 1] - xs[i]) / 3;
    const cp1x = xs[i] + dx, cp1y = ys[i] + m[i] * dx;
    const cp2x = xs[i + 1] - dx, cp2y = ys[i + 1] - m[i + 1] * dx;
    path += ` C${cp1x.toFixed(2)},${cp1y.toFixed(2)} ${cp2x.toFixed(2)},${cp2y.toFixed(2)} ${xs[i + 1].toFixed(2)},${ys[i + 1].toFixed(2)}`;
  }
  return path;
}

const defaultYFormatter = (v: number) => v.toLocaleString("th-TH");

export default function LineChart({
  series,
  xLabels,
  yFormatter = defaultYFormatter,
  emptyMessage,
  xAxisLabel,
  yAxisLabel,
}: LineChartProps) {
  const t = useTranslations("LineChart");
  const resolvedXAxisLabel = xAxisLabel ?? t("defaultXAxis");
  const resolvedYAxisLabel = yAxisLabel ?? t("defaultYAxis");
  const resolvedEmptyMessage = emptyMessage ?? t("emptyDefault");
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number; containerWidth: number } | null>(null);
  const [hiddenKeys, setHiddenKeys] = useState<Set<string>>(new Set());

  const toggleSeries = (key: string) =>
    setHiddenKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const visibleSeries = useMemo(() => series.filter((s) => !hiddenKeys.has(s.key)), [series, hiddenKeys]);

  const n = xLabels.length;

  const max = useMemo(() => {
    let m = 0;
    for (const s of visibleSeries) for (const v of s.data) if (v > m) m = v;
    return niceMax(m);
  }, [visibleSeries]);

  const xAt = (i: number) => (n <= 1 ? MARGIN.left + PLOT_W / 2 : MARGIN.left + (i / (n - 1)) * PLOT_W);
  const yAt = (v: number) => MARGIN.top + PLOT_H - (v / max) * PLOT_H;
  const baselineY = MARGIN.top + PLOT_H;

  const tickIndices = useMemo(() => {
    const maxTicks = 6;
    const step = Math.max(1, Math.ceil((n - 1) / (maxTicks - 1)));
    const idx: number[] = [];
    for (let i = 0; i < n; i += step) idx.push(i);
    if (n > 0 && idx[idx.length - 1] !== n - 1) idx.push(n - 1);
    return idx;
  }, [n]);

  const yTicks = [0, max * 0.25, max * 0.5, max * 0.75, max];

  const paths = useMemo(
    () =>
      visibleSeries.map((s) => {
        const pts = s.data.map((v, i) => ({ x: xAt(i), y: yAt(v) }));
        const line = smoothPath(pts);
        const area = pts.length
          ? `${line} L${pts[pts.length - 1].x.toFixed(2)},${baselineY.toFixed(2)} L${pts[0].x.toFixed(2)},${baselineY.toFixed(2)} Z`
          : "";
        return { ...s, line, area };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [visibleSeries, max, n]
  );

  const handlePointerMove = (e: React.PointerEvent<SVGRectElement>) => {
    const svg = svgRef.current;
    if (!svg || n === 0) return;
    const rect = svg.getBoundingClientRect();
    const scaleX = VIEW_W / rect.width;
    const xInView = (e.clientX - rect.left) * scaleX;
    const ratio = n <= 1 ? 0 : (xInView - MARGIN.left) / PLOT_W;
    const idx = Math.max(0, Math.min(n - 1, Math.round(ratio * (n - 1))));
    setHoverIndex(idx);

    const containerRect = svg.parentElement!.getBoundingClientRect();
    setTooltipPos({
      x: e.clientX - containerRect.left,
      y: e.clientY - containerRect.top,
      containerWidth: containerRect.width,
    });
  };

  if (series.length === 0) {
    return (
      <div className="flex aspect-[18/7] items-center justify-center text-sm text-slate-400">
        {resolvedEmptyMessage}
      </div>
    );
  }

  const hoverRows = hoverIndex === null
    ? []
    : [...visibleSeries]
        .map((s) => ({ ...s, value: s.data[hoverIndex] }))
        .sort((a, b) => b.value - a.value);

  const allHidden = visibleSeries.length === 0;

  return (
    <div className="relative">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        className="w-full aspect-[18/7] overflow-visible"
        onPointerLeave={() => { setHoverIndex(null); setTooltipPos(null); }}
      >
        <defs>
          {paths.map((s, i) => (
            <linearGradient key={s.key} id={`chart-grad-${i}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s.color} stopOpacity={0.22} />
              <stop offset="100%" stopColor={s.color} stopOpacity={0} />
            </linearGradient>
          ))}
        </defs>

        {/* Gridlines */}
        {yTicks.map((t, i) => (
          <g key={i}>
            <line
              x1={MARGIN.left}
              x2={VIEW_W - MARGIN.right}
              y1={yAt(t)}
              y2={yAt(t)}
              stroke={i === 0 ? "#d8d7cf" : "#eeede8"}
              strokeWidth={1}
            />
            <text x={MARGIN.left - 8} y={yAt(t)} textAnchor="end" dominantBaseline="middle" className="fill-slate-400" fontSize={9}>
              {yFormatter(Math.round(t))}
            </text>
          </g>
        ))}

        {/* Y-axis title */}
        <text
          x={0}
          y={0}
          transform={`translate(${12}, ${MARGIN.top + PLOT_H / 2}) rotate(-90)`}
          textAnchor="middle"
          className="fill-slate-400"
          fontSize={9.5}
          fontWeight={600}
          letterSpacing={0.3}
        >
          {resolvedYAxisLabel}
        </text>

        {/* X-axis labels */}
        {tickIndices.map((i) => (
          <text
            key={i}
            x={xAt(i)}
            y={VIEW_H - MARGIN.bottom + 18}
            textAnchor="middle"
            className="fill-slate-400"
            fontSize={9}
          >
            {xLabels[i]}
          </text>
        ))}

        {/* X-axis title */}
        <text
          x={MARGIN.left + PLOT_W / 2}
          y={VIEW_H - 6}
          textAnchor="middle"
          className="fill-slate-400"
          fontSize={9.5}
          fontWeight={600}
          letterSpacing={0.3}
        >
          {resolvedXAxisLabel}
        </text>

        {/* Area fills (under the lines) */}
        {paths.map((s, i) => (
          <path key={`area-${s.key}`} d={s.area} fill={`url(#chart-grad-${i})`} stroke="none" />
        ))}

        {/* Crosshair */}
        {hoverIndex !== null && (
          <>
            <line
              x1={xAt(hoverIndex)}
              x2={xAt(hoverIndex)}
              y1={MARGIN.top}
              y2={baselineY}
              stroke="#b8b7ae"
              strokeWidth={1}
              strokeDasharray="3 3"
            />
            <rect
              x={xAt(hoverIndex) - 14}
              y={VIEW_H - MARGIN.bottom + 7}
              width={28}
              height={15}
              rx={7.5}
              fill="#1e293b"
            />
            <text
              x={xAt(hoverIndex)}
              y={VIEW_H - MARGIN.bottom + 17.5}
              textAnchor="middle"
              fill="#fff"
              fontSize={9}
              fontWeight={600}
            >
              {xLabels[hoverIndex]}
            </text>
          </>
        )}

        {/* Lines */}
        {paths.map((s) => (
          <path key={s.key} d={s.line} fill="none" stroke={s.color} strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round" />
        ))}

        {/* End markers + hover markers */}
        {paths.map((s) => {
          const lastIdx = s.data.length - 1;
          return (
            <g key={s.key}>
              <circle cx={xAt(lastIdx)} cy={yAt(s.data[lastIdx])} r={4} fill={s.color} stroke="#fcfcfb" strokeWidth={2} />
              {hoverIndex !== null && (
                <>
                  <circle cx={xAt(hoverIndex)} cy={yAt(s.data[hoverIndex])} r={9} fill={s.color} opacity={0.16} />
                  <circle cx={xAt(hoverIndex)} cy={yAt(s.data[hoverIndex])} r={4.5} fill={s.color} stroke="#fcfcfb" strokeWidth={2} />
                </>
              )}
            </g>
          );
        })}

        {/* Hit layer */}
        <rect
          x={MARGIN.left}
          y={MARGIN.top}
          width={PLOT_W}
          height={PLOT_H}
          fill="transparent"
          onPointerMove={allHidden ? undefined : handlePointerMove}
        />
      </svg>

      {allHidden && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center pb-8 text-xs text-slate-400">
          {t("allHidden")}
        </div>
      )}

      {!allHidden && hoverIndex !== null && tooltipPos && (
        <div
          className="pointer-events-none absolute z-10 rounded-xl border border-slate-200/70 bg-white/95 backdrop-blur-sm px-3.5 py-2.5 shadow-lg ring-1 ring-black/5 text-xs min-w-[150px]"
          style={{
            left: tooltipPos.x > tooltipPos.containerWidth * 0.6 ? Math.max(tooltipPos.x - 12, 0) : tooltipPos.x + 12,
            top: Math.max(tooltipPos.y - 12, 0),
            transform: tooltipPos.x > tooltipPos.containerWidth * 0.6 ? "translateX(-100%)" : undefined,
          }}
        >
          <p className="font-semibold text-slate-700 mb-1.5">{t("tooltipDatePrefix")} {xLabels[hoverIndex]}</p>
          <div className="space-y-1.5">
            {hoverRows.map((r) => (
              <div key={r.key} className="flex items-center gap-2">
                <span className="inline-block h-[3px] w-4 rounded-full" style={{ backgroundColor: r.color }} />
                <span className="font-semibold text-slate-800 tabular-nums">{yFormatter(r.value)}</span>
                <span className="text-slate-400 truncate">{r.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Legend — click a label to hide/show its line */}
      <div className="mt-3 flex flex-wrap gap-2">
        {series.map((s) => {
          const isHidden = hiddenKeys.has(s.key);
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => toggleSeries(s.key)}
              aria-pressed={!isHidden}
              title={isHidden ? t("showSeries", { label: s.label }) : t("hideSeries", { label: s.label })}
              className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 ${
                isHidden
                  ? "border-slate-200 bg-transparent text-slate-400 opacity-60 hover:opacity-90"
                  : "border-slate-200 bg-slate-50/70 text-slate-600 hover:border-slate-300"
              }`}
              style={{ ["--tw-ring-color" as string]: s.color }}
            >
              <span
                className="inline-block h-[3px] w-3.5 rounded-full"
                style={{ backgroundColor: isHidden ? "#cbd5e1" : s.color }}
              />
              <span className={isHidden ? "line-through decoration-slate-300" : undefined}>{s.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
