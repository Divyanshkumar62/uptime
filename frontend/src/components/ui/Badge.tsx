import React from 'react';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'UP' | 'DOWN' | 'INACTIVE' | 'warning' | 'info';
  solid?: boolean;
}

export const Badge: React.FC<BadgeProps> = ({ variant = 'info', solid = false, children, className = '', ...props }) => {
  const styles = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '2px 8px',
    borderRadius: 'var(--radius-full)',
    fontSize: 'var(--font-size-xs)',
    fontWeight: 'var(--font-weight-semibold)',
    lineHeight: '1',
    whiteSpace: 'nowrap' as const,
    fontFamily: 'var(--font-mono)',
    letterSpacing: '0.02em',
  };

  const variantStyles = {
    UP: {
      backgroundColor: 'var(--color-success-bg)',
      color: 'var(--color-success)',
    },
    DOWN: {
      backgroundColor: 'var(--color-destructive-bg)',
      color: 'var(--color-destructive)',
    },
    INACTIVE: {
      backgroundColor: 'var(--color-inactive-bg)',
      color: 'var(--color-inactive)',
    },
    warning: {
      backgroundColor: 'var(--color-warning-bg)',
      color: 'var(--color-warning)',
    },
    info: {
      backgroundColor: 'rgba(78, 222, 163, 0.1)',
      color: 'var(--color-primary)',
    },
  };

  const solidVariantStyles = {
    UP: {
      backgroundColor: 'var(--color-success)',
      color: 'var(--color-on-primary)',
      boxShadow: '0 0 12px rgba(78, 222, 163, 0.3)',
    },
    DOWN: {
      backgroundColor: 'var(--color-destructive)',
      color: '#ffffff',
    },
    INACTIVE: {
      backgroundColor: 'var(--color-inactive)',
      color: 'var(--color-bg-base)',
    },
    warning: {
      backgroundColor: 'var(--color-warning)',
      color: '#ffffff',
    },
    info: {
      backgroundColor: 'var(--color-primary)',
      color: 'var(--color-on-primary)',
    },
  };

  // Human-readable labels for screen readers
  const ariaLabel = `Status: ${variant === 'UP' ? 'Up / Healthy' : variant === 'DOWN' ? 'Down / Outage' : variant}`;

  return (
    <span
      role="status"
      aria-label={ariaLabel}
      style={{
        ...styles,
        ...(solid ? solidVariantStyles[variant] : variantStyles[variant]),
      }}
      className={className}
      {...props}
    >
      {children}
    </span>
  );
};