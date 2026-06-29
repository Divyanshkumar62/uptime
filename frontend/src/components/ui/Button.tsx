import React from 'react';
import { Spinner } from './Spinner';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', isLoading = false, children, className = '', disabled, style, ...props }, ref) => {
    
    // Inline CSS styling classes mapped to variables
    const baseStyle = {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 'var(--radius-md)',
      fontWeight: 'var(--font-weight-medium)',
      fontFamily: 'var(--font-sans)',
      transition: 'all var(--duration-fast) var(--easing-standard)',
      border: '1px solid transparent',
      cursor: 'pointer',
      outline: 'none',
      userSelect: 'none' as const,
      gap: 'var(--space-sm)',
    };

    const variantStyles = {
      primary: {
        backgroundColor: 'var(--color-primary)',
        color: 'var(--color-on-primary)',
        borderColor: 'transparent',
      },
      secondary: {
        backgroundColor: 'var(--color-bg-surface)',
        borderColor: 'var(--color-border)',
        color: 'var(--color-text-primary)',
      },
      danger: {
        backgroundColor: 'var(--color-destructive)',
        color: '#ffffff',
        borderColor: 'transparent',
      },
      ghost: {
        backgroundColor: 'transparent',
        color: 'var(--color-text-secondary)',
        borderColor: 'transparent',
      },
    };

    const sizeStyles = {
      sm: {
        padding: 'var(--space-xs) var(--space-md)',
        fontSize: 'var(--font-size-xs)',
        height: '32px',
      },
      md: {
        padding: 'var(--space-sm) var(--space-lg)',
        fontSize: 'var(--font-size-sm)',
        height: '40px',
      },
      lg: {
        padding: 'var(--space-md) var(--space-xl)',
        fontSize: 'var(--font-size-md)',
        height: '48px',
      },
    };

    const isInteractionDisabled = disabled || isLoading;

    return (
      <button
        ref={ref}
        disabled={isInteractionDisabled}
        className={`custom-btn ${className}`}
        style={{
          ...baseStyle,
          ...variantStyles[variant],
          ...sizeStyles[size],
          opacity: isInteractionDisabled ? 0.6 : 1,
          pointerEvents: isInteractionDisabled ? 'none' : 'auto',
          ...style,
        }}
        {...props}
      >
        {isLoading && <Spinner size="sm" variant={variant === 'primary' || variant === 'danger' ? 'white' : 'primary'} />}
        <span>{children}</span>
      </button>
    );
  }
);

Button.displayName = 'Button';