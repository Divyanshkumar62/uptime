import React from 'react';

interface LatencySparklineProps {
  history: Array<{ response_time_ms: number; is_success: boolean }>;
}

export const LatencySparkline: React.FC<LatencySparklineProps> = ({ history }) => {
  if (!history || history.length === 0) {
    return <span style={{ color: 'var(--color-inactive)', fontSize: 'var(--font-size-xs)' }}>No data</span>;
  }

  // Use up to the last 20 check metrics for sparklines
  const points = [...history].slice(0, 20).reverse();
  const maxVal = Math.max(...points.map((p) => p.response_time_ms), 10);
  const minVal = 0;
  
  const width = 100;
  const height = 24;
  const padding = 2;

  // Map values to coordinates
  const coords = points.map((p, idx) => {
    const x = padding + (idx * (width - padding * 2)) / (points.length - 1 || 1);
    // Invert Y coordinate since SVG (0,0) is top-left
    const y = height - padding - ((p.response_time_ms - minVal) * (height - padding * 2)) / (maxVal - minVal);
    return { x, y, isSuccess: p.is_success };
  });

  const pathD = coords.length > 1
    ? `M ${coords[0].x} ${coords[0].y} ` + coords.slice(1).map((c) => `L ${c.x} ${c.y}`).join(' ')
    : '';

  return (
    <svg width={width} height={height} style={{ overflow: 'visible' }} aria-hidden="true">
      {/* Sparkline trend line */}
      {coords.length > 1 && (
        <path
          d={pathD}
          fill="none"
          stroke="var(--color-primary)"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ opacity: 0.8 }}
        />
      )}

      {/* Render status dots for the latest points */}
      {coords.map((c, idx) => (
        <circle
          key={idx}
          cx={c.x}
          cy={c.y}
          r={idx === coords.length - 1 ? 2.5 : 1}
          fill={c.isSuccess ? 'var(--color-success)' : 'var(--color-destructive)'}
        />
      ))}
    </svg>
  );
};
