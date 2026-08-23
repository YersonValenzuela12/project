// Lightweight SVG charts — no external dependencies.

export function BarChart({
  data, height = 200, color = '#2563eb', unit = '',
}: { data: { label: string; value: number }[]; height?: number; color?: string; unit?: string }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  const barW = 100 / data.length;
  return (
    <div className="w-full">
      <div className="flex items-end gap-3" style={{ height }}>
        {data.map((d) => {
          const h = (d.value / max) * (height - 28);
          return (
            <div key={d.label} className="flex-1 flex flex-col items-center justify-end gap-2 group">
              <span className="text-[11px] font-semibold text-ink-700 opacity-0 group-hover:opacity-100 transition">{d.value}{unit}</span>
              <div
                className="w-full max-w-[44px] rounded-t-md transition-all group-hover:opacity-80"
                style={{ height: Math.max(h, 2), background: `linear-gradient(180deg, ${color}, ${color}cc)` }}
              />
            </div>
          );
        })}
      </div>
      <div className="flex gap-3 mt-2">
        {data.map((d) => (
          <div key={d.label} className="flex-1 text-center text-[11px] font-medium text-ink-500">{d.label}</div>
        ))}
      </div>
    </div>
  );
}

export function DonutChart({
  data, size = 180, thickness = 26, centerLabel, centerSub,
}: { data: { label: string; value: number; color: string }[]; size?: number; thickness?: number; centerLabel?: string; centerSub?: string }) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="flex items-center gap-6 flex-wrap">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#f1f5f9" strokeWidth={thickness} />
          {data.map((d) => {
            const len = (d.value / total) * c;
            const seg = (
              <circle
                key={d.label}
                cx={size / 2} cy={size / 2} r={r} fill="none"
                stroke={d.color} strokeWidth={thickness}
                strokeDasharray={`${len} ${c - len}`}
                strokeDashoffset={-offset}
                strokeLinecap="butt"
              />
            );
            offset += len;
            return seg;
          })}
        </svg>
        {centerLabel && (
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold text-ink-900">{centerLabel}</span>
            {centerSub && <span className="text-xs text-ink-500">{centerSub}</span>}
          </div>
        )}
      </div>
      <div className="space-y-2 min-w-[140px]">
        {data.map((d) => (
          <div key={d.label} className="flex items-center gap-2.5 text-sm">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: d.color }} />
            <span className="text-ink-600 flex-1">{d.label}</span>
            <span className="font-semibold text-ink-900">{d.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function LineChart({
  data, height = 200, color = '#2563eb',
}: { data: { label: string; value: number }[]; height?: number; color?: string }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  const min = 0;
  const w = 600;
  const h = height;
  const pad = 28;
  const points = data.map((d, i) => {
    const x = pad + (i / (data.length - 1)) * (w - pad * 2);
    const y = h - pad - ((d.value - min) / (max - min)) * (h - pad * 2);
    return { x, y, ...d };
  });
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const area = `${path} L ${points[points.length - 1].x} ${h - pad} L ${points[0].x} ${h - pad} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height }}>
      <defs>
        <linearGradient id="lc-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.18" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0, 0.5, 1].map((t) => (
        <line key={t} x1={pad} x2={w - pad} y1={pad + t * (h - pad * 2)} y2={pad + t * (h - pad * 2)} stroke="#e2e8f0" strokeWidth="1" />
      ))}
      <path d={area} fill="url(#lc-grad)" />
      <path d={path} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {points.map((p) => (
        <g key={p.label}>
          <circle cx={p.x} cy={p.y} r="3.5" fill="white" stroke={color} strokeWidth="2" />
          <text x={p.x} y={h - 8} textAnchor="middle" className="fill-ink-500 text-[10px]">{p.label}</text>
        </g>
      ))}
    </svg>
  );
}

export function HorizontalBars({
  data, unit = '',
}: { data: { label: string; value: number; max?: number; color?: string; sub?: string }[]; unit?: string }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="space-y-3.5">
      {data.map((d) => (
        <div key={d.label}>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-sm font-medium text-ink-700">{d.label}</span>
            <span className="text-sm font-semibold text-ink-900">{d.value}{unit}{d.sub && <span className="text-ink-400 font-normal ml-1">{d.sub}</span>}</span>
          </div>
          <div className="h-2 rounded-full bg-ink-100 overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${(d.value / max) * 100}%`, background: d.color || '#2563eb' }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function Sparkline({ data, color = '#2563eb', width = 80, height = 28 }: { data: number[]; color?: string; width?: number; height?: number }) {
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * width},${height - ((v - min) / (max - min || 1)) * height}`).join(' ');
  return (
    <svg width={width} height={height} className="overflow-visible">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
