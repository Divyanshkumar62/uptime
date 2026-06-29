import React, { useState } from 'react';
import type { Endpoint } from '../hooks/useEndpoints';
import { useEndpoints } from '../hooks/useEndpoints';
import { MetricHeader } from '../features/monitors/components/MetricHeader';
import { FilterBar } from '../features/monitors/components/FilterBar';
import { MonitorRow } from '../features/monitors/components/MonitorRow';
import { EndpointFormModal } from '../features/monitors/components/EndpointFormModal';
import { Button } from '../components/ui/Button';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { useSearchStore } from '../stores/useSearchStore';
import { Plus } from 'lucide-react';

export const DashboardPage: React.FC = () => {
  const { endpoints, isLoading, error, deleteEndpoint } = useEndpoints();

  // Modal control states
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedEndpoint, setSelectedEndpoint] = useState<Endpoint | undefined>(undefined);

  // Custom Delete Modal states
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null);

  // Filters state (search query and tags filter are retrieved from global store)
  const { query: search, selectedTags } = useSearchStore();
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'UP' | 'DOWN' | 'PAUSED'>('ALL');

  // Calculate available tags across all endpoints (unconditional hook)
  const availableTags = React.useMemo(() => {
    if (!endpoints) return [];
    const tagsSet = new Set<string>();
    endpoints.forEach((ep) => {
      if (ep.tags && Array.isArray(ep.tags)) {
        ep.tags.forEach((tag) => tagsSet.add(tag));
      }
    });
    return Array.from(tagsSet).sort();
  }, [endpoints]);

  // Filter monitors list (memoized to prevent re-filtering on every keystroke)
  const filteredEndpoints = React.useMemo(() => {
    return (endpoints || []).filter((ep) => {
      const matchesSearch = ep.url.toLowerCase().includes(search.toLowerCase());
      
      let matchesStatus = true;
      if (statusFilter === 'UP') {
        matchesStatus = ep.is_active && ep.status === 'UP';
      } else if (statusFilter === 'DOWN') {
        matchesStatus = ep.is_active && ep.status === 'DOWN';
      } else if (statusFilter === 'PAUSED') {
        matchesStatus = !ep.is_active;
      }

      let matchesTags = true;
      if (selectedTags.length > 0) {
        matchesTags = selectedTags.every((t) => ep.tags && ep.tags.includes(t));
      }

      return matchesSearch && matchesStatus && matchesTags;
    });
  }, [endpoints, search, statusFilter, selectedTags]);

  if (error) {
    return (
      <div style={{
        padding: 'var(--space-2xl)',
        textAlign: 'center',
        backgroundColor: 'var(--color-bg-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-lg)'
      }}>
        <h3 style={{ color: 'var(--color-destructive)', marginBottom: 'var(--space-md)' }}>Failed to load endpoints</h3>
        <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
          Please check your administrator API key and refresh connection.
        </p>
      </div>
    );
  }

  // Calculate overview metrics
  const totalCount = endpoints?.length || 0;
  const activeMonitors = endpoints?.filter((e) => e.is_active) || [];
  const healthyCount = activeMonitors.filter((e) => e.status === 'UP').length;
  const outageCount = activeMonitors.filter((e) => e.status === 'DOWN').length;
  const pausedCount = totalCount - activeMonitors.length;

  const handleEdit = (endpoint: Endpoint) => {
    setSelectedEndpoint(endpoint);
    setModalOpen(true);
  };

  const handleAdd = () => {
    setSelectedEndpoint(undefined);
    setModalOpen(true);
  };

  const handleDelete = (id: number) => {
    setDeleteTargetId(id);
    setDeleteConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (deleteTargetId !== null) {
      try {
        await deleteEndpoint(deleteTargetId);
      } catch (err) {
        console.error('Failed to delete monitor:', err);
      } finally {
        setDeleteConfirmOpen(false);
        setDeleteTargetId(null);
      }
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xl)' }}>
      {/* Overview Header & Actions */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-md)' }}>
        <div>
          <h2 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 'var(--font-weight-bold)' }}>Monitored Services</h2>
          <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
            Real-time synthetic probing monitoring dashboard
          </p>
        </div>
        <Button variant="primary" onClick={handleAdd}>
          <Plus size={16} style={{ marginRight: '4px' }} />
          <span>Register Endpoint</span>
        </Button>
      </div>

      {/* Metric Cards Header */}
      <MetricHeader 
        totalCount={totalCount}
        healthyCount={healthyCount}
        outageCount={outageCount}
        pausedCount={pausedCount}
        maxLimit={50}
      />

      {/* Filter and Search Bar */}
      <FilterBar 
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        totalShown={filteredEndpoints.length}
        totalAll={totalCount}
        availableTags={availableTags}
      />

      {/* Monitored Rows Layout Stack */}
      {isLoading ? (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-md)'
        }}>
          {Array.from({ length: 3 }).map((_, idx) => (
            <div
              key={idx}
              style={{
                height: '110px',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-lg)',
                backgroundColor: 'var(--color-bg-surface)',
                animation: 'pulse 1.5s infinite ease-in-out'
              }}
            />
          ))}
        </div>
      ) : filteredEndpoints.length > 0 ? (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-md)'
        }}>
          {filteredEndpoints.map((ep) => (
            <MonitorRow
              key={ep.id}
              endpoint={ep}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ))}
        </div>
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
          <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 'var(--font-weight-medium)' }}>No monitors found</h3>
          <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', maxWidth: '300px' }}>
            No target health checks match the active search filter parameters.
          </p>
          {totalCount === 0 && (
            <Button variant="primary" onClick={handleAdd}>
              Register Your First Endpoint
            </Button>
          )}
        </div>
      )}

      {/* Endpoint creation / edit form Modal */}
      <EndpointFormModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        endpoint={selectedEndpoint}
      />

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={deleteConfirmOpen}
        title="Delete Monitor"
        message="Are you sure you want to delete this monitored endpoint? This will purge all associated ping metrics."
        confirmText="Delete"
        cancelText="Cancel"
        isDestructive={true}
        onConfirm={handleConfirmDelete}
        onCancel={() => {
          setDeleteConfirmOpen(false);
          setDeleteTargetId(null);
        }}
      />
    </div>
  );
};