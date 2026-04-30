import React, { useState, useEffect } from 'react';
import { fetchReportData, getVillages } from '../services/reportService';
import { isGovConfigured, pushToGovPortal } from '../services/govPushService';
import ReportTable from '../components/ReportTable';
import VillageFilter from '../components/VillageFilter';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

export default function ReportsPage() {
  const [villages, setVillages] = useState([]);
  const [selectedVillage, setSelectedVillage] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  // Gov push state
  const [pushModal, setPushModal] = useState(false);
  const [pushStage, setPushStage] = useState(null);  // 'preparing' | 'validating' | 'uploading' | 'success' | 'error'
  const [pushMessage, setPushMessage] = useState('');
  const [pushResult, setPushResult] = useState(null);

  useEffect(() => { getVillages().then(setVillages); }, []);

  useEffect(() => {
    setLoading(true);
    fetchReportData({ village: selectedVillage || undefined, month: selectedMonth, year: selectedYear })
      .then(setData).finally(() => setLoading(false));
  }, [selectedVillage, selectedMonth, selectedYear]);

  const handlePrint = () => window.print();

  const handleExportCSV = () => {
    if (!data) return;
    
    const rows = [];
    rows.push(['HMIS Category', 'Indicator', 'Value']);
    
    Object.entries(data).forEach(([sectionKey, sectionObj]) => {
      Object.entries(sectionObj).forEach(([key, val]) => {
        // Wrap string values in quotes to prevent CSV breakage
        const safeVal = typeof val === 'string' && val.includes(',') ? `"${val}"` : val;
        rows.push([sectionKey, key, safeVal]);
      });
    });

    const csvContent = rows.map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `HMIS_Report_${selectedYear}_${(selectedMonth + 1).toString().padStart(2, '0')}${selectedVillage ? '_' + selectedVillage : ''}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleGovPush = async () => {
    if (!isGovConfigured()) {
      setPushModal(true);
      setPushStage('error');
      setPushMessage('No Government Portal API key configured. Go to Settings → Government Health Portal to add your HMIS API key.');
      return;
    }
    if (!data) return;

    setPushModal(true);
    setPushStage(null);
    setPushMessage('');
    setPushResult(null);

    try {
      const result = await pushToGovPortal(data, (stage, message) => {
        setPushStage(stage);
        setPushMessage(message);
      });
      setPushResult(result);
    } catch (err) {
      // Error already handled via onProgress callback
    }
  };

  return (
    <div style={{ animation: 'fadeIn 0.4s ease' }}>
      <div className="no-print" style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '24px' }}>
          <div>
            <h2 style={{ fontSize: '28px', fontWeight: 800, color: 'var(--text-main)', margin: '0 0 8px 0', letterSpacing: '-0.02em' }}>
              HMIS Monthly Summary
            </h2>
            <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '15px' }}>
              View and export aggregated ASHA village reports.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <button onClick={handleGovPush} style={{
              padding: '10px 20px', borderRadius: 'var(--radius-md)', border: 'none', cursor: 'pointer',
              backgroundColor: '#6D28D9', color: '#fff', fontWeight: 600, fontSize: '14px',
              display: 'flex', alignItems: 'center', gap: '8px', boxShadow: 'var(--shadow-sm)'
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 16 12 12 8 16" /><line x1="12" y1="12" x2="12" y2="21" /><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" /></svg>
              Push to Govt. Portal
            </button>
            <button onClick={handleExportCSV} style={{
              padding: '10px 20px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', cursor: 'pointer',
              backgroundColor: 'var(--bg-color)', color: 'var(--text-main)', fontWeight: 600, fontSize: '14px',
              display: 'flex', alignItems: 'center', gap: '8px', boxShadow: 'var(--shadow-sm)'
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
              Export CSV
            </button>
            <button onClick={handlePrint} style={{
              padding: '10px 20px', borderRadius: 'var(--radius-md)', border: 'none', cursor: 'pointer',
              backgroundColor: 'var(--primary-color)', color: '#fff', fontWeight: 600, fontSize: '14px',
              display: 'flex', alignItems: 'center', gap: '8px', boxShadow: 'var(--shadow-sm)'
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
              Export PDF
            </button>
          </div>
        </div>

        <div style={{ 
          backgroundColor: 'var(--card-bg)', padding: '24px', 
          borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)',
          boxShadow: 'var(--shadow-sm)', marginBottom: '24px'
        }}>
          <div style={{ marginBottom: '16px' }}>
            <VillageFilter villages={villages} selected={selectedVillage} onChange={setSelectedVillage} />
          </div>
          
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-light)', marginRight: '4px' }}>Period:</span>
            <div style={{ position: 'relative' }}>
              <select value={selectedMonth} onChange={e => setSelectedMonth(Number(e.target.value))}
                style={{ 
                  padding: '10px 36px 10px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', 
                  fontSize: '14px', fontWeight: 500, cursor: 'pointer', appearance: 'none',
                  backgroundColor: 'var(--bg-color)', color: 'var(--text-main)'
                }}>
                {MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
              </select>
              <svg style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-muted)' }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
            </div>
            
            <div style={{ position: 'relative' }}>
              <select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))}
                style={{ 
                  padding: '10px 36px 10px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', 
                  fontSize: '14px', fontWeight: 500, cursor: 'pointer', appearance: 'none',
                  backgroundColor: 'var(--bg-color)', color: 'var(--text-main)'
                }}>
                {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
              </select>
              <svg style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-muted)' }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
            </div>
          </div>
        </div>
      </div>

      <div id="report-content" className="card-print" style={{
        backgroundColor: 'var(--card-bg)', borderRadius: 'var(--radius-lg)', 
        boxShadow: 'var(--shadow-sm)', border: '1px solid var(--border-color)',
        overflow: 'hidden'
      }}>
        <div className="print-only" style={{ display: 'none', padding: '32px 32px 0 32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <span style={{ fontSize: '24px' }}>🏥</span>
            <h1 style={{ fontSize: '24px', fontWeight: 800, margin: 0, color: '#000' }}>Village Health Dashboard</h1>
          </div>
          <h2 style={{ fontSize: '18px', fontWeight: 600, margin: '0 0 8px 0', color: '#333' }}>HMIS Monthly Summary</h2>
          <p style={{ color: '#666', margin: '0 0 24px 0' }}>
            <strong>Location:</strong> {selectedVillage || 'All Villages'} &nbsp;|&nbsp; 
            <strong>Period:</strong> {MONTHS[selectedMonth]} {selectedYear}
          </p>
          <hr style={{ border: 'none', borderTop: '2px solid #eee', marginBottom: '24px' }} />
        </div>
        
        {loading ? (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '60px' }}>
            <div style={{ display: 'inline-block', width: '24px', height: '24px', border: '3px solid var(--border-color)', borderTopColor: 'var(--primary-color)', borderRadius: '50%', animation: 'spin 1s linear infinite', marginBottom: '16px' }}></div>
            <div>Loading report data...</div>
          </div>
        ) : (
          <>
            <div className="no-print" style={{ padding: '24px 24px 16px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--text-main)' }}>
                {selectedVillage ? `${selectedVillage} Report` : 'All Villages Report'} • {MONTHS[selectedMonth]} {selectedYear}
              </h3>
            </div>
            <ReportTable data={data} />
          </>
        )}
      </div>

      {/* ── Government Push Modal ──────────────────────────────────────────── */}
      {pushModal && (
        <>
          <div className="escalation-backdrop" onClick={() => { if (pushStage === 'success' || pushStage === 'error') setPushModal(false); }} />
          <div className="gov-push-modal">
            <div className="gov-push-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '20px' }}>🏛️</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '16px', color: 'var(--text-main)' }}>Push to Government Portal</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>MoHFW HMIS Data Submission</div>
                </div>
              </div>
              {(pushStage === 'success' || pushStage === 'error') && (
                <button onClick={() => setPushModal(false)} className="escalation-close" aria-label="Close">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              )}
            </div>

            <div className="gov-push-modal-body">
              {pushStage === 'error' ? (
                <div className="gov-push-step error">
                  <span style={{ fontSize: '32px' }}>⚠️</span>
                  <div style={{ fontWeight: 600, color: 'var(--danger-color)', fontSize: '15px' }}>Configuration Required</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '14px', textAlign: 'center', lineHeight: 1.5 }}>{pushMessage}</div>
                </div>
              ) : pushStage === 'success' ? (
                <div className="gov-push-step success">
                  <span style={{ fontSize: '40px' }}>✅</span>
                  <div style={{ fontWeight: 700, color: 'var(--success-color)', fontSize: '17px' }}>Successfully Pushed</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '14px' }}>{pushMessage}</div>
                  {pushResult && (
                    <div className="gov-push-result-card">
                      <div className="gov-push-result-row">
                        <span>Reference ID</span>
                        <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{pushResult.pushId}</span>
                      </div>
                      <div className="gov-push-result-row">
                        <span>Records Pushed</span>
                        <span>{pushResult.recordCount} indicators</span>
                      </div>
                      <div className="gov-push-result-row">
                        <span>Timestamp</span>
                        <span>{new Date(pushResult.timestamp).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</span>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="gov-push-stages">
                  {['preparing', 'validating', 'uploading'].map((stage) => {
                    const stageOrder = { preparing: 0, validating: 1, uploading: 2 };
                    const currentOrder = stageOrder[pushStage] ?? -1;
                    const thisOrder = stageOrder[stage];
                    const isDone = thisOrder < currentOrder;
                    const isActive = stage === pushStage;
                    const labels = { preparing: 'Preparing Data', validating: 'Validating Schema', uploading: 'Uploading to Portal' };

                    return (
                      <div key={stage} className={`gov-push-stage-item ${isDone ? 'done' : ''} ${isActive ? 'active' : ''}`}>
                        <div className="gov-push-stage-indicator">
                          {isDone ? (
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--success-color)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                          ) : isActive ? (
                            <div className="gov-push-spinner" />
                          ) : (
                            <div className="gov-push-stage-dot" />
                          )}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '14px', color: isDone || isActive ? 'var(--text-main)' : 'var(--text-light)' }}>{labels[stage]}</div>
                          {isActive && <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>{pushMessage}</div>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
