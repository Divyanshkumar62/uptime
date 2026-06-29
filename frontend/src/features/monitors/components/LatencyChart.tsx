import React, { useState } from 'react';
import type { PingMetric } from '../../../hooks/useLatency';

interface LatencyChartProps {
  history: PingMetric[];
  p99LatencyMs: number;
}

export const LatencyChart: React.FC<LatencyChartProps> = ({ history, p99LatencyMs }) => {
  const [hoveredPoint, setHoveredPoint] = useState<{
    x: number;
    y: number;
    responseTimeMs: number;
    checkedAt: string;
    isSuccess: boolean;
  } | null>(null);

  if (!history || history.length === 0) {
    return (
      <div style={{
        height: '240px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: '1px dashed var(--color-border)',
        borderRadius: 'var(--radius-lg)',
        color: 'var(--color-text-secondary)',
        fontSize: 'var(--font-size-sm)'
      }}>
        No latency data recorded in the selected window.
      </div>
    );
  }

  // Sort chronological for left-to-right drawing
  const data = [...history].reverse();
  
  // Dimensions
  const chartHeight = 200;
  const paddingLeft = 48;
  const paddingRight = 16;
  const paddingTop = 20;
  const paddingBottom = 32;
  const totalHeight = chartHeight + paddingTop + paddingBottom;

  // Let's use a dynamic container width or a fixed 700px standard for SVGs.
  const totalWidth = 700;
  const chartWidth = totalWidth - paddingLeft - paddingRight;

  const responseTimes = data.map((d) => d.response_time_ms);
  const maxLatency = Math.max(...responseTimes, p99LatencyMs, 50); // Minimum 50ms cap for Y axis scale
  const minLatency = 0;

  // Map data to SVG coordinates
  const points = data.map((d, index) => {
    const x = paddingLeft + (index * chartWidth) / (data.length - 1 || 1);
    const y = paddingTop + chartHeight - ((d.response_time_ms - minLatency) * chartHeight) / (maxLatency - minLatency);
    return {
      x,
      y,
      responseTimeMs: d.response_time_ms,
      checkedAt: d.checked_at,
      isSuccess: d.is_success,
    };
  });

  // SVG drawing paths
  const lineD = points.length > 1
    ? `M ${points[0].x} ${points[0].y} ` + points.slice(1).map((p) => `L ${p.x} ${p.y}`).join(' ')
    : '';

  const areaD = points.length > 1
    ? `${lineD} L ${points[points.length - 1].x} ${paddingTop + chartHeight} L ${points[0].x} ${paddingTop + chartHeight} Z`
    : '';

  // Draw 4 horizontal grid lines
  const gridLines = [0.25, 0.5, 0.75, 1.0].map((ratio) => {
    const val = minLatency + (maxLatency - minLatency) * ratio;
    const y = paddingTop + chartHeight - (ratio * chartHeight);
    return { val, y };
  });

  // Calculate p99 line coordinate
  const p99Y = paddingTop + chartHeight - ((p99LatencyMs - minLatency) * chartHeight) / (maxLatency - minLatency);

  const formatTime = (isoString: string) => {
    const d = new Date(isoString);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDateLabel = (isoString: string) => {
    const d = new Date(isoString);
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  return (
    <div style={{ position: 'relative', width: '100%', overflowX: 'auto', backgroundColor: 'var(--color-bg-surface)', padding: 'var(--space-lg)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)' }}>
      <svg viewBox={`0 0 ${totalWidth} ${totalHeight}`} width="100%" height={totalHeight} style={{ overflow: 'visible' }}>
        {/* Horizontal grid lines */}
        {gridLines.map((line, idx) => (
          <g key={idx}>
            <line
              x1={paddingLeft}
              y1={line.y}
              x2={totalWidth - paddingRight}
              y2={line.y}
              stroke="var(--color-border)"
              strokeWidth="0.8"
              strokeDasharray="4 4"
            />
            <text
              x={paddingLeft - 8}
              y={line.y + 4}
              textAnchor="end"
              fill="var(--color-text-secondary)"
              fontSize="10"
              fontFamily="var(--font-sans)"
            >
              {Math.round(line.val)}ms
            </text>
          </g>
        ))}

        {/* p99 Threshold Line */}
        {p99LatencyMs > 0 && (
          <g>
            <line
              x1={paddingLeft}
              y1={p99Y}
              x2={totalWidth - paddingRight}
              y2={p99Y}
              stroke="var(--color-warning)"
              strokeWidth="1.2"
              strokeDasharray="3 3"
            />
            <text
              x={totalWidth - paddingRight - 8}
              y={p99Y - 6}
              textAnchor="end"
              fill="var(--color-warning)"
              fontSize="10"
              fontWeight="bold"
              fontFamily="var(--font-sans)"
            >
              p99: {Math.round(p99LatencyMs)}ms
            </text>
          </g>
        )}

        {/* Trend Area Fill */}
        {areaD && (
          <path
            d={areaD}
            fill="url(#chart-gradient)"
            style={{ opacity: 0.15 }}
          />
        )}

        {/* Linear Trend Line */}
        {lineD && (
          <path
            d={lineD}
            fill="none"
            stroke="var(--color-primary)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {/* SVG Gradient Definition */}
        <defs>
          <linearGradient id="chart-gradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-primary)" />
            <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Interactive Mouse Hover Anchors */}
        {points.map((p, idx) => (
          <g key={idx}>
            {/* Invisibly large hover targets */}
            <circle
              cx={p.x}
              cy={p.y}
              r="8"
              fill="transparent"
              style={{ cursor: 'pointer' }}
              onMouseEnter={() => {
                setHoveredPoint({
                  x: p.x,
                  y: p.y,
                  responseTimeMs: p.responseTimeMs,
                  checkedAt: p.checkedAt,
                  isSuccess: p.isSuccess,
                });
              }}
              onMouseLeave={() => setHoveredPoint(null)}
            />
            
            {/* Actual visual coordinates */}
            <circle
              cx={p.x}
              cy={p.y}
              r={hoveredPoint?.checkedAt === p.checkedAt ? 4 : 2}
              fill={p.isSuccess ? 'var(--color-primary)' : 'var(--color-destructive)'}
              stroke="var(--color-bg-surface)"
              strokeWidth={hoveredPoint?.checkedAt === p.checkedAt ? 2 : 0.5}
            />
          </g>
        ))}

        {/* X-axis time marks */}
        {points.length > 1 && [0, Math.floor(points.length / 2), points.length - 1].map((idx) => {
          const p = points[idx];
          return (
            <text
              key={idx}
              x={p.x}
              y={paddingTop + chartHeight + 16}
              textAnchor={idx === 0 ? 'start' : idx === points.length - 1 ? 'end' : 'middle'}
              fill="var(--color-text-secondary)"
              fontSize="10"
              fontFamily="var(--font-sans)"
            >
              {formatTime(p.checkedAt)} ({formatDateLabel(p.checkedAt)})
            </text>
          );
        })}
      </svg>

      {/* Tooltip Overlay */}
      {hoveredPoint && (
        <div style={{
          position: 'absolute',
          top: `${hoveredPoint.y - 64}px`,
          left: `${Math.min(Math.max(hoveredPoint.x - 70, 10), totalWidth - 160)}px`,
          backgroundColor: 'var(--color-bg-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-md)',
          padding: 'var(--space-sm) var(--space-md)',
          boxShadow: 'var(--shadow-medium)',
          zIndex: 10,
          pointerEvents: 'none'
        }}>
          <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginBottom: '2px' }}>
            {new Date(hoveredPoint.checkedAt).toLocaleString()}
          </div>
          <div style={{ fontSize: '12px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
            <span style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              backgroundColor: hoveredPoint.isSuccess ? 'var(--color-success)' : 'var(--color-destructive)'
            }} />
            <span>{hoveredPoint.isSuccess ? `${hoveredPoint.responseTimeMs} ms` : 'Failed / Offline'}</span>
          </div>
        </div>
      )}
    </div>
  );
};
