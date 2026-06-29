import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import type { Endpoint } from '../../../hooks/useEndpoints';
import { useEndpoints } from '../../../hooks/useEndpoints';
import { useLatency } from '../../../hooks/useLatency';
import { Badge } from '../../../components/ui/Badge';
import { Toggle } from '../../../components/ui/Toggle';
import { Button } from '../../../components/ui/Button';
import { LatencySparkline } from './LatencySparkline';
import { Edit2, Trash2, Globe, CloudOff, PauseCircle, Zap, Clock, ArrowRight } from 'lucide-react';

interface MonitorRowProps {
  endpoint: Endpoint;
  onEdit: (endpoint: Endpoint) => void;
  onDelete: (id: number) => void;
}

export const MonitorRow: React.FC<MonitorRowProps> = ({ endpoint, onEdit, onDelete }) => {
  const { toggleActive } = useEndpoints();
  
  // Load mini historical latency trend (last 1 hour) to feed sparkline
  const { latencyData, mutateLatency } = useLatency(endpoint.id, 1);

  // Trigger SWR metric updates on status changes
  useEffect(() => {
    mutateLatency();
  }, [endpoint.status, endpoint.is_active, mutateLatency]);

  const handleToggle = async () => {
    try {
      await toggleActive(endpoint.id, endpoint.is_active);
    } catch (err) {
      console.error('Failed to toggle monitor status:', err);
    }
  };

  const getStatusConfig = () => {
    if (!endpoint.is_active) {
      return {
        badge: <Badge variant="INACTIVE" solid>Paused</Badge>,
        icon: <PauseCircle size={18} style={{ color: 'var(--color-text-muted)' }} />,
        color: 'var(--color-text-muted)'
      };
    }
    if (endpoint.status === 'UP') {
      return {
        badge: <Badge variant="UP" solid>Healthy</Badge>,
        icon: <Globe size={18} style={{ color: 'var(--color-success)' }} />,
        color: 'var(--color-success)'
      };
    } else {
      return {
        badge: <Badge variant="DOWN" solid>Outage</Badge>,
        icon: <CloudOff size={18} style={{ color: 'var(--color-destructive)' }} />,
        color: 'var(--color-destructive)'
      };
    }
  };

  const { badge, icon, color } = getStatusConfig();

  return (
    <div 
      style={{
        backgroundColor: 'var(--color-bg-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-lg)',
        padding: 'var(--space-lg)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-md)',
        transition: 'border-color var(--duration-fast) var(--easing-standard), box-shadow var(--duration-fast) var(--easing-standard)',
        opacity: endpoint.is_active ? 1 : 0.75,
        width: '100%'
      }} 
      className="monitor-row"
    >
      {/* Top Flex Grid Row */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 'var(--space-md)',
        width: '100%'
      }}>
        {/* Left Side Info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)', flexGrow: 1, overflow: 'hidden' }}>
          {/* Status Icon container */}
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: 'var(--radius-lg)',
            backgroundColor: 'var(--color-bg-deep)',
            border: '1px solid var(--color-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            {icon}
          </div>
          
          <div style={{ overflow: 'hidden' }}>
            <h3 style={{
              fontSize: '15px',
              fontWeight: '600',
              color: 'var(--color-text-primary)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              margin: 0
            }} title={endpoint.url}>
              {endpoint.url}
            </h3>
            
            {/* Monospace telemetry metadata */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
              marginTop: '4px',
              fontSize: '11px',
              fontFamily: 'var(--font-mono)',
              color: 'var(--color-text-muted)',
              letterSpacing: '0.02em'
            }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Clock size={12} />
                <span>Checked every {endpoint.interval_seconds}s</span>
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Zap size={12} style={{ color }} />
                <span>P99 LATENCY: {endpoint.is_active && latencyData && latencyData.p99_latency_ms > 0 
                  ? `${Math.round(latencyData.p99_latency_ms)}ms` 
                  : '--'}</span>
              </span>
            </div>
          </div>
        </div>

        {/* Center Sparkline */}
        <div style={{ display: 'flex', alignItems: 'center', flexGrow: 0, minWidth: '120px' }}>
          {endpoint.is_active && latencyData && (
            <LatencySparkline history={latencyData.history} />
          )}
        </div>

        {/* Right Status badge */}
        <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
          {badge}
        </div>
      </div>

      {/* Bottom Actions Row */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: 'var(--space-md)',
        borderTop: '1px solid var(--color-border)',
        marginTop: '2px'
      }}>
        {/* Toggle Switch */}
        <Toggle
          checked={endpoint.is_active}
          onChange={handleToggle}
          label="Active"
        />

        {/* Buttons Group */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
          {/* Edit Button */}
          <Button variant="ghost" size="sm" onClick={() => onEdit(endpoint)} aria-label="Edit Monitor">
            <Edit2 size={14} />
          </Button>

          {/* Delete Button */}
          <Button variant="ghost" size="sm" onClick={() => onDelete(endpoint.id)} aria-label="Delete Monitor" style={{ color: 'var(--color-destructive)' }}>
            <Trash2 size={14} />
          </Button>

          {/* View Details */}
          <Link to={`/monitors/${endpoint.id}`} style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>
            <Button variant="secondary" size="sm">
              <span>Details</span>
              <ArrowRight size={14} style={{ marginLeft: '4px' }} />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
};