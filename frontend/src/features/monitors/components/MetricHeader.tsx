import React from 'react';
import { List, CheckCircle, AlertTriangle, PauseCircle } from 'lucide-react';

interface MetricHeaderProps {
  totalCount: number;
  healthyCount: number;
  outageCount: number;
  pausedCount: number;
  maxLimit?: number;
}

export const MetricHeader: React.FC<MetricHeaderProps> = ({
  totalCount,
  healthyCount,
  outageCount,
  pausedCount,
  maxLimit = 50
}) => {
  const cardStyle: React.CSSProperties = {
    padding: 'var(--space-lg)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-lg)',
    backgroundColor: 'var(--color-bg-surface)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
    transition: 'border-color var(--duration-fast) var(--easing-standard)',
  };

  const labelStyle: React.CSSProperties = {
    fontSize: '11px',
    color: 'var(--color-text-muted)',
    display: 'block',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    fontFamily: 'var(--font-mono)',
    marginBottom: '4px'
  };

  const valueStyle: React.CSSProperties = {
    fontSize: '20px',
    fontWeight: 'var(--font-weight-bold)',
    fontFamily: 'var(--font-mono)',
    color: 'var(--color-text-primary)'
  };

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
      gap: 'var(--space-lg)',
      width: '100%'
    }}>
      {/* Total Monitors Card */}
      <div style={cardStyle}>
        <div>
          <span style={labelStyle}>Total Monitors</span>
          <span style={valueStyle}>{totalCount} / {maxLimit} Max</span>
        </div>
        <div style={{ 
          padding: 'var(--space-sm)', 
          borderRadius: 'var(--radius-md)', 
          backgroundColor: 'rgba(78, 222, 163, 0.1)', 
          color: 'var(--color-primary)' 
        }}>
          <List size={20} />
        </div>
      </div>

      {/* Healthy Card */}
      <div style={{ ...cardStyle, borderLeft: '3px solid var(--color-success)' }}>
        <div>
          <span style={{ ...labelStyle, color: 'var(--color-success)' }}>Healthy</span>
          <span style={valueStyle}>{healthyCount}</span>
        </div>
        <div style={{ 
          padding: 'var(--space-sm)', 
          borderRadius: 'var(--radius-md)', 
          backgroundColor: 'var(--color-success-bg)', 
          color: 'var(--color-success)' 
        }}>
          <CheckCircle size={20} />
        </div>
      </div>

      {/* Outages Card */}
      <div style={{ ...cardStyle, borderLeft: '3px solid var(--color-destructive)' }}>
        <div>
          <span style={{ ...labelStyle, color: 'var(--color-destructive)' }}>Outages</span>
          <span style={{ 
            ...valueStyle, 
            color: outageCount > 0 ? 'var(--color-destructive)' : 'var(--color-text-primary)' 
          }}>{outageCount}</span>
        </div>
        <div style={{ 
          padding: 'var(--space-sm)', 
          borderRadius: 'var(--radius-md)', 
          backgroundColor: 'var(--color-destructive-bg)', 
          color: 'var(--color-destructive)' 
        }}>
          <AlertTriangle size={20} />
        </div>
      </div>

      {/* Paused Card */}
      <div style={{ ...cardStyle, borderLeft: '3px solid var(--color-inactive)' }}>
        <div>
          <span style={{ ...labelStyle, color: 'var(--color-text-muted)' }}>Paused</span>
          <span style={valueStyle}>{pausedCount}</span>
        </div>
        <div style={{ 
          padding: 'var(--space-sm)', 
          borderRadius: 'var(--radius-md)', 
          backgroundColor: 'var(--color-inactive-bg)', 
          color: 'var(--color-text-muted)' 
        }}>
          <PauseCircle size={20} />
        </div>
      </div>
    </div>
  );
};