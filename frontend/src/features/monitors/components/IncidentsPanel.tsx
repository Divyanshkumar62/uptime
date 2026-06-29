import React from 'react';
import { useIncidents } from '../../../hooks/useIncidents';
import { useEndpoints } from '../../../hooks/useEndpoints';
import { AlertTriangle, Clock } from 'lucide-react';

interface IncidentsPanelProps {
  limit?: number;
}

export const IncidentsPanel: React.FC<IncidentsPanelProps> = ({ limit = 50 }) => {
  const { incidents, isLoading: isIncidentsLoading, error: incidentsError } = useIncidents(limit);
  const { endpoints } = useEndpoints();

  // Helper to find endpoint URL
  const getEndpointUrl = (id: number): string => {
    if (!endpoints) return `Endpoint #${id}`;
    const ep = endpoints.find((e) => e.id === id);
    return ep ? ep.url : `Endpoint #${id}`;
  };

  // Format date helper (monospace layout: HH:MM:SS)
  const formatTime = (dateStr: string): string => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleTimeString(undefined, { hour12: false });
    } catch {
      return dateStr;
    }
  };

  const formatDate = (dateStr: string): string => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    } catch {
      return '';
    }
  };

  return (
    <div
      style={{
        width: '340px',
        backgroundColor: 'var(--color-bg-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-lg)',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        alignSelf: 'stretch',
        maxHeight: 'calc(100vh - 120px)',
        overflow: 'hidden',
      }}
    >
      {/* Panel Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-sm)',
          padding: 'var(--space-md) var(--space-lg)',
          borderBottom: '1px solid var(--color-border)',
          backgroundColor: 'var(--color-bg-deep)',
        }}
      >
        <AlertTriangle size={16} style={{ color: 'var(--color-destructive)' }} />
        <h3
          style={{
            fontSize: 'var(--font-size-sm)',
            fontWeight: 'var(--font-weight-bold)',
            margin: 0,
            fontFamily: 'var(--font-sans)',
            color: 'var(--color-text-primary)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          Incidents Feed
        </h3>
      </div>

      {/* Feed List Container */}
      <div
        style={{
          flexGrow: 1,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {isIncidentsLoading ? (
          <div style={{ padding: 'var(--space-lg)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
            <span style={{ fontSize: '12px', fontFamily: 'var(--font-mono)' }}>Loading incidents...</span>
          </div>
        ) : incidentsError ? (
          <div style={{ padding: 'var(--space-lg)', textAlign: 'center', color: 'var(--color-destructive)' }}>
            <span style={{ fontSize: '12px', fontFamily: 'var(--font-mono)' }}>Failed to load incidents feed.</span>
          </div>
        ) : incidents && incidents.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {incidents.map((incident) => {
              const url = getEndpointUrl(incident.endpoint_id);
              return (
                <div
                  key={incident.id}
                  className="incident-item"
                  style={{
                    padding: 'var(--space-md) var(--space-lg)',
                    borderBottom: '1px solid var(--color-border)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                    transition: 'background-color var(--duration-fast) var(--easing-standard)',
                    cursor: 'default',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    {/* Status Code Badge */}
                    <span
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '11px',
                        fontWeight: '700',
                        color: '#ffffff',
                        backgroundColor: 'var(--color-destructive)',
                        padding: '2px 6px',
                        borderRadius: 'var(--radius-md)',
                        lineHeight: '1',
                      }}
                    >
                      HTTP {incident.status_code || 'ERR'}
                    </span>

                    {/* Time Monospace Tag */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--color-text-muted)' }}>
                      <Clock size={10} />
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px' }}>
                        {formatDate(incident.checked_at)} {formatTime(incident.checked_at)}
                      </span>
                    </div>
                  </div>

                  {/* URL */}
                  <span
                    style={{
                      fontSize: '12px',
                      fontWeight: '600',
                      color: 'var(--color-text-primary)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      display: 'block',
                    }}
                    title={url}
                  >
                    {url}
                  </span>

                  {/* Latency info */}
                  <span
                    style={{
                      fontSize: '10px',
                      color: 'var(--color-text-muted)',
                      fontFamily: 'var(--font-mono)',
                    }}
                  >
                    Response time: {incident.response_time_ms}ms
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ padding: 'var(--space-xl) var(--space-lg)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
            <p style={{ fontSize: '12px', margin: 0 }}>No recent incidents detected.</p>
            <p style={{ fontSize: '10px', color: 'var(--color-text-muted)', marginTop: '4px' }}>All services are operational.</p>
          </div>
        )}
      </div>
    </div>
  );
};