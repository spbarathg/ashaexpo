import React, { useState, useEffect, useRef } from 'react';
import AlertsPage from './pages/AlertsPage';
import ReportsPage from './pages/ReportsPage';
import HeatmapPage from './pages/HeatmapPage';
import SettingsPage from './pages/SettingsPage';
import CommandStrip from './components/CommandStrip';
import { subscribeToAlerts } from './services/alertService';
import { playAlertSound } from './services/audioService';

// ── Error Boundary ──────────────────────────────────────────────────────────────
class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  componentDidCatch(error, info) { console.error('Dashboard error:', error, info); }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          minHeight: '100vh', gap: '16px', padding: '40px', textAlign: 'center',
          fontFamily: 'Inter, sans-serif', backgroundColor: '#F5F5F5',
        }}>
          <div style={{ fontSize: '48px' }}>⚠️</div>
          <h2 style={{ fontSize: '22px', fontWeight: 700, color: '#212121', margin: 0 }}>Something went wrong</h2>
          <p style={{ color: '#757575', maxWidth: '400px', lineHeight: 1.5 }}>
            {this.state.error?.message || 'An unexpected error occurred.'}
          </p>
          <button onClick={() => window.location.reload()} style={{
            padding: '10px 24px', borderRadius: '8px', border: 'none', cursor: 'pointer',
            backgroundColor: '#1B5E20', color: '#fff', fontWeight: 600, fontSize: '14px',
          }}>Reload Dashboard</button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ── App ─────────────────────────────────────────────────────────────────────────

function AppContent() {
  const [tab, setTab] = useState('alerts');

  // Single Firestore alert subscription — shared by AlertsPage & CommandStrip
  const [alerts, setAlerts] = useState([]);
  const isFirstLoad = useRef(true);

  useEffect(() => {
    const unsub = subscribeToAlerts((allAlerts, changes) => {
      setAlerts(allAlerts);
      // Play sound for new high-risk alerts (skip initial load)
      if (!isFirstLoad.current) {
        const added = changes.filter(c => c.type === 'added');
        const hasNewHigh = added.some(c => c.doc.data().risk_level === 'high');
        if (hasNewHigh) playAlertSound();
      }
      isFirstLoad.current = false;
    });
    return () => unsub();
  }, []);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <header style={{
        backgroundColor: 'var(--primary-color)', 
        padding: '0 32px',
        height: '72px',
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        position: 'sticky',
        top: 0,
        zIndex: 50,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ 
            backgroundColor: 'rgba(255,255,255,0.15)', 
            color: '#fff',
            width: '40px', height: '40px', borderRadius: 'var(--radius-md)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '20px'
          }}>
            🏥
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#fff', letterSpacing: '-0.01em' }}>
              Village Health Dashboard
            </h1>
            <p style={{ margin: 0, fontSize: '13px', color: 'rgba(255,255,255,0.8)', fontWeight: 500 }}>
              Supervisor Portal
            </p>
          </div>
        </div>
        
        <nav style={{ display: 'flex', gap: '8px', backgroundColor: 'rgba(0,0,0,0.15)', padding: '4px', borderRadius: 'var(--radius-lg)' }}>
          {[
            { id: 'alerts', label: 'Alerts', icon: '🔔' },
            { id: 'reports', label: 'Reports', icon: '📊' },
            { id: 'heatmap', label: 'Heatmap', icon: '🗺️' },
            { id: 'settings', label: 'Settings', icon: '⚙️' }
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              padding: '8px 20px', 
              borderRadius: 'var(--radius-md)', 
              border: 'none', 
              cursor: 'pointer',
              backgroundColor: tab === t.id ? '#fff' : 'transparent',
              color: tab === t.id ? 'var(--primary-color)' : 'rgba(255,255,255,0.9)',
              fontWeight: 600, 
              fontSize: '14px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: tab === t.id ? 'var(--shadow-sm)' : 'none',
              transition: 'all 0.2s ease'
            }}>
              <span>{t.icon}</span> {t.label}
            </button>
          ))}
        </nav>
      </header>

      <CommandStrip alerts={alerts} />

      {/* Content */}
      <main style={{ flex: 1, width: '100%', maxWidth: '1200px', margin: '0 auto', padding: '32px 24px' }}>
        {tab === 'alerts' ? <AlertsPage alerts={alerts} /> : tab === 'reports' ? <ReportsPage /> : tab === 'settings' ? <SettingsPage /> : <HeatmapPage />}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}
