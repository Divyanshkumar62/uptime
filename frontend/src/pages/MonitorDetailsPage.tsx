import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import useSWR from 'swr';
import type { Endpoint } from '../hooks/useEndpoints';
import { useLatency } from '../hooks/useLatency';
import { apiClient } from '../lib/api-client';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { LatencyChart } from '../features/monitors/components/LatencyChart';
import { ArrowLeft, Clock, Activity, ShieldAlert, Cpu, RefreshCw, Copy, Check } from 'lucide-react';

const fetcher = (url: string) => apiClient.get(url).then((res) => res.data);

export const MonitorDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const endpointId = Number(id);

  // Selected historic hours threshold state (default 24h)
  const [timeWindow, setTimeWindow] = useState<number>(24);
  const [copied, setCopied] = useState(false);

  // Fetch Endpoint details
  const { data: endpoint, error: endpointError, isLoading: endpointLoading, mutate: mutateEndpoint } = useSWR<Endpoint>(
    endpointId ? `/api/endpoints/${endpointId}` : null,
    fetcher
  );

  // Fetch latency history metrics (since hours = selected window)
  const { latencyData, isLoading: latencyLoading, mutateLatency } = useLatency(
    endpointId,
    timeWindow
  );

  // Hook into SSE window events to refresh metrics on status transitions
  useEffect(() => {
    const handleSSEUpdate = () => {
      mutateEndpoint();
      mutateLatency();
    };

    window.addEventListener('uptime-status-change', handleSSEUpdate);
    return () => {
      window.removeEventListener('uptime-status-change', handleSSEUpdate);
    };
  }, [mutateEndpoint, mutateLatency]);

  if (endpointError) {
    return (
      <div style={{ padding: 'var(--space-xl)', textAlign: 'center' }}>
        <h3 style={{ color: 'var(--color-destructive)' }}>Monitor not found</h3>
        <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-md)' }}>
          The requested monitored endpoint could not be loaded or was deleted.
        </p>
        <Link to="/">
          <Button variant="secondary">Back to Dashboard</Button>
        </Link>
      </div>
    );
  }

  const handleCopyUrl = () => {
    if (endpoint?.url) {
      navigator.clipboard.writeText(endpoint.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleForceRefresh = () => {
    mutateEndpoint();
    mutateLatency();
  };

  const getStatusBadge = (ep: Endpoint) => {
    if (!ep.is_active) {
      return <Badge variant="INACTIVE">Paused</Badge>;
    }
    return ep.status === 'UP' 
      ? <Badge variant="UP">Healthy</Badge> 
      : <Badge variant="DOWN">Outage</Badge>;
  };

  const timeOptions = [
    { label: 'Last 1 Hour', hours: 1 },
    { label: 'Last 6 Hours', hours: 6 },
    { label: 'Last 24 Hours', hours: 24 },
    { label: 'Last 7 Days', hours: 168 },
    { label: 'Last 30 Days', hours: 720 },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xl)' }}>
      {/* Header back navigation link */}
      <div>
        <Link to="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-xs)', textDecoration: 'none', marginBottom: 'var(--space-md)' }}>
          <ArrowLeft size={14} />
          <span>Back to monitors list</span>
        </Link>

        {endpointLoading || !endpoint ? (
          <div style={{ height: '40px', backgroundColor: 'var(--color-bg-surface)', animation: 'pulse 1.5s infinite ease-in-out', borderRadius: 'var(--radius-sm)' }} />
        ) : (
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--space-md)', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: endpoint.is_active 
                  ? (endpoint.status === 'UP' ? 'var(--color-success-bg)' : 'var(--color-destructive-bg)')
                  : 'var(--color-inactive-bg)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: endpoint.is_active 
                  ? (endpoint.status === 'UP' ? 'var(--color-success)' : 'var(--color-destructive)')
                  : 'var(--color-inactive)',
                flexShrink: 0
              }}>
                <Activity size={20} />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                  <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-bold)' }}>{endpoint.url}</h2>
                  <button onClick={handleCopyUrl} style={{ background: 'transparent', border: 'none', color: 'var(--color-text-secondary)', cursor: 'pointer', display: 'flex', padding: 2 }}>
                    {copied ? <Check size={14} color="var(--color-success)" /> : <Copy size={14} />}
                  </button>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)', marginTop: '4px' }}>
                  {getStatusBadge(endpoint)}
                  <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                    ID: {endpoint.id} • Registered {new Date(endpoint.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>

            <Button variant="secondary" onClick={handleForceRefresh} isLoading={endpointLoading || latencyLoading}>
              <RefreshCw size={14} style={{ marginRight: '4px' }} />
              <span>Refresh Telemetry</span>
            </Button>
          </div>
        )}
      </div>

      {/* Latency History Section */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-sm)' }}>
          <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 'var(--font-weight-semibold)' }}>Latency History Profile</h3>
          {/* Time window selector tabs */}
          <div style={{ display: 'flex', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '2px', backgroundColor: 'var(--color-bg-surface)' }}>
            {timeOptions.map((opt) => (
              <button
                key={opt.hours}
                onClick={() => setTimeWindow(opt.hours)}
                style={{
                  border: 'none',
                  backgroundColor: timeWindow === opt.hours ? 'var(--color-bg-base)' : 'transparent',
                  color: timeWindow === opt.hours ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                  fontWeight: timeWindow === opt.hours ? 'var(--font-weight-semibold)' : 'var(--font-weight-normal)',
                  padding: '4px var(--space-md)',
                  borderRadius: 'calc(var(--radius-md) - 2px)',
                  cursor: 'pointer',
                  fontSize: '11px',
                  fontFamily: 'var(--font-sans)',
                }}
              >
                {opt.hours === 1 ? '1h' : opt.hours === 6 ? '6h' : opt.hours === 24 ? '24h' : opt.hours === 168 ? '7d' : '30d'}
              </button>
            ))}
          </div>
        </div>

        {/* Latency statistics panels */}
        {latencyData && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 'var(--space-md)' }}>
            {/* p99 callout card */}
            <div style={{
              backgroundColor: 'var(--color-bg-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-lg)',
              padding: 'var(--space-lg)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              textAlign: 'center',
              gap: 'var(--space-sm)'
            }}>
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                p99 Latency Value
              </span>
              <span style={{ fontSize: '32px', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-primary)' }}>
                {latencyData.p99_latency_ms > 0 ? `${Math.round(latencyData.p99_latency_ms)}ms` : '--'}
              </span>
              <span style={{ fontSize: '10px', color: 'var(--color-text-secondary)' }}>
                Aggregated over selected {timeWindow}h window
              </span>
            </div>

            {/* Custom SVG line Chart */}
            <LatencyChart
              history={latencyData.history}
              p99LatencyMs={latencyData.p99_latency_ms}
            />
          </div>
        )}
      </section>

      {/* Grid configuration details and check log list */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-xl)' }}>
        {/* Configuration details */}
        {endpoint && (
          <section style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
            <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 'var(--font-weight-semibold)' }}>Monitor Configurations</h3>
            <div style={{
              backgroundColor: 'var(--color-bg-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-lg)',
              padding: 'var(--space-lg)',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-md)'
            }}>
              {/* Properties list */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
                <div>
                  <span style={{ fontSize: '10px', color: 'var(--color-text-secondary)', display: 'block' }}>Interval</span>
                  <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                    <Clock size={14} color="var(--color-primary)" />
                    {endpoint.interval_seconds} Seconds
                  </span>
                </div>
                <div>
                  <span style={{ fontSize: '10px', color: 'var(--color-text-secondary)', display: 'block' }}>Timeout limit</span>
                  <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                    <Clock size={14} color="var(--color-primary)" />
                    {endpoint.timeout_seconds} Seconds
                  </span>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)', paddingTop: 'var(--space-sm)', borderTop: '1px solid var(--color-border)' }}>
                <div>
                  <span style={{ fontSize: '10px', color: 'var(--color-text-secondary)', display: 'block' }}>Alert Suppression Threshold</span>
                  <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                    <ShieldAlert size={14} color="var(--color-warning)" />
                    {endpoint.consecutive_failure_threshold} consecutive fails
                  </span>
                </div>
                <div>
                  <span style={{ fontSize: '10px', color: 'var(--color-text-secondary)', display: 'block' }}>Jitter Ratio offset</span>
                  <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                    <Cpu size={14} color="var(--color-primary)" />
                    {endpoint.jitter_ratio * 100}% (delays skew)
                  </span>
                </div>
              </div>

              {/* JSON key assertions */}
              <div style={{ paddingTop: 'var(--space-sm)', borderTop: '1px solid var(--color-border)' }}>
                <span style={{ fontSize: '10px', color: 'var(--color-text-secondary)', display: 'block', marginBottom: 'var(--space-xs)' }}>
                  JSON Validation Assertions
                </span>
                {endpoint.json_validation_keys ? (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {JSON.parse(endpoint.json_validation_keys).map((key: string, idx: number) => (
                      <span
                        key={idx}
                        style={{
                          padding: '2px 8px',
                          borderRadius: 'var(--radius-sm)',
                          backgroundColor: 'var(--color-bg-base)',
                          fontSize: 'var(--font-size-xs)',
                          border: '1px solid var(--color-border)',
                          fontWeight: 'var(--font-weight-medium)'
                        }}
                      >
                        {key}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-inactive)' }}>
                    None configured (asserts HTTP 200 OK only)
                  </span>
                )}
              </div>
            </div>
          </section>
        )}

        {/* History log list */}
        <section style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
          <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 'var(--font-weight-semibold)' }}>Recent Polling Log</h3>
          <div style={{
            backgroundColor: 'var(--color-bg-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--space-md)',
            overflowY: 'auto',
            maxHeight: '260px',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-sm)'
          }}>
            {latencyLoading ? (
              <div style={{ textAlign: 'center', padding: 'var(--space-xl)', color: 'var(--color-text-secondary)' }}>Loading logs...</div>
            ) : latencyData && latencyData.history.length > 0 ? (
              latencyData.history.map((metric, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: 'var(--space-sm)',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: 'var(--color-bg-base)',
                    border: '1px solid var(--color-border)',
                    fontSize: 'var(--font-size-xs)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
                    <span style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      backgroundColor: metric.is_success ? 'var(--color-success)' : 'var(--color-destructive)',
                      flexShrink: 0
                    }} />
                    <span style={{ color: 'var(--color-text-primary)', fontWeight: 'var(--font-weight-medium)' }}>
                      {metric.is_success 
                        ? `Success (HTTP ${metric.status_code || 200})` 
                        : `Outage (HTTP ${metric.status_code || 'Err'})`}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-lg)', color: 'var(--color-text-secondary)' }}>
                    <span>{metric.is_success ? `${metric.response_time_ms}ms` : '--'}</span>
                    <span>{new Date(metric.checked_at).toLocaleTimeString()}</span>
                  </div>
                </div>
              ))
            ) : (
              <div style={{ textAlign: 'center', padding: 'var(--space-xl)', color: 'var(--color-inactive)', fontSize: 'var(--font-size-xs)' }}>
                No health check metrics recorded yet.
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};
