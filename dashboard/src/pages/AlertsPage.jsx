import React, { useState, useMemo, useRef } from 'react';
import { acknowledgeAlert } from '../services/alertService';
import AlertCard from '../components/AlertCard';
import VillageFilter from '../components/VillageFilter';
import StatsCard from '../components/StatsCard';
import EscalationPanel from '../components/EscalationPanel';

export default function AlertsPage({ alerts = [] }) {
  const [selectedVillage, setSelectedVillage] = useState('');
  const [selectedAlert, setSelectedAlert] = useState(null);

  // Derive villages from alerts
  const villages = useMemo(() =>
    [...new Set(alerts.map(a => a.village).filter(Boolean))].sort(),
    [alerts]
  );

  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef(null);

  // ── Step 1: Filter by village ──────────────────────────────────────────────
  const villageFiltered = selectedVillage
    ? alerts.filter(a => a.village === selectedVillage)
    : alerts;

  // ── Step 2: Filter by search query ─────────────────────────────────────────
  const searchFiltered = useMemo(() => {
    if (!searchQuery.trim()) return villageFiltered;
    const q = searchQuery.toLowerCase().trim();
    return villageFiltered.filter(a => {
      const name = (a.patient_name || '').toLowerCase();
      const village = (a.village || '').toLowerCase();
      const flags = Array.isArray(a.risk_flags)
        ? a.risk_flags.join(' ').toLowerCase()
        : (a.risk_flags || '').toLowerCase();
      return name.includes(q) || village.includes(q) || flags.includes(q);
    });
  }, [villageFiltered, searchQuery]);

  // ── Step 3: Sort by priority ────────────────────────────────────────────────
  // HIGH-RISK cases ALWAYS stay at the top, even after acknowledgement.
  // Only medium/low risk acknowledged alerts sink to the bottom.
  const RISK_PRIORITY = { high: 0, medium: 1, low: 2 };
  const filtered = useMemo(() => {
    return [...searchFiltered].sort((a, b) => {
      // Primary: sort by risk level (high → medium → low)
      const aPriority = RISK_PRIORITY[a.risk_level] ?? 3;
      const bPriority = RISK_PRIORITY[b.risk_level] ?? 3;
      if (aPriority !== bPriority) return aPriority - bPriority;

      // Secondary: for medium/low only, acked alerts sink down
      // High-risk alerts stay in position regardless of ack status
      if (a.risk_level !== 'high') {
        const aAcked = a.status === 'acknowledged' ? 1 : 0;
        const bAcked = b.status === 'acknowledged' ? 1 : 0;
        if (aAcked !== bAcked) return aAcked - bAcked;
      }

      // Tertiary: newest first
      const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
      const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
      return bTime - aTime;
    });
  }, [searchFiltered]);

  const highCount = filtered.filter(a => a.risk_level === 'high').length;
  const highSeenCount = filtered.filter(a => a.risk_level === 'high' && a.status === 'acknowledged').length;
  const medCount = filtered.filter(a => a.risk_level === 'medium' && a.status !== 'acknowledged').length;
  const ackedCount = filtered.filter(a => a.status === 'acknowledged').length;

  // Split into two sections
  const highRiskAlerts = useMemo(() =>
    filtered.filter(a => a.risk_level === 'high'),
    [filtered]
  );
  const otherAlerts = useMemo(() =>
    filtered.filter(a => a.risk_level !== 'high'),
    [filtered]
  );

  const handleAck = async (id) => {
    try { await acknowledgeAlert(id); } catch (err) { console.error('Ack failed:', err); }
  };

  return (
    <div style={{ animation: 'fadeIn 0.4s ease' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '28px', fontWeight: 800, color: 'var(--text-main)', margin: '0 0 8px 0', letterSpacing: '-0.02em' }}>Live Alerts</h2>
          <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '15px' }}>Monitor and respond to village health reports in real-time.</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '16px', marginBottom: '32px', flexWrap: 'wrap' }}>
        <StatsCard icon="🚨" value={highCount} label="High Risk Active" color="var(--danger-color)" />
        <StatsCard icon="⚠️" value={medCount} label="Medium Pending" color="var(--warning-color)" />
        <StatsCard icon="👁️" value={highSeenCount} label="High Risk — Seen" color="var(--success-color)" />
        <StatsCard icon="📋" value={filtered.length} label="Total Alerts" color="var(--primary-color)" />
      </div>

      <VillageFilter villages={villages} selected={selectedVillage} onChange={setSelectedVillage} />

      {/* ── Quick Search Bar ─────────────────────────────────────────────────── */}
      <div className="search-bar-container" style={{ marginBottom: '24px' }}>
        <div className="search-bar-wrapper">
          <svg className="search-bar-icon" width="18" height="18" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            ref={searchInputRef}
            id="alert-search-input"
            type="text"
            className="search-bar-input"
            placeholder="Search by patient name, village, or risk flag…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              className="search-bar-clear"
              onClick={() => { setSearchQuery(''); searchInputRef.current?.focus(); }}
              aria-label="Clear search"
            >
              ✕
            </button>
          )}
        </div>
        {searchQuery.trim() && (
          <span className="search-bar-result-count">
            {filtered.length} result{filtered.length !== 1 ? 's' : ''} found
          </span>
        )}
      </div>

      {/* Empty state */}
      {filtered.length === 0 && (
        <div style={{ 
          textAlign: 'center', padding: '80px 24px', 
          backgroundColor: 'var(--card-bg)', borderRadius: 'var(--radius-lg)',
          border: '1px dashed var(--border-color)' 
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.5 }}>📭</div>
          <div style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-main)' }}>No alerts found</div>
          <div style={{ fontSize: '15px', marginTop: '8px', color: 'var(--text-muted)' }}>
            {selectedVillage ? `No alerts for ${selectedVillage}.` : 'Alerts will appear here in real time when synced.'}
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '32px', alignItems: 'start' }}>
        {/* ═══════════════════════════════════════════════════════════════════
           SECTION 1: HIGH RISK PREGNANCIES — Always visible, never buried
           ═══════════════════════════════════════════════════════════════════ */}
        {highRiskAlerts.length > 0 && (
          <div>
            <div className="section-header danger">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '18px' }}>🔴</span>
                <div>
                  <h3 className="section-header-title">High Risk Pregnancies</h3>
                  <p className="section-header-desc">Active critical cases requiring continuous supervisor attention</p>
                </div>
              </div>
              <span className="section-count-badge danger">{highRiskAlerts.length}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {highRiskAlerts.map(a => (
                <AlertCard key={a.id} alert={a} onAcknowledge={handleAck} onViewPatient={() => setSelectedAlert(a)} />
              ))}
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
           SECTION 2: OTHER ALERTS — Medium / Low risk
           ═══════════════════════════════════════════════════════════════════ */}
        {otherAlerts.length > 0 && (
          <div>
            <div className="section-header default">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '18px' }}>📋</span>
                <div>
                  <h3 className="section-header-title">Other Alerts</h3>
                  <p className="section-header-desc">Medium and low risk cases for routine monitoring</p>
                </div>
              </div>
              <span className="section-count-badge default">{otherAlerts.length}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {otherAlerts.map(a => (
                <AlertCard key={a.id} alert={a} onAcknowledge={handleAck} onViewPatient={() => setSelectedAlert(a)} />
              ))}
            </div>
          </div>
        )}
      </div>

      {selectedAlert && (
        <EscalationPanel alert={selectedAlert} onClose={() => setSelectedAlert(null)} />
      )}
    </div>
  );
}
