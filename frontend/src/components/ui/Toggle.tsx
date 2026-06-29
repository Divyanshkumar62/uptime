import React from 'react';

interface ToggleProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
}

export const Toggle = React.forwardRef<HTMLInputElement, ToggleProps>(
  ({ label, className = '', id, checked, onChange, disabled, ...props }, ref) => {
    const toggleId = id || `toggle-${Math.random().toString(36).substr(2, 9)}`;

    const wrapperStyle = {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 'var(--space-md)',
      cursor: disabled ? 'not-allowed' : 'pointer',
      userSelect: 'none' as const,
    };

    const labelStyle = {
      fontSize: 'var(--font-label-md)',
      fontWeight: 'var(--font-weight-medium)',
      fontFamily: 'var(--font-mono)',
      letterSpacing: '0.02em',
      color: disabled ? 'var(--color-text-muted)' : 'var(--color-text-secondary)',
      lineHeight: '1',
    };

    const containerStyle = {
      position: 'relative' as const,
      width: '40px',
      height: '24px',
      backgroundColor: checked ? 'var(--color-primary)' : 'var(--color-outline-variant)',
      borderRadius: 'var(--radius-full)',
      transition: 'background-color var(--duration-fast) var(--easing-standard)',
      opacity: disabled ? 0.6 : 1,
    };

    const thumbStyle = {
      position: 'absolute' as const,
      top: '2px',
      left: checked ? '18px' : '2px',
      width: '20px',
      height: '20px',
      backgroundColor: '#ffffff',
      borderRadius: 'var(--radius-full)',
      boxShadow: 'var(--shadow-low)',
      transition: 'left var(--duration-fast) var(--easing-standard)',
    };

    return (
      <label htmlFor={toggleId} style={wrapperStyle} className={className}>
        <div style={containerStyle} className="toggle-bg">
          <div style={thumbStyle} />
        </div>
        <input
          id={toggleId}
          type="checkbox"
          checked={checked}
          onChange={onChange}
          disabled={disabled}
          ref={ref}
          role="switch"
          aria-checked={checked}
          style={{
            position: 'absolute',
            width: '1px',
            height: '1px',
            padding: '0',
            margin: '-1px',
            overflow: 'hidden',
            clip: 'rect(0, 0, 0, 0)',
            whiteSpace: 'nowrap',
            border: '0',
          }}
          {...props}
        />
        {label && <span style={labelStyle}>{label}</span>}
      </label>
    );
  }
);

Toggle.displayName = 'Toggle';