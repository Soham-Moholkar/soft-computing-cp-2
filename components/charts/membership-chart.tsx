'use client';

import { gaussianMembership, trapezoidalMembership, triangularMembership } from '@/lib/algorithms/fuzzy';

export function MembershipChart({
  type,
  center,
  width,
}: {
  type: 'triangular' | 'trapezoidal' | 'gaussian';
  center: number;
  width: number;
}) {
  const points = Array.from({ length: 101 }, (_, index) => {
    const x = index / 100;
    const low = type === 'gaussian'
      ? gaussianMembership(x, Math.max(0, center - width), width / 2.5)
      : type === 'trapezoidal'
        ? trapezoidalMembership(x, 0, 0, Math.max(0.05, center - width / 2), center)
        : triangularMembership(x, -0.01, Math.max(0.02, center - width), center);
    const medium = type === 'gaussian'
      ? gaussianMembership(x, center, width / 2.5)
      : type === 'trapezoidal'
        ? trapezoidalMembership(x, center - width, center - width / 3, center + width / 3, center + width)
        : triangularMembership(x, center - width, center, center + width);
    const high = type === 'gaussian'
      ? gaussianMembership(x, Math.min(1, center + width), width / 2.5)
      : type === 'trapezoidal'
        ? trapezoidalMembership(x, center, Math.min(0.95, center + width / 2), 1, 1.01)
        : triangularMembership(x, center, Math.min(0.98, center + width), 1.01);
    return { x, low, medium, high };
  });

  const frame = { left: 50, top: 18, width: 565, height: 216 };
  const pathFor = (key: 'low' | 'medium' | 'high') => points.map((point, index) => {
    const x = frame.left + point.x * frame.width;
    const y = frame.top + (1 - point[key]) * frame.height;
    return `${index === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(' ');

  return (
    <div className="h-72 w-full" role="img" aria-label={type + ' membership functions'}>
      <svg viewBox="0 0 640 280" className="h-full w-full" preserveAspectRatio="none">
        {[0, 0.25, 0.5, 0.75, 1].map((tick) => {
          const x = frame.left + tick * frame.width;
          const y = frame.top + (1 - tick) * frame.height;
          return (
            <g key={tick}>
              <line x1={x} y1={frame.top} x2={x} y2={frame.top + frame.height} stroke="#e2e8f0" strokeDasharray="4 4" />
              <line x1={frame.left} y1={y} x2={frame.left + frame.width} y2={y} stroke="#e2e8f0" strokeDasharray="4 4" />
              <text x={x} y="260" textAnchor="middle" fontSize="11" fill="#64748b">{tick.toFixed(2)}</text>
              <text x={frame.left - 9} y={y + 4} textAnchor="end" fontSize="11" fill="#64748b">{tick.toFixed(2)}</text>
            </g>
          );
        })}
        <path d={pathFor('low')} fill="none" stroke="#0891b2" strokeWidth="3" />
        <path d={pathFor('medium')} fill="none" stroke="#4f46e5" strokeWidth="3" />
        <path d={pathFor('high')} fill="none" stroke="#d97706" strokeWidth="3" />
        <g fontSize="11" fontWeight="600">
          <text x="425" y="274" fill="#0891b2">Low</text>
          <text x="472" y="274" fill="#4f46e5">Medium</text>
          <text x="543" y="274" fill="#d97706">High</text>
        </g>
      </svg>
    </div>
  );
}
