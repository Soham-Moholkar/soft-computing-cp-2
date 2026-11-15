'use client';

export function ConvergenceChart({
  data,
  color = '#4f46e5',
  label = 'Best fitness',
  xLabel = 'iteration',
}: {
  data: Array<{ iteration: number; fitness: number }>;
  color?: string;
  label?: string;
  xLabel?: string;
}) {
  const frame = { left: 52, top: 16, width: 566, height: 194 };
  const minY = Math.min(0, ...data.map((point) => point.fitness));
  const maxY = Math.max(1, ...data.map((point) => point.fitness));
  const maxIteration = Math.max(1, ...data.map((point) => point.iteration));
  const pointString = data.map((point) => {
    const x = frame.left + (point.iteration / maxIteration) * frame.width;
    const y = frame.top + ((maxY - point.fitness) / (maxY - minY)) * frame.height;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');

  return (
    <div className="h-64 w-full" role="img" aria-label={`${label} by ${xLabel}`}>
      <svg viewBox="0 0 640 240" className="h-full w-full" preserveAspectRatio="none">
        {Array.from({ length: 6 }, (_, index) => minY + (maxY - minY) * index / 5).map((tick) => {
          const y = frame.top + ((maxY - tick) / (maxY - minY)) * frame.height;
          return (
            <g key={tick}>
              <line x1={frame.left} y1={y} x2={frame.left + frame.width} y2={y} stroke="#e2e8f0" strokeDasharray="4 4" />
              <text x={frame.left - 9} y={y + 4} textAnchor="end" fontSize="11" fill="#64748b">{tick.toFixed(1)}</text>
            </g>
          );
        })}
        <polyline points={pointString} fill="none" stroke={color} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
        {data.length > 0 && (
          <circle
            cx={frame.left + (data.at(-1)!.iteration / maxIteration) * frame.width}
            cy={frame.top + ((maxY - data.at(-1)!.fitness) / (maxY - minY)) * frame.height}
            r="4"
            fill={color}
          />
        )}
        {Array.from(new Set([0, Math.round(maxIteration / 2), maxIteration])).map((tick) => (
          <text key={tick} x={frame.left + (tick / maxIteration) * frame.width} y="231" textAnchor="middle" fontSize="11" fill="#64748b">{tick}</text>
        ))}
      </svg>
    </div>
  );
}
