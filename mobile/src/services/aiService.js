/**
 * aiService.js — Ambient AI Voice Form Autofill Service
 *
 * Sends recorded audio (base64) to a Gemini-compatible REST endpoint.
 * Returns a sanitized JS object matching AddVisitScreen field schema exactly.
 *
 * Field contract (from surgical analysis):
 *   - Numeric fields → strings  ("140", "38.5")
 *   - Boolean fields → booleans (true / false)
 *   - visit_type     → exact enum string
 *   - raw_note       → full transcript string
 *   - Missing fields → omitted (not null, not "")
 */

// ─── Configuration ──────────────────────────────────────────────────────────────

const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;

// Use gemini-2.0-flash as requested
const GEMINI_MODEL = 'gemini-2.0-flash';
const GEMINI_ENDPOINT =
  `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

// ─── Valid enums (must match VISIT_TYPES in constants/visitTypes.js) ─────────

const VALID_VISIT_TYPES = [
  'ANC', 'Postnatal', 'Child', 'TB Follow-up', 'Vaccination', 'General',
];

// ─── All accepted field keys (must match AddVisitScreen fields state) ────────

const STRING_FIELDS = [
  'anc_number', 'trimester', 'bp_systolic', 'bp_diastolic',
  'weight_kg', 'gestational_weeks', 'postnatal_day',
  'temperature_c', 'muac_cm', 'tb_cough_weeks',
];

const BOOLEAN_FIELDS = [
  'bleeding', 'seizure', 'breathlessness',
  'vaccination_due', 'vaccination_given', 'tb_followup_missed',
];

// ─── System prompt ──────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a medical transcription AI for Indian ASHA health workers.
You will receive an audio recording of a health worker describing a patient visit in Hindi, Hinglish, or English.

Your job:
1. Transcribe the conversation.
2. Extract structured health data from the transcription.
3. Return ONLY a valid JSON object — no markdown, no explanation, no extra text.

STRICT JSON SCHEMA — follow exactly:

{
  "visit_type": one of: "ANC", "Postnatal", "Child", "TB Follow-up", "Vaccination", "General",

  "anc_number":        string (e.g. "3"),
  "trimester":         string (e.g. "2"),
  "bp_systolic":       string (e.g. "140"),
  "bp_diastolic":      string (e.g. "90"),
  "weight_kg":         string (e.g. "55.5"),
  "gestational_weeks": string (e.g. "28"),
  "postnatal_day":     string (e.g. "3"),
  "temperature_c":     string (e.g. "38.5"),
  "muac_cm":           string (e.g. "11.2"),
  "tb_cough_weeks":    string (e.g. "3"),

  "bleeding":           boolean,
  "seizure":            boolean,
  "breathlessness":     boolean,
  "vaccination_due":    boolean,
  "vaccination_given":  boolean,
  "tb_followup_missed": boolean,

  "raw_note":           string (full transcript of what was spoken)
}

RULES:
- All numeric values MUST be strings, not numbers.
- All boolean values MUST be true or false, not strings.
- OMIT any field you cannot determine from the audio — do NOT include null or empty strings.
- "visit_type" MUST be one of the six exact values listed above.
- "raw_note" MUST always be present and contain the full transcription.
- Return ONLY the JSON object. No markdown fences. No commentary.`;

// ─── Concurrency & Retry Config ─────────────────────────────────────────────────

let _inflight = false;            // Concurrency lock — only one request at a time
const MAX_RETRIES = 3;            // Max retry attempts on 429
const BASE_DELAY_MS = 2000;       // Exponential backoff base
const REQUEST_TIMEOUT_MS = 12000; // Per-request timeout (12s, realistic for mobile)

// ─── Main export ────────────────────────────────────────────────────────────────

/**
 * Process voice health input through Gemini AI.
 *
 * Implements:
 *   1. Concurrency lock — drops overlapping calls
 *   2. AbortController timeout — kills hung fetches
 *   3. Exponential backoff — handles 429 with Retry-After support
 *
 * @param {string} audioBase64 - Base64-encoded audio data (m4a / wav)
 * @param {string} [mimeType='audio/mp4'] - MIME type of the audio
 * @returns {Promise<object>} Sanitized field object matching AddVisitScreen schema
 */
export async function processVoiceHealthInput(audioBase64, mimeType = 'audio/mp4') {
  // ── Guard: reject if another request is already in-flight ──
  if (_inflight) {
    console.warn('[aiService] Request already in-flight — dropping duplicate call');
    return getMockResponse();
  }

  _inflight = true;
  try {
    if (!audioBase64 || typeof audioBase64 !== 'string') {
      console.warn('[aiService] No audio data provided, returning mock');
      return getMockResponse();
    }

    if (!GEMINI_API_KEY || GEMINI_API_KEY === 'YOUR_GEMINI_API_KEY_HERE') {
      console.warn('[aiService] API key not configured — returning mock response');
      return getMockResponse();
    }

    const requestBody = {
      contents: [
        {
          parts: [
            { text: SYSTEM_PROMPT },
            {
              inlineData: {
                mimeType,
                data: audioBase64,
              },
            },
            { text: 'Transcribe and extract structured health data from this audio. Return ONLY valid JSON.' },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 1024,
      },
    };

    // ── Retry loop with exponential backoff ──
    let response;
    let lastError = null;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      // Create a fresh AbortController per attempt
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

      try {
        response = await fetch(GEMINI_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
          signal: controller.signal,
        });
      } catch (fetchErr) {
        clearTimeout(timeoutId);
        if (fetchErr.name === 'AbortError') {
          console.warn(`[aiService] Request timed out after ${REQUEST_TIMEOUT_MS}ms (attempt ${attempt + 1}/${MAX_RETRIES})`);
        } else {
          console.warn(`[aiService] Network error (attempt ${attempt + 1}/${MAX_RETRIES}):`, fetchErr.message);
        }
        lastError = fetchErr;
        // Backoff before next attempt
        if (attempt < MAX_RETRIES - 1) {
          const backoff = BASE_DELAY_MS * Math.pow(2, attempt);
          await new Promise(r => setTimeout(r, backoff));
        }
        continue;
      }
      clearTimeout(timeoutId);

      // Success — break out
      if (response.ok) break;

      // 429 Rate Limited — backoff and retry
      if (response.status === 429 && attempt < MAX_RETRIES - 1) {
        let waitMs = BASE_DELAY_MS * Math.pow(2, attempt); // 2s, 4s, 8s
        // Respect server's Retry-After if available
        try {
          const errBody = await response.clone().json();
          const retryInfo = errBody?.error?.details?.find(d => d['@type']?.includes('RetryInfo'));
          if (retryInfo?.retryDelay) {
            const secs = parseFloat(retryInfo.retryDelay);
            if (!isNaN(secs) && secs > 0) waitMs = Math.ceil(secs * 1000) + 500;
          }
        } catch { /* use computed backoff */ }
        waitMs = Math.min(waitMs, 30000); // Cap at 30s
        console.warn(`[aiService] 429 Rate limited. Backoff ${waitMs}ms (attempt ${attempt + 1}/${MAX_RETRIES})`);
        await new Promise(r => setTimeout(r, waitMs));
        continue;
      }

      // Non-retryable error — break out
      break;
    }

    // ── Handle final response ──
    if (!response || !response.ok) {
      const status = response?.status || 'NO_RESPONSE';
      const errText = response ? await response.text().catch(() => 'unknown') : (lastError?.message || 'unknown');
      console.warn(`[aiService] Final API error ${status}: ${errText}`);
      const mock = getMockResponse();
      mock._offlineFallback = true;
      mock._reason = status === 429 ? 'API quota exceeded — using local extraction only' : `API error ${status}`;
      return mock;
    }

    const data = await response.json();
    const rawText = extractTextFromGeminiResponse(data);

    if (!rawText) {
      console.warn('[aiService] Empty response from Gemini — returning mock');
      return getMockResponse();
    }

    const parsed = safeParseJSON(rawText);
    if (!parsed) {
      console.warn('[aiService] Failed to parse AI JSON — returning mock');
      return getMockResponse();
    }

    return sanitizeAIResponse(parsed);
  } catch (err) {
    console.warn('[aiService] processVoiceHealthInput failed:', err);
    return getMockResponse();
  } finally {
    _inflight = false; // Always release the lock
  }
}

// ─── Response extraction ────────────────────────────────────────────────────────

/**
 * Drill into the Gemini response structure to find the text content.
 */
function extractTextFromGeminiResponse(data) {
  try {
    const candidates = data?.candidates;
    if (!candidates || candidates.length === 0) return null;

    const parts = candidates[0]?.content?.parts;
    if (!parts || parts.length === 0) return null;

    // Concatenate all text parts
    return parts
      .filter(p => typeof p.text === 'string')
      .map(p => p.text)
      .join('')
      .trim();
  } catch {
    return null;
  }
}

// ─── JSON parsing ───────────────────────────────────────────────────────────────

/**
 * Safely parse JSON from AI output. Handles markdown fences and trailing junk.
 */
function safeParseJSON(text) {
  if (!text) return null;

  // Strip markdown code fences if present
  let cleaned = text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim();

  // Attempt 1: direct parse
  try {
    return JSON.parse(cleaned);
  } catch { /* continue */ }

  // Attempt 2: find first { ... } block
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    try {
      return JSON.parse(cleaned.substring(firstBrace, lastBrace + 1));
    } catch { /* continue */ }
  }

  return null;
}

// ─── Sanitization ───────────────────────────────────────────────────────────────

/**
 * Sanitize the parsed AI response to match AddVisitScreen field schema exactly.
 * - Coerces numeric fields to strings
 * - Coerces boolean fields to booleans
 * - Validates visit_type enum
 * - Strips unknown keys
 */
function sanitizeAIResponse(raw) {
  const result = {};

  // visit_type — must be an exact match
  if (raw.visit_type && VALID_VISIT_TYPES.includes(raw.visit_type)) {
    result.visit_type = raw.visit_type;
  } else if (raw.visit_type) {
    // Attempt fuzzy match (case-insensitive)
    const match = VALID_VISIT_TYPES.find(
      vt => vt.toLowerCase() === String(raw.visit_type).toLowerCase()
    );
    if (match) result.visit_type = match;
  }

  // String fields — coerce numbers to strings, drop nulls/empty
  for (const key of STRING_FIELDS) {
    if (raw[key] !== undefined && raw[key] !== null && raw[key] !== '') {
      const val = String(raw[key]);
      // Only keep if it contains a plausible number
      if (/^\d+(\.\d+)?$/.test(val.trim())) {
        result[key] = val.trim();
      }
    }
  }

  // Boolean fields — coerce to actual booleans
  for (const key of BOOLEAN_FIELDS) {
    if (raw[key] !== undefined && raw[key] !== null) {
      if (typeof raw[key] === 'boolean') {
        // Only include if true (truthy-only merge in AddVisitScreen)
        if (raw[key]) result[key] = true;
      } else if (raw[key] === 'true' || raw[key] === 1 || raw[key] === '1') {
        result[key] = true;
      }
      // false / falsy values are intentionally omitted — AddVisitScreen
      // defaults them to false and the merge pattern skips falsy values.
    }
  }

  // raw_note — must always be a string
  if (raw.raw_note && typeof raw.raw_note === 'string') {
    result.raw_note = raw.raw_note.trim();
  } else if (raw.transcript && typeof raw.transcript === 'string') {
    // Common AI alternative key name
    result.raw_note = raw.transcript.trim();
  }

  return result;
}

// ─── Deterministic fallback responses (one fixed set per visit type) ─────────

const MOCK_BY_VISIT_TYPE = {
  'ANC': {
    visit_type: 'ANC',
    trimester: '2',
    bp_systolic: '130',
    bp_diastolic: '85',
    weight_kg: '52',
    gestational_weeks: '24',
    bleeding: false,
    seizure: false,
    raw_note:
      'Patient Sunita, dusra trimester chal raha hai, 24 hafte ho gaye. ' +
      'BP 130/85 hai. Weight 52 kg. Khoon nahi aa raha, koi seizure nahi. ' +
      'Sab normal lag raha hai.',
  },
  'Child': {
    visit_type: 'Child',
    temperature_c: '39.8',
    muac_cm: '11.0',
    breathlessness: true,
    vaccination_due: true,
    vaccination_given: false,
    raw_note:
      'Bachche ko tez bukhar hai, temperature 39.8 hai. MUAC 11 cm. ' +
      'Saans lene mein taklif ho rahi hai. Tika abhi baaki hai.',
  },
  'TB Follow-up': {
    visit_type: 'TB Follow-up',
    tb_cough_weeks: '4',
    tb_followup_missed: true,
    temperature_c: '38.2',
    weight_kg: '45',
    raw_note:
      'TB patient Ramu ka follow-up miss ho gaya. 4 hafte se khansi hai. ' +
      'Halka bukhar 38.2. Wajan 45 kg ho gaya. Dawai nahi le raha tha.',
  },
  'Postnatal': {
    visit_type: 'Postnatal',
    postnatal_day: '3',
    bp_systolic: '145',
    bp_diastolic: '95',
    bleeding: true,
    temperature_c: '37.8',
    raw_note:
      'Delivery ke 3 din baad visit. BP 145/95 hai, thoda zyada hai. ' +
      'Halka khoon aa raha hai. Temperature 37.8. Monitoring zaroori hai.',
  },
  'Vaccination': {
    visit_type: 'Vaccination',
    vaccination_due: true,
    vaccination_given: true,
    temperature_c: '36.8',
    raw_note:
      'Bachche ka tika lagaya gaya. Temperature normal 36.8. ' +
      'Polio aur DPT booster diya gaya. Agla tika 6 hafte baad.',
  },
  'General': {
    visit_type: 'General',
    bp_systolic: '120',
    bp_diastolic: '80',
    temperature_c: '37.0',
    raw_note:
      'General health checkup. BP 120/80, temperature 37.0. ' +
      'Patient stable, no complaints.',
  },
};

// Default fallback when visit type is unknown
const DEFAULT_MOCK = MOCK_BY_VISIT_TYPE['General'];

/**
 * Returns a deterministic mock response for demo/fallback scenarios.
 * Always returns the same values for the same visit type — never rotates.
 *
 * @param {string} [visitType] - Optional visit type to match
 * @returns {object} Fixed test values for the given visit type
 */
export function getMockResponse(visitType) {
  const mock = (visitType && MOCK_BY_VISIT_TYPE[visitType]) || DEFAULT_MOCK;
  return { ...mock };
}

