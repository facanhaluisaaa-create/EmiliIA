import { useState } from "react";

export interface Series {
  key: string;
  label: string;
  color: string;
}

export interface BarDatum {
  label: string;
  values: Record<string, number>;
}

/**
 * Gráfico de barras agrupadas ou empilhadas em SVG, com tooltip, legenda e rótulos
 * seletivos. Uma única escala; cores fixas por série; texto sempre em tons de tinta.
 */
export function Bars({ data, series, mode = "grouped", format, height = 200 }: { data: BarDatum[]; series: Series[]; mode?: "grouped" | "stacked"; format: (v: number) => string; height?: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const width = 640;
  const pad = { top: 20, right: 8, bottom: 26, left: 8 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const max = Math.max(1, ...data.map((d) => (mode === "stacked" ? series.reduce((s, k) => s + (d.values[k.key] ?? 0), 0) : Math.max(...series.map((k) => d.values[k.key] ?? 0)))));
  const slot = innerW / Math.max(1, data.length);
  const groupW = Math.min(mode === "grouped" ? 26 * series.length : 40, slot * 0.7);
  const barW = mode === "grouped" ? (groupW - 2 * (series.length - 1)) / series.length : groupW;

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full" role="img" aria-label={series.map((s) => s.label).join(", ")}>
        {[0, 0.5, 1].map((t) => (
          <line key={t} x1={pad.left} x2={width - pad.right} y1={pad.top + innerH - innerH * t} y2={pad.top + innerH - innerH * t} stroke="#E3E6E0" strokeWidth={1} />
        ))}
        {data.map((d, i) => {
          const x0 = pad.left + slot * i + (slot - groupW) / 2;
          let stackY = pad.top + innerH;
          const active = hover === i;
          return (
            <g key={d.label}>
              <rect x={pad.left + slot * i} y={pad.top} width={slot} height={innerH} fill="transparent" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(i)} onBlur={() => setHover(null)} tabIndex={0} aria-label={`${d.label}: ${series.map((s) => `${s.label} ${format(d.values[s.key] ?? 0)}`).join(", ")}`} />
              {series.map((s, j) => {
                const v = d.values[s.key] ?? 0;
                const h = (v / max) * innerH;
                let x: number;
                let y: number;
                if (mode === "grouped") {
                  x = x0 + j * (barW + 2);
                  y = pad.top + innerH - h;
                } else {
                  x = x0;
                  stackY -= h;
                  y = stackY;
                }
                if (h <= 0) return null;
                const r = Math.min(4, h / 2);
                const top = mode === "grouped" || j === series.length - 1;
                const path = top
                  ? `M${x},${y + r} a${r},${r} 0 0 1 ${r},-${r} h${barW - 2 * r} a${r},${r} 0 0 1 ${r},${r} v${h - r} h${-barW} z`
                  : `M${x},${y} h${barW} v${Math.max(0, h - 2)} h${-barW} z`;
                return <path key={s.key} d={path} fill={s.color} opacity={hover === null || active ? 1 : 0.5} style={{ transition: "opacity 150ms" }} pointerEvents="none" />;
              })}
              {active && (
                <text x={x0 + groupW / 2} y={pad.top + innerH - (mode === "stacked" ? (series.reduce((s, k) => s + (d.values[k.key] ?? 0), 0) / max) * innerH : (Math.max(...series.map((k) => d.values[k.key] ?? 0)) / max) * innerH) - 6} textAnchor="middle" fontSize={11} fontWeight={500} fill="#1D2924" pointerEvents="none">
                  {format(mode === "stacked" ? series.reduce((s, k) => s + (d.values[k.key] ?? 0), 0) : Math.max(...series.map((k) => d.values[k.key] ?? 0)))}
                </text>
              )}
              <text x={pad.left + slot * i + slot / 2} y={height - 8} textAnchor="middle" fontSize={11} fill="#65776C" pointerEvents="none">{d.label}</text>
            </g>
          );
        })}
      </svg>
      {series.length > 1 && (
        <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-muted" aria-label="Legenda">
          {series.map((s) => (
            <li key={s.key} className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} aria-hidden /> {s.label}
            </li>
          ))}
        </ul>
      )}
      {hover !== null && data[hover] && (
        <div role="tooltip" className="pointer-events-none absolute -top-2 rounded-lg border border-line bg-white px-2.5 py-1.5 text-xs shadow-card" style={{ left: `${((pad.left + slot * hover + slot / 2) / width) * 100}%`, transform: "translateX(-50%)" }}>
          <p className="font-medium text-ink">{data[hover].label}</p>
          {series.map((s) => (
            <p key={s.key} className="flex items-center gap-1.5 text-ink-muted">
              <span className="inline-block h-2 w-2 rounded-sm" style={{ background: s.color }} aria-hidden /> {s.label}: <span className="text-ink">{format(data[hover].values[s.key] ?? 0)}</span>
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
