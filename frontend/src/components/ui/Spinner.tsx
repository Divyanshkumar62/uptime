import React from 'react';

interface SpinnerProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: 'sm' | 'md' | 'lg';
  variant?: 'primary' | 'white';
}

export const Spinner: React.FC<SpinnerProps> = ({
  size = 'md',
  variant = 'primary',
  className = '',
  ...props
}) => {
  const sizeStyles = {
    sm: { width: '16px', height: '16px', borderWidth: '2px' },
    md: { width: '24px', height: '24px', borderWidth: '2px' },
    lg: { width: '40px', height: '40px', borderWidth: '3px' },
  };

  const colorStyles = {
    primary: { borderTopColor: 'transparent', borderColor: 'var(--color-primary)' },
    white: { borderTopColor: 'transparent', borderColor: '#ffffff' },
  };

  return (
    <div
      role="status"
      aria-label="Loading"
      style={{
        display: 'inline-block',
        borderRadius: '50%',
        borderStyle: 'solid',
        animation: 'spin 0.6s linear infinite',
        ...sizeStyles[size],
        ...colorStyles[variant],
      }}
      className={className}
      {...props}
    >
      <span style={{
        position: 'absolute',
        width: '1px',
        height: '1px',
        padding: '0',
        margin: '-1px',
        overflow: 'hidden',
        clip: 'rect(0, 0, 0, 0)',
        whiteSpace: 'nowrap',
        border: '0',
      }}>Loading...</span>
    </div>
  );
};