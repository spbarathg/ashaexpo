import React, { useState, useEffect } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/firebase';
import { acknowledgeAlert } from '../services/alertService';
import { generateEscalationSummary } from '../utils/escalationSummary';
import RiskBadge from './RiskBadge';

/**
 * Unified alert detail panel with Medical Escalation Timeline.
 *
 * Replaces the old 3-button system with a progressive, multi-step
 * clinical follow-up workflow:
 *   1. Case Reviewed (supervisor confirms they've read the case)
 *   2. Doctor Consulted (doctor name + consult note)
 *   3. Follow-Up Scheduled (date + type)
 *   4. Referral Initiated (facility + reason — high-risk only)
 */
export default function EscalationPanel({ alert, onClose }) {
  const [saving, setSaving] = useState('');

  // Timeline step state
  const [reviewed, setReviewed] = useState(false);
  const [doctorData, setDoctorData] = useState({ name: '', note: '', done: false });
  const [followupData, setFollowupData] = useState({ date: '', type: '', done: false });
  const [referralData, setReferralData] = useState({ facility: '', reason: '', done: false });

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = 'unset'; };
  }, []);

  // Hydrate from existing alert data when alert changes
  useEffect(() => {
    if (!alert) return;
    setReviewed(alert.status === 'acknowledged' || !!alert.acknowledged_at);
    setDoctorData({
      name: alert.doctor_name || '',
      note: alert.doctor_consult_note || '',
      done: !!alert.doctor_consulted_at,
    });
    setFollowupData({
      date: alert.followup_date || '',
      type: alert.followup_type || '',
      done: !!alert.followup_date,
    });
    setReferralData({
      facility: alert.referred_to || '',
      reason: alert.referral_reason || '',
      done: alert.status === 'referred' || !!alert.referred_at,
    });
  }, [alert?.id]);

  if (!alert) return null;

  const isHigh = alert.risk_level === 'high';
  const isMedium = alert.risk_level === 'medium';
  const escalation = generateEscalationSummary(alert);

  // Parse risk flags
  const flags = Array.isArray(alert.risk_flags)
    ? alert.risk_flags
    : (() => { try { return JSON.parse(alert.risk_flags || '[]'); } catch { return []; } })();

  // --- Step Handlers ---
  const handleReview = async () => {
    setSaving('review');
    try {
      await acknowledgeAlert(alert.id);
      setReviewed(true);
    } catch (e) { console.error('Review failed:', e); }
    setSaving('');
  };

  const handleDoctorSubmit = async () => {
    if (!doctorData.name.trim()) return;
    setSaving('doctor');
    try {
      await updateDoc(doc(db, 'alerts', alert.id), {
        doctor_name: doctorData.name.trim(),
        doctor_consult_note: doctorData.note.trim(),
        doctor_consulted_at: new Date().toISOString(),
        doctor_notified: true,
        doctor_notified_at: new Date().toISOString(),
      });
      setDoctorData(prev => ({ ...prev, done: true }));
    } catch (e) { console.error('Doctor consult failed:', e); }
    setSaving('');
  };

  const handleFollowupSubmit = async () => {
    if (!followupData.date || !followupData.type) return;
    setSaving('followup');
    try {
      await updateDoc(doc(db, 'alerts', alert.id), {
        followup_date: followupData.date,
        followup_type: followupData.type,
      });
      setFollowupData(prev => ({ ...prev, done: true }));
    } catch (e) { console.error('Follow-up failed:', e); }
    setSaving('');
  };

  const handleReferralSubmit = async () => {
    if (!referralData.facility.trim()) return;
    setSaving('referral');
    try {
      await updateDoc(doc(db, 'alerts', alert.id), {
        status: 'referred',
        referred_to: referralData.facility.trim(),
        referral_reason: referralData.reason.trim(),
        referred_at: new Date().toISOString(),
      });
      setReferralData(prev => ({ ...prev, done: true }));
    } catch (e) { console.error('Referral failed:', e); }
    setSaving('');
  };

  // Mode styling
  const accentColor = isHigh ? 'var(--danger-color)' : 'var(--primary-color)';
  const headerBg = isHigh ? '#FEF2F2' : '#F0FFF4';
  const modeTitle = isHigh ? '⚕️ Medical Escalation' : '📋 Patient Review';
  const modeSubtitle = isHigh ? 'Clinical assessment generated from risk flags' : 'Observation summary for monitoring';

  // Urgency badge styling
  const urgencyColors = {
    CRITICAL: { bg: '#FEE2E2', color: '#DC2626', border: '#FECACA' },
    URGENT:   { bg: '#FEF3C7', color: '#D97706', border: '#FDE68A' },
    ELEVATED: { bg: '#FEF9C3', color: '#CA8A04', border: '#FEF08A' },
    MONITOR:  { bg: '#DCFCE7', color: '#16A34A', border: '#BBF7D0' },
  };
  const uBadge = urgencyColors[escalation.urgency] || urgencyColors.MONITOR;

  // Build timeline steps
  const steps = [
    {
      id: 'review',
      label: 'Case Reviewed',
      desc: 'Supervisor confirms clinical review of the case',
      done: reviewed,
      active: !reviewed,
    },
    {
      id: 'doctor',
      label: 'Doctor Consulted',
      desc: 'Medical consultation details',
      done: doctorData.done,
      active: reviewed && !doctorData.done,
    },
    {
      id: 'followup',
      label: 'Follow-Up Scheduled',
      desc: 'Next clinical contact planned',
      done: followupData.done,
      active: reviewed && doctorData.done && !followupData.done,
    },
  ];

  // Add referral step only for high-risk
  if (isHigh) {
    steps.push({
      id: 'referral',
      label: 'Referral Initiated',
      desc: 'Facility referral for specialist care',
      done: referralData.done,
      active: reviewed && doctorData.done && followupData.done && !referralData.done,
    });
  }

  return (
    <>
      {/* Backdrop */}
      <div className="escalation-backdrop" onClick={onClose} />

      {/* Panel */}
      <div className="escalation-panel">
        {/* Header */}
        <div className="escalation-header" style={{ backgroundColor: headerBg, borderLeft: `4px solid ${accentColor}` }}>
          <div>
            <div className="escalation-header-title" style={{ color: accentColor }}>{modeTitle}</div>
            <div className="escalation-header-sub">{modeSubtitle}</div>
          </div>
          <button onClick={onClose} className="escalation-close" aria-label="Close panel">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        {/* Scrollable content */}
        <div className="escalation-content">

          {/* Patient Identity */}
          <div className="escalation-section">
            <div className="escalation-patient-name">{alert.patient_name || 'Unknown Patient'}</div>
            <div className="escalation-patient-meta">
              <span>📍 {alert.village || 'N/A'}</span>
              {alert.asha_phone && <span>📞 {alert.asha_phone}</span>}
            </div>
            <div style={{ marginTop: '10px' }}>
              <RiskBadge level={alert.risk_level} />
            </div>
          </div>

          {/* Risk Flags */}
          {flags.length > 0 && (
            <div className="escalation-section">
              <div className="escalation-section-label">Risk Flags</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {flags.map((f, i) => (
                  <span key={i} className="escalation-flag-tag">
                    {typeof f === 'string' ? f.replace(/_/g, ' ') : f}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* AI Clinical Assessment */}
          <div className="escalation-section">
            <div className="escalation-section-label">
              {isHigh ? 'AI Clinical Assessment' : 'Observation Summary'}
            </div>
            <div className="escalation-ai-card">
              <div className="escalation-ai-text">{escalation.summary}</div>
            </div>
          </div>

          {/* Urgency Badge */}
          <div className="escalation-section">
            <div className="escalation-section-label">Urgency Classification</div>
            <div className="escalation-urgency" style={{
              backgroundColor: uBadge.bg, color: uBadge.color, border: `1px solid ${uBadge.border}`
            }}>
              <span className="escalation-urgency-dot" style={{ backgroundColor: uBadge.color }} />
              {escalation.urgency}
            </div>
          </div>

          {/* Recommendation */}
          {(isHigh || isMedium) && (
            <div className="escalation-section">
              <div className="escalation-section-label">Recommendation</div>
              <div className="escalation-rec-text">{escalation.recommendation}</div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════════
             MEDICAL ESCALATION TIMELINE
             ═══════════════════════════════════════════════════════════════════ */}
          <div className="escalation-section">
            <div className="escalation-section-label">Medical Follow-Up Pipeline</div>
            <div className="timeline">
              {steps.map((step, idx) => {
                const isLast = idx === steps.length - 1;
                const isLocked = !step.done && !step.active;

                return (
                  <div key={step.id} className={`timeline-step ${step.done ? 'done' : ''} ${step.active ? 'active' : ''} ${isLocked ? 'locked' : ''}`}>
                    {/* Connector line */}
                    {!isLast && <div className="timeline-connector" />}

                    {/* Step indicator dot */}
                    <div className="timeline-dot">
                      {step.done ? (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                      ) : step.active ? (
                        <span className="timeline-dot-pulse" />
                      ) : (
                        <span className="timeline-dot-locked" />
                      )}
                    </div>

                    {/* Step content */}
                    <div className="timeline-body">
                      <div className="timeline-step-header">
                        <span className="timeline-step-label">{step.label}</span>
                        {step.done && <span className="timeline-done-tag">Completed</span>}
                        {isLocked && <span className="timeline-locked-tag">Pending</span>}
                      </div>
                      <div className="timeline-step-desc">{step.desc}</div>

                      {/* ── Step 1: Case Review ─────────────────────────── */}
                      {step.id === 'review' && step.active && (
                        <div className="timeline-form">
                          <button
                            className="timeline-action-btn primary"
                            onClick={handleReview}
                            disabled={saving === 'review'}
                          >
                            {saving === 'review' ? 'Saving…' : '✅ Confirm Case Reviewed'}
                          </button>
                        </div>
                      )}
                      {step.id === 'review' && step.done && (
                        <div className="timeline-completed-summary">
                          Reviewed {alert.acknowledged_at ? `on ${new Date(alert.acknowledged_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}` : ''}
                        </div>
                      )}

                      {/* ── Step 2: Doctor Consultation ──────────────────── */}
                      {step.id === 'doctor' && step.active && (
                        <div className="timeline-form">
                          <div className="timeline-field">
                            <label>Doctor Name *</label>
                            <input
                              type="text"
                              placeholder="e.g., Dr. Sharma"
                              value={doctorData.name}
                              onChange={e => setDoctorData(prev => ({ ...prev, name: e.target.value }))}
                            />
                          </div>
                          <div className="timeline-field">
                            <label>Consultation Outcome</label>
                            <textarea
                              placeholder="Brief medical advice / outcome of consultation…"
                              rows={3}
                              value={doctorData.note}
                              onChange={e => setDoctorData(prev => ({ ...prev, note: e.target.value }))}
                            />
                          </div>
                          <button
                            className="timeline-action-btn primary"
                            onClick={handleDoctorSubmit}
                            disabled={!doctorData.name.trim() || saving === 'doctor'}
                          >
                            {saving === 'doctor' ? 'Saving…' : '📞 Record Consultation'}
                          </button>
                        </div>
                      )}
                      {step.id === 'doctor' && step.done && (
                        <div className="timeline-completed-summary">
                          <strong>{doctorData.name || alert.doctor_name}</strong>
                          {(doctorData.note || alert.doctor_consult_note) && (
                            <span> — {doctorData.note || alert.doctor_consult_note}</span>
                          )}
                        </div>
                      )}

                      {/* ── Step 3: Follow-Up Scheduling ─────────────────── */}
                      {step.id === 'followup' && step.active && (
                        <div className="timeline-form">
                          <div className="timeline-field">
                            <label>Follow-Up Date *</label>
                            <input
                              type="date"
                              value={followupData.date}
                              onChange={e => setFollowupData(prev => ({ ...prev, date: e.target.value }))}
                            />
                          </div>
                          <div className="timeline-field">
                            <label>Follow-Up Type *</label>
                            <select
                              value={followupData.type}
                              onChange={e => setFollowupData(prev => ({ ...prev, type: e.target.value }))}
                            >
                              <option value="">Select type…</option>
                              <option value="Home Visit">Home Visit (ASHA)</option>
                              <option value="PHC Visit">PHC / Sub-Centre Visit</option>
                              <option value="Phone Check-in">Phone Check-in</option>
                              <option value="Hospital OPD">Hospital OPD</option>
                            </select>
                          </div>
                          <button
                            className="timeline-action-btn primary"
                            onClick={handleFollowupSubmit}
                            disabled={!followupData.date || !followupData.type || saving === 'followup'}
                          >
                            {saving === 'followup' ? 'Saving…' : '📅 Schedule Follow-Up'}
                          </button>
                        </div>
                      )}
                      {step.id === 'followup' && step.done && (
                        <div className="timeline-completed-summary">
                          <strong>{followupData.type || alert.followup_type}</strong> on{' '}
                          {new Date(followupData.date || alert.followup_date).toLocaleDateString('en-IN', { dateStyle: 'medium' })}
                        </div>
                      )}

                      {/* ── Step 4: Referral (high-risk only) ────────────── */}
                      {step.id === 'referral' && step.active && (
                        <div className="timeline-form">
                          <div className="timeline-field">
                            <label>Referral Facility *</label>
                            <input
                              type="text"
                              placeholder="e.g., District Hospital, Sitamarhi"
                              value={referralData.facility}
                              onChange={e => setReferralData(prev => ({ ...prev, facility: e.target.value }))}
                            />
                          </div>
                          <div className="timeline-field">
                            <label>Referral Reason</label>
                            <textarea
                              placeholder="Clinical indication for referral…"
                              rows={2}
                              value={referralData.reason}
                              onChange={e => setReferralData(prev => ({ ...prev, reason: e.target.value }))}
                            />
                          </div>
                          <button
                            className="timeline-action-btn danger"
                            onClick={handleReferralSubmit}
                            disabled={!referralData.facility.trim() || saving === 'referral'}
                          >
                            {saving === 'referral' ? 'Saving…' : '🏥 Initiate Referral'}
                          </button>
                        </div>
                      )}
                      {step.id === 'referral' && step.done && (
                        <div className="timeline-completed-summary">
                          Referred to <strong>{referralData.facility || alert.referred_to}</strong>
                          {(referralData.reason || alert.referral_reason) && (
                            <span> — {referralData.reason || alert.referral_reason}</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Timestamp */}
          <div className="escalation-section escalation-timestamp">
            Created: {alert.created_at
              ? new Date(alert.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
              : 'N/A'}
          </div>

        </div>
      </div>
    </>
  );
}
