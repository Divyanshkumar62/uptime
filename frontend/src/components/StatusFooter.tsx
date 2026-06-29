import React from 'react';
import { useSSEStore } from '../stores/useSSEStore';

export const StatusFooter: React.FC = () => {
  const sseStatus = useSSEStore((state) => state.status);

  const getSystemStatus = () => {
    if (sseStatus === 'connected') {
      return {
        text: 'All systems nominal',
        color: 'var(--color-success)',
        pulse: true
      };
    } else if (sseStatus === 'connecting') {
      return {
        text: 'Connecting to stream...',
        color: 'var(--color-warning)',
        pulse: true
      };
    } else {
      return {
        text: 'Connection disconnected',
        color: 'var(--color-destructive)',
        pulse: false
      };
    }
  };

  const { text, color, pulse } = getSystemStatus();

  return (
    <footer style={{
      borderTop: '1px solid var(--color-border)',
      backgroundColor: 'var(--color-bg-surface)',
      padding: 'var(--space-md) var(--space-xl)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      fontSize: '11px',
      fontFamily: 'var(--font-mono)',
      color: 'var(--color-text-muted)',
      marginTop: 'auto',
      flexShrink: 0,
      letterSpacing: '0.02em'
    }}>
      <div>
        <span>© {new Date().getFullYear()} MonitorPro Inc. System Operational.</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span className={pulse ? "pulse-dot" : ""} style={{
          width: '8px',
          height: '8px',
          backgroundColor: color,
          borderRadius: '50%',
          display: 'inline-block',
          boxShadow: pulse ? `0 0 8px ${color}` : 'none'
        }} />
        <span>{text}</span>
      </div>

      <div style={{ display: 'flex', gap: '12px' }}>
        <span>Version 4.2.0</span>
        <span style={{ color: 'var(--color-border)' }}>|</span>
        <a href="#" onClick={(e) => e.preventDefault()} style={{ color: 'inherit', textDecoration: 'none' }}>Documentation</a>
        <span style={{ color: 'var(--color-border)' }}>|</span>
        <a href="#" onClick={(e) => e.preventDefault()} style={{ color: 'inherit', textDecoration: 'none' }}>Privacy</a>
      </div>
    </footer>
  );
};