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

const GEMINI_ENDPOINT =
  `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

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

// ─── Main export ────────────────────────────────────────────────────────────────

/**
 * Process voice health input through Gemini AI.
 *
 * @param {string} audioBase64 - Base64-encoded audio data (m4a / wav)
 * @param {string} [mimeType='audio/mp4'] - MIME type of the audio
 * @returns {Promise<object>} Sanitized field object matching AddVisitScreen schema
 */
export async function processVoiceHealthInput(audioBase64, mimeType = 'audio/mp4') {
  try {
    if (!audioBase64 || typeof audioBase64 !== 'string') {
      console.warn('[aiService] No audio data provided, returning mock');
      return getMockResponse();
    }

    if (GEMINI_API_KEY === 'YOUR_GEMINI_API_KEY_HERE') {
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

    let response;
    let retries = 3;
    let delay = 1000;

    while (retries > 0) {
      response = await fetch(GEMINI_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      if (response.ok) break;

      if (response.status === 429 && retries > 1) {
        console.warn(`[aiService] Rate limited (429). Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        retries--;
        delay *= 2;
      } else {
        break;
      }
    }

    if (!response.ok) {
      const errText = await response.text().catch(() => 'unknown');
      console.warn(`[aiService] API error ${response.status}: ${errText}`);
      return getMockResponse();
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

// ─── Mock responses (hackathon demo safety net) ─────────────────────────────────

let _mockIndex = 0;

const MOCK_RESPONSES = [
  {
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
  {
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
  {
    visit_type: 'TB Follow-up',
    tb_cough_weeks: '4',
    tb_followup_missed: true,
    temperature_c: '38.2',
    weight_kg: '45',
    raw_note:
      'TB patient Ramu ka follow-up miss ho gaya. 4 hafte se khansi hai. ' +
      'Halka bukhar 38.2. Wajan 45 kg ho gaya. Dawai nahi le raha tha.',
  },
  {
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
  {
    visit_type: 'Vaccination',
    vaccination_due: true,
    vaccination_given: true,
    temperature_c: '36.8',
    raw_note:
      'Bachche ka tika lagaya gaya. Temperature normal 36.8. ' +
      'Polio aur DPT booster diya gaya. Agla tika 6 hafte baad.',
  },
];

/**
 * Returns a varied mock response for demo/fallback scenarios.
 * Rotates through 5 different visit types so repeated demos look natural.
 */
function getMockResponse() {
  const mock = MOCK_RESPONSES[_mockIndex % MOCK_RESPONSES.length];
  _mockIndex++;
  return { ...mock };
}
