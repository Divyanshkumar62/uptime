import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  labelStyle?: React.CSSProperties;
  rightLabel?: React.ReactNode;
  rightIcon?: React.ReactNode;
  error?: string;
  helperText?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, labelStyle, rightLabel, rightIcon, error, helperText, className = '', id, style, ...props }, ref) => {
    const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`;

    const wrapperStyle = {
      display: 'flex',
      flexDirection: 'column' as const,
      gap: 'var(--space-xs)',
      width: '100%',
    };

    const labelContainerStyle = {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      width: '100%',
    };

    const defaultLabelStyle = {
      fontSize: 'var(--font-label-md)',
      fontWeight: 'var(--font-weight-medium)',
      color: 'var(--color-text-muted)',
      letterSpacing: 'var(--font-label-md-ls)',
      ...labelStyle,
    };

    const baseInputStyle = {
      width: '100%',
      padding: 'var(--space-sm) var(--space-md)',
      paddingRight: rightIcon ? '38px' : 'var(--space-md)',
      fontSize: 'var(--font-size-sm)',
      backgroundColor: 'var(--color-bg-deep)',
      color: 'var(--color-text-primary)',
      borderRadius: 'var(--radius-md)',
      border: `1px solid ${error ? 'var(--color-destructive)' : 'var(--color-border)'}`,
      outline: 'none',
      fontFamily: 'var(--font-sans)',
      transition: 'border-color var(--duration-fast) var(--easing-standard), box-shadow var(--duration-fast) var(--easing-standard)',
      ...style,
    };

    const errorStyle = {
      fontSize: 'var(--font-size-xs)',
      color: 'var(--color-destructive)',
      marginTop: '2px',
    };

    const helperStyle = {
      fontSize: 'var(--font-size-xs)',
      color: 'var(--color-text-muted)',
      marginTop: '2px',
    };

    return (
      <div style={wrapperStyle} className={className}>
        {(label || rightLabel) && (
          <div style={labelContainerStyle}>
            {label && (
              <label htmlFor={inputId} style={defaultLabelStyle}>
                {label}
              </label>
            )}
            {rightLabel}
          </div>
        )}
        <div style={{ position: 'relative', width: '100%' }}>
          <input
            id={inputId}
            ref={ref}
            style={baseInputStyle}
            className={`custom-input ${error ? 'input-error' : ''}`}
            aria-invalid={!!error}
            aria-describedby={error ? `${inputId}-error` : helperText ? `${inputId}-helper` : undefined}
            {...props}
          />
          {rightIcon && (
            <div style={{
              position: 'absolute',
              right: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--color-text-muted)',
              pointerEvents: 'none',
            }}>
              {rightIcon}
            </div>
          )}
        </div>
        {error && (
          <span id={`${inputId}-error`} role="alert" style={errorStyle}>
            {error}
          </span>
        )}
        {!error && helperText && (
          <span id={`${inputId}-helper`} style={helperStyle}>
            {helperText}
          </span>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';