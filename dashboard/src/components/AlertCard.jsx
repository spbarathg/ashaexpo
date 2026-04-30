import React from 'react';
import RiskBadge from './RiskBadge';

export default function AlertCard({ alert, onAcknowledge, onViewPatient }) {
  const flags = Array.isArray(alert.risk_flags)
    ? alert.risk_flags
    : (() => { try { return JSON.parse(alert.risk_flags || '[]'); } catch { return []; } })();
  const isAcked = alert.status === 'acknowledged';
  const isHighRisk = alert.risk_level === 'high';

  // High-risk cards stay visually prominent even after acknowledgement
  const shouldFade = isAcked && !isHighRisk;
  
  const borderColor = shouldFade ? 'var(--border-color)' : (isHighRisk ? 'var(--danger-color)' : 'var(--warning-color)');
  const bgColor = shouldFade ? '#fcfcfc' : (isHighRisk ? '#fffefc' : 'var(--card-bg)');

  return (
    <div style={{
      backgroundColor: bgColor, 
      borderRadius: 'var(--radius-lg)', 
      padding: '24px', 
      marginBottom: '16px',
      border: '1px solid var(--border-color)',
      borderLeft: `4px solid ${borderColor}`,
      boxShadow: shouldFade ? 'none' : 'var(--shadow-sm)', 
      opacity: shouldFade ? 0.8 : 1,
      display: 'flex',
      flexDirection: 'column',
      gap: '16px',
      transition: 'all 0.2s ease',
    }}
    onMouseEnter={e => { if(!shouldFade) e.currentTarget.style.boxShadow = 'var(--shadow-md)'; }}
    onMouseLeave={e => { if(!shouldFade) e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <RiskBadge level={alert.risk_level} />
          {isHighRisk && !isAcked && (
             <span style={{ 
               color: 'var(--danger-color)', fontSize: '12px', fontWeight: 700, 
               display: 'flex', alignItems: 'center', gap: '4px',
               animation: 'pulse 2s infinite'
             }}>
               ⚠️ URGENT
             </span>
          )}
          {/* High-risk acknowledged: show "Seen" chip instead of fading the card */}
          {isHighRisk && isAcked && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: '5px',
              padding: '3px 10px', borderRadius: '100px',
              backgroundColor: 'var(--success-bg)', color: 'var(--success-color)',
              fontSize: '11px', fontWeight: 700, border: '1px solid rgba(76, 175, 80, 0.2)',
              letterSpacing: '0.02em', textTransform: 'uppercase'
            }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
              Seen
            </span>
          )}
        </div>
        <span style={{ fontSize: '13px', color: 'var(--text-light)', fontWeight: 500 }}>
          {alert.created_at ? new Date(alert.created_at).toLocaleString('en-IN', {
            hour: 'numeric', minute: 'numeric', hour12: true,
            day: 'numeric', month: 'short'
          }) : ''}
        </span>
      </div>

      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
          <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: 'var(--text-main)' }}>
            {alert.patient_name || 'Unknown Patient'}
          </h3>
          <button onClick={() => onViewPatient()} style={{
            background: 'none', border: 'none', color: 'var(--primary-color)',
            fontSize: '13px', fontWeight: 600, cursor: 'pointer',
            textDecoration: 'underline', textUnderlineOffset: '2px'
          }}>
            View Details
          </button>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', color: 'var(--text-muted)', fontSize: '14px', marginTop: '8px' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
            {alert.village || 'N/A'}
          </span>
          
          {alert.asha_phone && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
              <a href={`tel:${alert.asha_phone}`} style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>{alert.asha_phone}</a>
            </span>
          )}
        </div>
      </div>

      {flags.length > 0 && (
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {flags.map((f, i) => (
            <span key={i} style={{
              display: 'inline-flex', alignItems: 'center', padding: '4px 12px', borderRadius: '6px',
              backgroundColor: 'var(--danger-bg)', color: 'var(--danger-color)', 
              fontSize: '12px', fontWeight: 600, border: '1px solid rgba(239, 68, 68, 0.2)'
            }}>
              {typeof f === 'string' ? f.replace(/_/g, ' ') : f}
            </span>
          ))}
        </div>
      )}

      <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px', marginTop: '4px', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '12px' }}>
        {!isAcked ? (
          <button onClick={() => onAcknowledge(alert.id)} style={{
            padding: '10px 24px', 
            borderRadius: 'var(--radius-md)', 
            border: 'none', 
            cursor: 'pointer',
            backgroundColor: isHighRisk ? 'var(--danger-color)' : 'var(--primary-color)', 
            color: '#fff', 
            fontWeight: 600, 
            fontSize: '14px',
            boxShadow: 'var(--shadow-sm)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
            {isHighRisk ? 'Mark as Seen' : 'Acknowledge Alert'}
          </button>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--success-color)', fontWeight: 600, fontSize: '14px' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
            {isHighRisk ? 'Seen' : 'Acknowledged'} {alert.acknowledged_at ? `at ${new Date(alert.acknowledged_at).toLocaleTimeString('en-IN', { hour: 'numeric', minute: 'numeric', hour12: true })}` : ''}
          </div>
        )}
      </div>
    </div>
  );
}
