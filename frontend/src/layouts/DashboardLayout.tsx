import React, { useEffect, useState } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../stores/useAuthStore';
import { useSSEStore } from '../stores/useSSEStore';
import { LogOut, Activity, Moon, Sun, Monitor, Settings, Search, AlertTriangle } from 'lucide-react';
import { Badge } from '../components/ui/Badge';
import { StatusFooter } from '../components/StatusFooter';
import { useSearchStore } from '../stores/useSearchStore';

export const DashboardLayout: React.FC = () => {
  const logout = useAuthStore((state) => state.logout);
  const sseStatus = useSSEStore((state) => state.status);
  const connectSSE = useSSEStore((state) => state.connect);
  const disconnectSSE = useSSEStore((state) => state.disconnect);
  const searchQuery = useSearchStore((state) => state.query);
  const setSearchQuery = useSearchStore((state) => state.setQuery);
  
  const navigate = useNavigate();
  const location = useLocation();

  // Theme management: 'dark' | 'light'
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const saved = localStorage.getItem('uptime_theme');
    if (saved === 'dark' || saved === 'light') return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  useEffect(() => {
    // Connect SSE on mount / login
    connectSSE();
    return () => {
      // Clean up SSE connection on unmount
      disconnectSSE();
    };
  }, [connectSSE, disconnectSSE]);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('uptime_theme', theme);
  }, [theme]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const getStatusBadge = () => {
    switch (sseStatus) {
      case 'connected':
        return <Badge variant="UP">Connected</Badge>;
      case 'connecting':
        return <Badge variant="warning">Connecting</Badge>;
      case 'disconnected':
      default:
        return <Badge variant="DOWN">Disconnected</Badge>;
    }
  };

  // Determine active route for nav highlighting
  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  return (
    <div className="dashboard-layout" style={{ minHeight: '100vh', display: 'flex' }}>
      {/* Sidebar Nav — Layer 1 surface */}
      <aside style={{
        width: '240px',
        backgroundColor: 'var(--color-bg-surface)',
        borderRight: '1px solid var(--color-border)',
        display: 'flex',
        flexDirection: 'column',
        padding: 'var(--space-lg)',
        flexShrink: 0,
        height: '100vh',
        position: 'sticky',
        top: 0
      }}>
        {/* Title / Logo */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 'var(--space-sm)', 
          marginBottom: 'var(--space-2xl)',
          padding: 'var(--space-xs) 0'
        }}>
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: 'var(--radius-lg)',
            backgroundColor: 'var(--color-bg-deep)',
            border: '1px solid var(--color-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--color-primary)',
          }}>
            <Activity size={20} />
          </div>
          <div>
            <h1 style={{ 
              fontSize: 'var(--font-size-lg)', 
              fontWeight: 'var(--font-weight-bold)',
              letterSpacing: '-0.01em',
              lineHeight: '1.2'
            }}>Uptime</h1>
            {/* <span style={{
              fontSize: '10px',
              fontFamily: 'var(--font-mono)',
              color: 'var(--color-text-muted)',
              letterSpacing: '0.05em',
              textTransform: 'uppercase'
            }}>Emerald Ops</span> */}
          </div>
        </div>

        {/* Navigation Links */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)', flexGrow: 1 }}>
          <Link
            to="/"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-md)',
              padding: 'var(--space-sm) var(--space-md)',
              borderRadius: 'var(--radius-md)',
              color: isActive('/') && !location.pathname.startsWith('/incidents') ? 'var(--color-primary)' : 'var(--color-text-secondary)',
              backgroundColor: isActive('/') && !location.pathname.startsWith('/incidents') ? 'var(--color-bg-deep)' : 'transparent',
              textDecoration: 'none',
              fontWeight: 'var(--font-weight-medium)',
              fontSize: 'var(--font-size-sm)',
              border: isActive('/') && !location.pathname.startsWith('/incidents') ? '1px solid var(--color-border)' : '1px solid transparent',
              transition: 'all var(--duration-fast) var(--easing-standard)'
            }}
          >
            <Monitor size={18} />
            <span>Dashboard</span>
          </Link>
          <Link
            to="/incidents"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-md)',
              padding: 'var(--space-sm) var(--space-md)',
              borderRadius: 'var(--radius-md)',
              color: isActive('/incidents') ? 'var(--color-primary)' : 'var(--color-text-secondary)',
              backgroundColor: isActive('/incidents') ? 'var(--color-bg-deep)' : 'transparent',
              textDecoration: 'none',
              fontWeight: 'var(--font-weight-medium)',
              fontSize: 'var(--font-size-sm)',
              border: isActive('/incidents') ? '1px solid var(--color-border)' : '1px solid transparent',
              transition: 'all var(--duration-fast) var(--easing-standard)'
            }}
          >
            <AlertTriangle size={18} />
            <span>Incidents</span>
          </Link>
          <Link
            to="/settings/integrations"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-md)',
              padding: 'var(--space-sm) var(--space-md)',
              borderRadius: 'var(--radius-md)',
              color: isActive('/settings') ? 'var(--color-primary)' : 'var(--color-text-secondary)',
              backgroundColor: isActive('/settings') ? 'var(--color-bg-deep)' : 'transparent',
              textDecoration: 'none',
              fontWeight: 'var(--font-weight-medium)',
              fontSize: 'var(--font-size-sm)',
              border: isActive('/settings') ? '1px solid var(--color-border)' : '1px solid transparent',
              transition: 'all var(--duration-fast) var(--easing-standard)'
            }}
          >
            <Settings size={18} />
            <span>Integrations</span>
          </Link>
        </nav>

        {/* Footer controls: theme toggle, logout */}
        <div style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          gap: 'var(--space-sm)', 
          paddingTop: 'var(--space-lg)', 
          borderTop: '1px solid var(--color-border)' 
        }}>
          {/* Theme switch */}
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="custom-btn"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              width: '100%',
              padding: 'var(--space-sm) var(--space-md)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)',
              backgroundColor: 'transparent',
              color: 'var(--color-text-secondary)',
              cursor: 'pointer',
              fontSize: 'var(--font-size-sm)',
              fontFamily: 'var(--font-sans)',
              transition: 'all var(--duration-fast) var(--easing-standard)'
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
              {theme === 'dark' ? <Moon size={16} /> : <Sun size={16} />}
              <span>{theme === 'dark' ? 'Dark Mode' : 'Light Mode'}</span>
            </span>
          </button>

          {/* Logout */}
          <button
            onClick={handleLogout}
            className="custom-btn"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-md)',
              width: '100%',
              padding: 'var(--space-sm) var(--space-md)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid transparent',
              backgroundColor: 'var(--color-destructive-bg)',
              color: 'var(--color-destructive)',
              cursor: 'pointer',
              fontSize: 'var(--font-size-sm)',
              fontWeight: 'var(--font-weight-medium)',
              fontFamily: 'var(--font-sans)',
              justifyContent: 'center',
              transition: 'all var(--duration-fast) var(--easing-standard)'
            }}
          >
            <LogOut size={16} />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main content body */}
      <main style={{ 
        flexGrow: 1, 
        display: 'flex', 
        flexDirection: 'column', 
        backgroundColor: 'var(--color-bg-base)', 
        overflowY: 'auto' 
      }}>
        {/* Top Header */}
        <header style={{
          height: '64px',
          backgroundColor: 'var(--color-bg-surface)',
          borderBottom: '1px solid var(--color-border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 var(--space-xl)',
          gap: 'var(--space-md)',
          flexShrink: 0
        }}>
          {/* Left spacer */}
          <div style={{ width: '320px' }} />

          {/* Global Search Input — Centred */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '320px', position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', color: 'var(--color-text-muted)' }} />
            <input
              type="text"
              placeholder="Search by URL..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px 8px 36px',
                backgroundColor: 'var(--color-bg-deep)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--color-text-primary)',
                fontSize: 'var(--font-size-sm)',
                fontFamily: 'var(--font-sans)',
                outline: 'none',
                transition: 'border-color var(--duration-fast) var(--easing-standard)'
              }}
              className="search-input"
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)', width: '320px', justifyContent: 'flex-end' }}>
            <span style={{ 
              fontSize: 'var(--font-label-md)', 
              fontFamily: 'var(--font-mono)',
              color: 'var(--color-text-muted)',
              letterSpacing: 'var(--font-label-md-ls)'
            }}>Live Stream:</span>
            {getStatusBadge()}
          </div>
        </header>

        {/* Viewport Outlet */}
        <div style={{ flexGrow: 1 }} className="content-viewport">
          <Outlet />
        </div>
        
        <StatusFooter />
      </main>
    </div>
  );
};