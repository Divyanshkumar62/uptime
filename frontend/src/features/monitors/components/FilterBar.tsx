import React from 'react';
import { useSearchStore } from '../../../stores/useSearchStore';

interface FilterBarProps {
  statusFilter: 'ALL' | 'UP' | 'DOWN' | 'PAUSED';
  onStatusFilterChange: (filter: 'ALL' | 'UP' | 'DOWN' | 'PAUSED') => void;
  totalShown: number;
  totalAll: number;
  availableTags: string[];
}

export const FilterBar: React.FC<FilterBarProps> = ({
  statusFilter,
  onStatusFilterChange,
  totalShown,
  totalAll,
  availableTags
}) => {
  const { selectedTags, toggleTag, clearTags } = useSearchStore();

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-md)',
      backgroundColor: 'var(--color-bg-surface)',
      border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-lg)',
      padding: 'var(--space-md) var(--space-lg)'
    }}>
      {/* Toggles & Counter Group */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', flexWrap: 'wrap', gap: 'var(--space-md)' }}>
        {/* Counter Info */}
        <span style={{
          fontSize: '11px',
          color: 'var(--color-text-muted)',
          fontFamily: 'var(--font-mono)',
          letterSpacing: '0.02em'
        }}>
          Showing {totalShown} of {totalAll} monitors
        </span>

        {/* Tab Filters */}
        <div style={{ 
          display: 'flex', 
          border: '1px solid var(--color-border)', 
          borderRadius: 'var(--radius-md)', 
          padding: '2px', 
          backgroundColor: 'var(--color-bg-deep)' 
        }}>
          {(['ALL', 'UP', 'DOWN', 'PAUSED'] as const).map((filter) => {
            const isActive = statusFilter === filter;
            return (
              <button
                key={filter}
                onClick={() => onStatusFilterChange(filter)}
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
                  letterSpacing: '0.05em',
                  boxShadow: isActive ? '0 2px 4px rgba(0, 0, 0, 0.3)' : 'none',
                  transition: 'all var(--duration-fast) var(--easing-standard)'
                }}
              >
                {filter}
              </button>
            );
          })}
        </div>
      </div>

      {/* Horizontal tag filter selectors */}
      {availableTags.length > 0 && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-sm)',
          borderTop: '1px solid var(--color-border)',
          paddingTop: 'var(--space-md)',
          flexWrap: 'wrap'
        }}>
          <span style={{
            fontSize: '10px',
            color: 'var(--color-text-secondary)',
            fontFamily: 'var(--font-mono)',
            fontWeight: '700',
            letterSpacing: '0.05em',
            marginRight: 'var(--space-xs)'
          }}>
            FILTER BY TAGS:
          </span>
          {availableTags.map((tag) => {
            const isSelected = selectedTags.includes(tag);
            return (
              <button
                key={tag}
                onClick={() => toggleTag(tag)}
                style={{
                  border: `1px solid ${isSelected ? 'var(--color-primary)' : 'var(--color-border)'}`,
                  backgroundColor: isSelected ? 'var(--color-primary)' : 'var(--color-bg-base)',
                  color: isSelected ? 'var(--color-primary-text)' : 'var(--color-text-secondary)',
                  fontWeight: isSelected ? '700' : '400',
                  padding: '2px 8px',
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                  fontSize: '11px',
                  fontFamily: 'var(--font-mono)',
                  transition: 'all var(--duration-fast) var(--easing-standard)'
                }}
              >
                {tag}
              </button>
            );
          })}
          {selectedTags.length > 0 && (
            <button
              onClick={clearTags}
              style={{
                border: 'none',
                background: 'transparent',
                color: 'var(--color-destructive)',
                cursor: 'pointer',
                fontSize: '10px',
                fontFamily: 'var(--font-mono)',
                fontWeight: '600',
                padding: '2px 8px',
                textDecoration: 'underline'
              }}
            >
              CLEAR ALL
            </button>
          )}
        </div>
      )}
    </div>
  );
};