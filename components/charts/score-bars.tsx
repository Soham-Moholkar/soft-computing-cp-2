'use client';

export function ScoreBars({
  data,
  dataKey = 'value',
  labelKey = 'name',
  color = '#4f46e5',
  domain = [0, 1],
}: {
  data: Array<Record<string, string | number>>;
  dataKey?: string;
  labelKey?: string;
  color?: string;
  domain?: [number, number];
}) {
  const width = 640;
  const height = 250;
  const left = 150;
  const right = 54;
  const chartWidth = width - left - right;
  const rowHeight = Math.min(42, 204 / Math.max(1, data.length));
  const range = Math.max(0.0001, domain[1] - domain[0]);

  return (
    <div className="h-64 w-full" role="img" aria-label="Horizontal score comparison">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full" preserveAspectRatio="none">
        {data.map((item, index) => {
          const value = Number(item[dataKey] ?? 0);
          const ratio = Math.max(0, Math.min(1, (value - domain[0]) / range));
          const y = 14 + index * rowHeight;
          const label = String(item[labelKey] ?? 'Item');
          return (
            <g key={label + index}>
              <text x={left - 12} y={y + 19} textAnchor="end" fontSize="12" fill="#475569">{label.length > 20 ? label.slice(0, 19) + '…' : label}</text>
              <rect x={left} y={y + 5} width={chartWidth} height="20" rx="5" fill="#eef2f7" />
              <rect x={left} y={y + 5} width={Math.max(2, chartWidth * ratio)} height="20" rx="5" fill={color} />
              <text x={left + chartWidth + 10} y={y + 20} fontSize="11" fill="#64748b">{value.toFixed(2)}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
