import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../stores/useAuthStore';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Shield, Key, ArrowRight } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const [keyInput, setKeyInput] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const setApiKey = useAuthStore((state) => state.setApiKey);
  
  const navigate = useNavigate();
  const location = useLocation();

  // Route location state tracker to redirect back after login
  const from = (location.state as any)?.from?.pathname || '/';

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!keyInput.trim()) {
      setError('Admin API Key is required');
      return;
    }

    setLoading(true);
    
    // Simulate minor visual authentication checks
    setTimeout(() => {
      setApiKey(keyInput.trim());
      setLoading(false);
      navigate(from, { replace: true });
    }, 500);
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      backgroundColor: 'var(--color-bg-base)',
      padding: 'var(--space-xl)'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '420px',
        backgroundColor: 'var(--color-bg-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-xl)',
        boxShadow: 'var(--shadow-high)',
        padding: '40px',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-xl)'
      }}>
        {/* Header Title & Heartbeat Alert Icon */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-lg)' }}>
          {/* Icon Container with corner pulse dot */}
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: 'var(--radius-lg)',
            backgroundColor: 'var(--color-bg-deep)',
            border: '1px solid var(--color-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--color-primary)',
            position: 'relative',
            boxShadow: '0 0 15px rgba(78, 222, 163, 0.12)'
          }}>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="26"
              height="26"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--color-primary)"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 12h2.5l1.5-5 2.5 10 2-8 1.5 3h3.5" />
              <path d="M19 8v4" />
              <circle cx="19" cy="15.5" r="0.75" fill="var(--color-primary)" stroke="none" />
            </svg>
            
            {/* Glowing Corner Dot */}
            <div style={{
              position: 'absolute',
              bottom: '-3px',
              right: '-3px',
              width: '11px',
              height: '11px',
              backgroundColor: 'var(--color-success)',
              borderRadius: '50%',
              border: '2px solid var(--color-bg-surface)',
              boxShadow: '0 0 8px var(--color-success)',
            }} />
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-xs)' }}>
            <h2 style={{
              fontSize: '20px',
              fontWeight: '700',
              color: 'var(--color-text-primary)',
              letterSpacing: '-0.02em'
            }}>
              Sign In to Uptime
            </h2>
            <p style={{
              fontSize: '13px',
              color: 'var(--color-text-muted)',
              textAlign: 'center',
              lineHeight: '1.45',
              maxWidth: '320px',
              marginTop: '4px'
            }}>
              Enter your single-administrator API key to manage health probes and alert webhooks.
            </p>
          </div>
        </div>

        {/* Input Form */}
        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
          <Input
            id="admin-key"
            label="ADMINISTRATOR API KEY"
            labelStyle={{
              fontFamily: 'var(--font-mono)',
              letterSpacing: '0.05em'
            }}
            rightLabel={
              <span style={{
                fontFamily: 'var(--font-mono)',
                color: 'var(--color-primary)',
                fontSize: '10px',
                fontWeight: '700',
                letterSpacing: '0.05em'
              }}>
                ROOT_ACCESS
              </span>
            }
            type="password"
            placeholder="• • • • • • • • • • • • • • • •"
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
            error={error}
            rightIcon={<Key size={16} style={{ opacity: 0.6 }} />}
            style={{
              backgroundColor: 'var(--color-bg-deep)',
              borderColor: 'var(--color-border)',
              paddingTop: '10px',
              paddingBottom: '10px',
              fontFamily: 'var(--font-mono)'
            }}
          />

          <Button type="submit" variant="primary" style={{ width: '100%', marginTop: '4px' }} isLoading={loading}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '600' }}>
              <span>Authenticate</span>
              <ArrowRight size={16} />
            </span>
          </Button>
        </form>

        {/* Footer Details */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)', marginTop: 'var(--space-sm)' }}>
          {/* Divider line */}
          <div style={{ height: '1px', backgroundColor: 'var(--color-border)', width: '100%' }} />
          
          {/* Encrypted Session Label */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            color: 'var(--color-text-muted)',
            fontSize: '11px',
            fontFamily: 'var(--font-mono)'
          }}>
            <Shield size={13} style={{ color: 'var(--color-text-muted)', opacity: 0.8 }} />
            <span style={{ letterSpacing: '0.02em', opacity: 0.8 }}>End-to-end encrypted session</span>
          </div>

          {/* Version & Help Documentation */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '10px',
            color: 'var(--color-text-muted)',
            marginTop: '4px',
            opacity: 0.7,
            fontFamily: 'var(--font-mono)'
          }}>
            <span>VER: 4.2.0-STABLE</span>
            <a
              href="#"
              onClick={(e) => e.preventDefault()}
              style={{
                color: 'var(--color-text-muted)',
                textDecoration: 'none',
                cursor: 'pointer',
                fontFamily: 'var(--font-mono)'
              }}
              onMouseEnter={(e) => (e.currentTarget.style.textDecoration = 'underline')}
              onMouseLeave={(e) => (e.currentTarget.style.textDecoration = 'none')}
            >
              Help & Documentation
            </a>
          </div>
        </div>
      </div>

      {/* Exterior Status Footer */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '16px',
        marginTop: '24px',
        color: 'var(--color-text-muted)',
        fontSize: '11px',
        fontFamily: 'var(--font-mono)',
        letterSpacing: '0.05em'
      }}>
      </div>
    </div>
  );
};