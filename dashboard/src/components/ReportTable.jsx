import React from 'react';

export default function ReportTable({ data }) {
  if (!data) return null;

  const renderSection = (title, icon, fields) => {
    return (
      <div style={{ marginBottom: '24px' }}>
        <h4 style={{ 
          fontSize: '15px', fontWeight: 700, color: 'var(--text-main)', 
          margin: '0 0 12px 0', paddingBottom: '8px', borderBottom: '1px solid var(--border-color)',
          display: 'flex', alignItems: 'center', gap: '8px'
        }}>
          <span>{icon}</span> {title}
        </h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
          {Object.entries(fields).map(([key, val]) => (
            <div key={key} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px', backgroundColor: 'var(--bg-color)', borderRadius: 'var(--radius-sm)' }}>
              <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{key}</span>
              <strong style={{ fontSize: '14px', color: val === 'N/A' || val === '0' || val === 0 ? 'var(--text-muted)' : 'var(--text-main)' }}>
                {val}
              </strong>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div style={{ padding: '24px' }}>
      {renderSection('1. Report Metadata', '📄', data.metadata)}
      {renderSection('2. Population / Coverage', '👥', data.population)}
      {renderSection('3. Maternal Health / ANC', '🤰', data.maternal)}
      {renderSection('4. Child Health / Immunisation', '👶', data.childHealth)}
      {renderSection('5. Disease / Symptoms Surveillance', '🤒', data.disease)}
      {renderSection('6. High-risk Alerts', '🚨', data.alerts)}
      {renderSection('7. Visit / Service Delivery', '🩺', data.service)}
      {renderSection('8. Sync / Offline Status', '📴', data.sync)}
      {renderSection('9. Medicine / Stock-lite', '💊', data.stock)}
    </div>
  );
}
