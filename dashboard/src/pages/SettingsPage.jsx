import React, { useState, useEffect } from 'react';
import { getGovConfig, saveGovConfig } from '../services/govPushService';

/**
 * Settings page — Government Portal API Configuration.
 * Allows supervisor to input/store a government HMIS API key,
 * district ID, and view integration status.
 */
export default function SettingsPage() {
  const [config, setConfig] = useState({ apiKey: '', districtId: '', autoPush: false, lastPushAt: null, lastPushId: null });
  const [saved, setSaved] = useState(false);
  const [editMode, setEditMode] = useState(false);

  useEffect(() => {
    setConfig(getGovConfig());
  }, []);

  const handleSave = () => {
    saveGovConfig(config);
    setSaved(true);
    setEditMode(false);
    setTimeout(() => setSaved(false), 3000);
  };

  const isConfigured = !!(config.apiKey && config.apiKey.trim());

  return (
    <div style={{ animation: 'fadeIn 0.4s ease' }}>
      <div style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '28px', fontWeight: 800, color: 'var(--text-main)', margin: '0 0 8px 0', letterSpacing: '-0.02em' }}>
          Settings
        </h2>
        <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '15px' }}>
          Configure integrations and system preferences.
        </p>
      </div>

      {/* ── Government Portal Integration ───────────────────────────────────── */}
      <div className="settings-card">
        <div className="settings-card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div className="settings-card-icon" style={{ backgroundColor: '#EDE9FE' }}>
              <span>🏛️</span>
            </div>
            <div>
              <h3 className="settings-card-title">Government Health Portal</h3>
              <p className="settings-card-subtitle">MoHFW HMIS Integration for District Reporting</p>
            </div>
          </div>
          <div className={`settings-status-badge ${isConfigured ? 'configured' : 'not-configured'}`}>
            <span className="settings-status-dot" />
            {isConfigured ? 'Connected' : 'Not Configured'}
          </div>
        </div>

        <div className="settings-card-body">
          <div className="settings-field-group">
            <label className="settings-label">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
              Government API Key
            </label>
            <input
              id="gov-api-key-input"
              type={editMode ? 'text' : 'password'}
              className="settings-input"
              placeholder="Enter your HMIS API key…"
              value={config.apiKey}
              onChange={e => setConfig(prev => ({ ...prev, apiKey: e.target.value }))}
            />
            <span className="settings-field-hint">Issued by your District Health Office or NIC portal administrator.</span>
          </div>

          <div className="settings-field-group">
            <label className="settings-label">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
              District ID
            </label>
            <input
              id="gov-district-id-input"
              type="text"
              className="settings-input"
              placeholder="e.g., BR-SITA-001"
              value={config.districtId}
              onChange={e => setConfig(prev => ({ ...prev, districtId: e.target.value }))}
            />
            <span className="settings-field-hint">Your assigned district code for HMIS submissions.</span>
          </div>

          <div className="settings-toggle-row">
            <div>
              <div className="settings-label" style={{ marginBottom: '2px' }}>Auto-Push Monthly Reports</div>
              <span className="settings-field-hint">Automatically push HMIS data on the 1st of each month.</span>
            </div>
            <button
              className={`settings-toggle ${config.autoPush ? 'active' : ''}`}
              onClick={() => setConfig(prev => ({ ...prev, autoPush: !prev.autoPush }))}
              aria-label="Toggle auto-push"
            >
              <span className="settings-toggle-knob" />
            </button>
          </div>

          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginTop: '8px' }}>
            <button
              id="gov-save-btn"
              className="settings-save-btn"
              onClick={handleSave}
            >
              {saved ? '✅ Saved' : 'Save Configuration'}
            </button>
            <button
              className="settings-secondary-btn"
              onClick={() => setEditMode(!editMode)}
            >
              {editMode ? 'Hide Key' : 'Show Key'}
            </button>
          </div>
        </div>
      </div>

      {/* ── Integration Status ─────────────────────────────────────────────── */}
      <div className="settings-card" style={{ marginTop: '20px' }}>
        <div className="settings-card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div className="settings-card-icon" style={{ backgroundColor: '#DBEAFE' }}>
              <span>📡</span>
            </div>
            <div>
              <h3 className="settings-card-title">Integration Status</h3>
              <p className="settings-card-subtitle">Sync history and connection health</p>
            </div>
          </div>
        </div>

        <div className="settings-card-body">
          <div className="settings-status-grid">
            <div className="settings-status-item">
              <span className="settings-status-label">Portal Connection</span>
              <span className={`settings-status-value ${isConfigured ? 'text-success' : 'text-warning'}`}>
                {isConfigured ? '🟢 Ready' : '🟡 Awaiting Config'}
              </span>
            </div>
            <div className="settings-status-item">
              <span className="settings-status-label">Last Data Push</span>
              <span className="settings-status-value">
                {config.lastPushAt
                  ? new Date(config.lastPushAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
                  : '—  Never pushed'}
              </span>
            </div>
            <div className="settings-status-item">
              <span className="settings-status-label">Last Push Reference</span>
              <span className="settings-status-value" style={{ fontFamily: 'monospace', letterSpacing: '0.02em' }}>
                {config.lastPushId || '—'}
              </span>
            </div>
            <div className="settings-status-item">
              <span className="settings-status-label">Auto-Push</span>
              <span className={`settings-status-value ${config.autoPush ? 'text-success' : ''}`}>
                {config.autoPush ? '✅ Enabled' : 'Disabled'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── About Section ──────────────────────────────────────────────────── */}
      <div className="settings-card" style={{ marginTop: '20px' }}>
        <div className="settings-card-body" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ fontSize: '32px' }}>🏥</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text-main)', marginBottom: '4px' }}>
              PS-19 Village Health Dashboard v1.0
            </div>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
              Supervisor Portal for ASHA Worker Health Data Management. Built for SIH 2024 — Problem Statement PS-19.
              Compatible with MoHFW HMIS monthly reporting format.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
