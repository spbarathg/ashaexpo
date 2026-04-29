import React, { useState, useEffect } from 'react';
import { fetchReportData } from '../services/reportService';

/**
 * Relative time formatter — "3m ago", "2h ago", "1d ago"
 */
function relativeTime(isoStr) {
  if (!isoStr) return '—';
  const diff = Date.now() - new Date(isoStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

/**
 * Live district command intelligence strip.
 * Receives alerts from App.jsx (single subscription).
 * Bloomberg-terminal aesthetic: 34px, dark, monospaced chips.
 */
export default function CommandStrip({ alerts = [] }) {
  const [vaccOverdue, setVaccOverdue] = useState(0);

  // One-time vaccination data fetch
  useEffect(() => {
    fetchReportData().then(data => {
      setVaccOverdue(Math.max(0, (data.vaccinationsDue || 0) - (data.vaccinationsGiven || 0)));
    }).catch(() => {});
  }, []);

  const critCount = alerts.filter(a => a.risk_level === 'high' && a.status !== 'acknowledged').length;
  const syncCount = alerts.filter(a => a.status === 'sent' || a.status === 'pending').length;
  const escCount  = alerts.filter(a => a.risk_level === 'high' && !a.doctor_notified).length;
  const lastSync  = alerts.length > 0 ? relativeTime(alerts[0]?.created_at) : '—';

  const chips = [
    { icon: '🚨', value: critCount, label: 'CRIT',  color: '#EF4444', pulse: critCount > 0 },
    { icon: '📡', value: syncCount, label: 'SYNC',  color: '#3B82F6' },
    { icon: '🩺', value: escCount,  label: 'ESC',   color: '#F59E0B' },
    { icon: '💉', value: vaccOverdue,label: 'VACC',  color: '#8B5CF6' },
  ];

  return (
    <div className="command-strip">
      <div className="command-strip-inner">
        {chips.map((chip, i) => (
          <React.Fragment key={chip.label}>
            <div className="command-strip-chip">
              <span className="command-strip-icon">{chip.icon}</span>
              <span className="command-strip-value" style={{ color: chip.value > 0 ? chip.color : 'rgba(255,255,255,0.35)' }}>
                {chip.value}
              </span>
              {chip.pulse && <span className="command-strip-pulse" />}
              <span className="command-strip-label">{chip.label}</span>
            </div>
            {i < chips.length - 1 && <div className="command-strip-sep" />}
          </React.Fragment>
        ))}

        <div className="command-strip-sep" />

        <div className="command-strip-chip command-strip-sync">
          <span className="command-strip-icon">🕐</span>
          <span className="command-strip-value" style={{ color: 'rgba(255,255,255,0.6)' }}>{lastSync}</span>
          <span className="command-strip-label">SYNC</span>
        </div>
      </div>
    </div>
  );
}
