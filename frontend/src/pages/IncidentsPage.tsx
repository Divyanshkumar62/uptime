import React, { useMemo, useState } from 'react';
import { useIncidents } from '../hooks/useIncidents';
import { useEndpoints } from '../hooks/useEndpoints';
import { AlertTriangle, Clock, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';

type TimeRange = '1h' | '6h' | '24h' | '7d' | 'all';

const TIME_RANGES: { label: string; value: TimeRange }[] = [
  { label: 'Last 1hr', value: '1h' },
  { label: 'Last 6hr', value: '6h' },
  { label: 'Last 24hr', value: '24h' },
  { label: 'Last 7d', value: '7d' },
  { label: 'All Time', value: 'all' },
];

const ITEMS_PER_PAGE = 10;

const getTimeRangeMs = (range: TimeRange): number | null => {
  switch (range) {
    case '1h': return 60 * 60 * 1000;
    case '6h': return 6 * 60 * 60 * 1000;
    case '24h': return 24 * 60 * 60 * 1000;
    case '7d': return 7 * 24 * 60 * 60 * 1000;
    case 'all': return null;
  }
};

export const IncidentsPage: React.FC = () => {
  const { incidents, isLoading, error, refetch } = useIncidents(200);
  const { endpoints } = useEndpoints();
  const [timeRange, setTimeRange] = useState<TimeRange>('24h');
  const [currentPage, setCurrentPage] = useState(1);

  // Reset to page 1 when time range changes
  const handleTimeRangeChange = (range: TimeRange) => {
    setTimeRange(range);
    setCurrentPage(1);
  };

  // Helper to find endpoint URL
  const getEndpointUrl = (id: number): string => {
    if (!endpoints) return `Endpoint #${id}`;
    const ep = endpoints.find((e) => e.id === id);
    return ep ? ep.url : `Endpoint #${id}`;
  };

  // Format date helper
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
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return '';
    }
  };

  const formatRelative = (dateStr: string): string => {
    try {
      const now = Date.now();
      const d = new Date(dateStr).getTime();
      const diff = now - d;
      const mins = Math.floor(diff / 60000);
      if (mins < 1) return 'Just now';
      if (mins < 60) return `${mins}m ago`;
      const hrs = Math.floor(mins / 60);
      if (hrs < 24) return `${hrs}h ago`;
      const days = Math.floor(hrs / 24);
      return `${days}d ago`;
    } catch {
      return '';
    }
  };

  // Filter incidents by time range
  const filteredIncidents = useMemo(() => {
    if (!incidents) return [];
    const rangeMs = getTimeRangeMs(timeRange);
    if (rangeMs === null) return incidents;
    const cutoff = Date.now() - rangeMs;
    return incidents.filter((inc) => new Date(inc.checked_at).getTime() >= cutoff);
  }, [incidents, timeRange]);

  // Sort: latest first
  const sortedIncidents = useMemo(() => {
    return [...filteredIncidents].sort(
      (a, b) => new Date(b.checked_at).getTime() - new Date(a.checked_at).getTime()
    );
  }, [filteredIncidents]);

  // Pagination logic
  const totalPages = Math.max(1, Math.ceil(sortedIncidents.length / ITEMS_PER_PAGE));
  const paginatedIncidents = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return sortedIncidents.slice(start, start + ITEMS_PER_PAGE);
  }, [sortedIncidents, currentPage]);

  // Build page number array with ellipsis
  const getPageNumbers = (): (number | 'ellipsis')[] => {
    const pages: (number | 'ellipsis')[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push('ellipsis');
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (currentPage < totalPages - 2) pages.push('ellipsis');
      pages.push(totalPages);
    }
    return pages;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xl)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-md)' }}>
        <div>
          <h2 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 'var(--font-weight-bold)' }}>Incidents Feed</h2>
          <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
            Track all downtime events and response anomalies
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className="custom-btn"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-sm)',
            padding: 'var(--space-sm) var(--space-md)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-border)',
            backgroundColor: 'var(--color-bg-surface)',
            color: 'var(--color-text-secondary)',
            cursor: 'pointer',
            fontSize: 'var(--font-size-sm)',
            fontFamily: 'var(--font-sans)',
            transition: 'all var(--duration-fast) var(--easing-standard)'
          }}
        >
          <RefreshCw size={14} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Time Range Tabs */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-sm)',
        backgroundColor: 'var(--color-bg-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-lg)',
        padding: 'var(--space-sm) var(--space-md)',
        flexWrap: 'wrap',
      }}>
        <span style={{
          fontSize: '11px',
          fontFamily: 'var(--font-mono)',
          color: 'var(--color-text-muted)',
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
          marginRight: 'var(--space-sm)'
        }}>
          Time Range:
        </span>
        <div style={{ display: 'flex', gap: '2px', backgroundColor: 'var(--color-bg-deep)', borderRadius: 'var(--radius-md)', padding: '2px' }}>
          {TIME_RANGES.map(({ label, value }) => {
            const isActive = timeRange === value;
            return (
              <button
                key={value}
                onClick={() => handleTimeRangeChange(value)}
                style={{
                  border: 'none',
                  backgroundColor: isActive ? 'var(--color-primary)' : 'transparent',
                  color: isActive ? 'var(--color-on-primary)' : 'var(--color-text-muted)',
                  fontWeight: isActive ? '700' : '500',
                  padding: 'var(--space-xs) var(--space-md)',
                  borderRadius: 'calc(var(--radius-md) - 1px)',
                  cursor: 'pointer',
                  fontSize: '11px',
                  fontFamily: 'var(--font-mono)',
                  letterSpacing: '0.03em',
                  boxShadow: isActive ? '0 2px 4px rgba(0, 0, 0, 0.3)' : 'none',
                  transition: 'all var(--duration-fast) var(--easing-standard)',
                  whiteSpace: 'nowrap',
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
        <span style={{
          fontSize: '11px',
          fontFamily: 'var(--font-mono)',
          color: 'var(--color-text-muted)',
          marginLeft: 'auto',
        }}>
          {sortedIncidents.length} incident{sortedIncidents.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Incidents List */}
      {isLoading ? (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-md)'
        }}>
          {Array.from({ length: 5 }).map((_, idx) => (
            <div
              key={idx}
              style={{
                height: '80px',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-lg)',
                backgroundColor: 'var(--color-bg-surface)',
                animation: 'pulse 1.5s infinite ease-in-out'
              }}
            />
          ))}
        </div>
      ) : error ? (
        <div style={{
          padding: 'var(--space-2xl)',
          textAlign: 'center',
          backgroundColor: 'var(--color-bg-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)'
        }}>
          <h3 style={{ color: 'var(--color-destructive)', marginBottom: 'var(--space-md)' }}>Failed to load incidents</h3>
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
            Unable to fetch incident data. Please check your connection.
          </p>
        </div>
      ) : paginatedIncidents.length > 0 ? (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
            {paginatedIncidents.map((incident) => {
              const url = getEndpointUrl(incident.endpoint_id);
              return (
                <div
                  key={incident.id}
                  style={{
                    backgroundColor: 'var(--color-bg-surface)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-lg)',
                    padding: 'var(--space-md) var(--space-lg)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: 'var(--space-md)',
                    transition: 'border-color var(--duration-fast) var(--easing-standard)',
                  }}
                  className="incident-item"
                >
                  {/* Left: Status + URL */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)', flexGrow: 1, overflow: 'hidden' }}>
                    {/* Status icon */}
                    <div style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: 'var(--radius-lg)',
                      backgroundColor: 'var(--color-destructive-bg)',
                      border: '1px solid var(--color-border)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      color: 'var(--color-destructive)',
                    }}>
                      <AlertTriangle size={16} />
                    </div>

                    <div style={{ overflow: 'hidden' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', marginBottom: '2px' }}>
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
                            flexShrink: 0,
                          }}
                        >
                          HTTP {incident.status_code || 'ERR'}
                        </span>
                        <span style={{
                          fontSize: '10px',
                          color: 'var(--color-text-muted)',
                          fontFamily: 'var(--font-mono)',
                        }}>
                          {incident.response_time_ms}ms
                        </span>
                      </div>
                      <span
                        style={{
                          fontSize: '13px',
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
                    </div>
                  </div>

                  {/* Right: Timestamp */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px', flexShrink: 0 }}>
                    <span style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '11px',
                      color: 'var(--color-text-muted)',
                      letterSpacing: '0.02em',
                    }}>
                      {formatDate(incident.checked_at)}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Clock size={10} style={{ color: 'var(--color-text-muted)' }} />
                      <span style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '10px',
                        color: 'var(--color-text-muted)',
                      }}>
                        {formatTime(incident.checked_at)} ({formatRelative(incident.checked_at)})
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
              padding: 'var(--space-md) 0',
            }}>
              {/* Previous */}
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '36px',
                  height: '36px',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--color-bg-surface)',
                  color: currentPage === 1 ? 'var(--color-text-muted)' : 'var(--color-text-secondary)',
                  cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                  opacity: currentPage === 1 ? 0.5 : 1,
                  transition: 'all var(--duration-fast) var(--easing-standard)',
                }}
              >
                <ChevronLeft size={16} />
              </button>

              {/* Page numbers */}
              {getPageNumbers().map((page, idx) =>
                page === 'ellipsis' ? (
                  <span
                    key={`ellipsis-${idx}`}
                    style={{
                      width: '36px',
                      height: '36px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '12px',
                      fontFamily: 'var(--font-mono)',
                      color: 'var(--color-text-muted)',
                    }}
                  >
                    ...
                  </span>
                ) : (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '36px',
                      height: '36px',
                      border: currentPage === page ? '1px solid var(--color-primary)' : '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: currentPage === page ? 'var(--color-primary)' : 'var(--color-bg-surface)',
                      color: currentPage === page ? 'var(--color-on-primary)' : 'var(--color-text-secondary)',
                      fontWeight: currentPage === page ? '700' : '500',
                      fontSize: '12px',
                      fontFamily: 'var(--font-mono)',
                      cursor: 'pointer',
                      transition: 'all var(--duration-fast) var(--easing-standard)',
                    }}
                  >
                    {page}
                  </button>
                )
              )}

              {/* Next */}
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '36px',
                  height: '36px',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--color-bg-surface)',
                  color: currentPage === totalPages ? 'var(--color-text-muted)' : 'var(--color-text-secondary)',
                  cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                  opacity: currentPage === totalPages ? 0.5 : 1,
                  transition: 'all var(--duration-fast) var(--easing-standard)',
                }}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </>
      ) : (
        <div style={{
          padding: 'var(--space-3xl) var(--space-xl)',
          textAlign: 'center',
          border: '1px dashed var(--color-border)',
          borderRadius: 'var(--radius-lg)',
          backgroundColor: 'var(--color-bg-surface)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 'var(--space-md)'
        }}>
          <AlertTriangle size={32} style={{ color: 'var(--color-success)', opacity: 0.5 }} />
          <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 'var(--font-weight-medium)' }}>No incidents found</h3>
          <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', maxWidth: '300px' }}>
            {timeRange === 'all'
              ? 'No incidents have been recorded. All services are operational.'
              : 'No incidents in this time range. Try expanding the time window.'}
          </p>
        </div>
      )}
    </div>
  );
};