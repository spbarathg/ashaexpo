/**
 * govPushService.js — Government Health Portal Integration Service
 *
 * Manages government API configuration (localStorage) and provides
 * a simulated multi-stage data push for HMIS reporting compatibility.
 * Designed as a placeholder for real NIC/MoHFW HMIS API integration.
 */

const CONFIG_KEY = 'ps19_gov_portal_config';

// ─── Configuration Management ───────────────────────────────────────────────────

/**
 * Retrieve stored government portal configuration.
 * @returns {{ apiKey: string, districtId: string, autoPush: boolean, lastPushAt: string|null, lastPushId: string|null }}
 */
export function getGovConfig() {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.warn('[govPush] Failed to read config:', e);
  }
  return {
    apiKey: '',
    districtId: '',
    autoPush: false,
    lastPushAt: null,
    lastPushId: null,
  };
}

/**
 * Save government portal configuration.
 * @param {object} config
 */
export function saveGovConfig(config) {
  try {
    const existing = getGovConfig();
    const merged = { ...existing, ...config };
    localStorage.setItem(CONFIG_KEY, JSON.stringify(merged));
    return merged;
  } catch (e) {
    console.warn('[govPush] Failed to save config:', e);
    throw e;
  }
}

/**
 * Check if the government portal is configured with an API key.
 * @returns {boolean}
 */
export function isGovConfigured() {
  const config = getGovConfig();
  return !!(config.apiKey && config.apiKey.trim().length > 0);
}

// ─── Simulated Push Pipeline ────────────────────────────────────────────────────

/**
 * Generate a realistic-looking push reference ID.
 */
function generatePushId() {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `HMIS-${ts}-${rand}`;
}

/**
 * Simulate pushing report data to the government health portal.
 * Goes through staged delays: preparing → validating → uploading → done.
 *
 * @param {object} reportData — The HMIS report data to push
 * @param {function} onProgress — Callback invoked at each stage: (stage, message)
 *   Stages: 'preparing' | 'validating' | 'uploading' | 'success' | 'error'
 * @returns {Promise<{ success: boolean, pushId: string, timestamp: string, recordCount: number }>}
 */
export async function pushToGovPortal(reportData, onProgress = () => {}) {
  const config = getGovConfig();

  if (!config.apiKey) {
    onProgress('error', 'No API key configured. Go to Settings to add your Government Portal API key.');
    throw new Error('Government Portal API key not configured');
  }

  try {
    // Stage 1: Preparing data
    onProgress('preparing', 'Aggregating HMIS report data…');
    await delay(800);

    // Count records being pushed
    let recordCount = 0;
    if (reportData) {
      Object.values(reportData).forEach(section => {
        if (typeof section === 'object') {
          recordCount += Object.keys(section).length;
        }
      });
    }

    // Stage 2: Validating
    onProgress('validating', `Validating ${recordCount} data fields against HMIS schema…`);
    await delay(1200);

    // Stage 3: Uploading
    onProgress('uploading', `Pushing to district portal (${config.districtId || 'Default District'})…`);
    await delay(1500);

    // Log the payload for demo transparency
    console.log('[govPush] ✅ Simulated push payload:', {
      endpoint: 'https://hmis.nhp.gov.in/api/v2/monthly-report',
      districtId: config.districtId || 'DIST-001',
      apiKey: config.apiKey.substring(0, 8) + '…',
      recordCount,
      data: reportData,
    });

    // Generate result
    const pushId = generatePushId();
    const timestamp = new Date().toISOString();

    // Save last push info
    saveGovConfig({ lastPushAt: timestamp, lastPushId: pushId });

    // Stage 4: Success
    onProgress('success', `Successfully pushed ${recordCount} indicators.`);

    return { success: true, pushId, timestamp, recordCount };

  } catch (err) {
    if (err.message !== 'Government Portal API key not configured') {
      onProgress('error', `Push failed: ${err.message}`);
    }
    throw err;
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
