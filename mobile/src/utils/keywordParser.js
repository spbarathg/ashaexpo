/**
 * Offline Hindi / Hinglish keyword parser.
 * Extracts structured health fields from typed notes.
 * Works entirely offline — no AI, no ML, no network.
 *
 * Patterns from implementation plan Section 4.
 */

/**
 * Parse a raw note and extract structured health data.
 * @param {string} note - Raw Hindi/Hinglish/English note
 * @returns {object} extracted fields
 */
export function parseNote(note) {
  if (!note || typeof note !== 'string') return {};

  const text = note.toLowerCase().trim();
  const extracted = {};

  // --- BP extraction ---
  // Pattern: "BP 150/95", "bp 130/80", "बीपी 140/90"
  const bpMatch = text.match(/(?:bp|बीपी|बी\.पी\.?)\s*(\d{2,3})\s*[\/\\]\s*(\d{2,3})/i);
  if (bpMatch) {
    extracted.bp_systolic = parseInt(bpMatch[1], 10);
    extracted.bp_diastolic = parseInt(bpMatch[2], 10);
  }

  // BP flag keywords: "bp high", "uchha bp", "उच्च बीपी"
  if (/(?:bp\s*high|high\s*bp|uchha\s*bp|उच्च\s*बीपी|बीपी\s*ज़्यादा|bp\s*zyada|bp\s*badha)/i.test(text)) {
    extracted.bp_flag = true;
    // If no numeric BP extracted, set elevated default
    if (!extracted.bp_systolic) {
      extracted.bp_systolic = 150;
      extracted.bp_diastolic = 95;
    }
  }

  // --- Fever ---
  // Pattern: "bukhar", "fever", "बुखार", "tez bukhar"
  const tempMatch = text.match(/(?:temp|temperature|तापमान)\s*(\d{2,3}(?:\.\d)?)/i);
  if (tempMatch) {
    extracted.temperature_c = parseFloat(tempMatch[1]);
  }

  if (/(?:bukhar|bukhaar|fever|बुखार|ज्वर|tez\s*bukhar)/i.test(text)) {
    extracted.fever_flag = true;
    if (!extracted.temperature_c) {
      extracted.temperature_c = 38.5; // default fever temp
    }
  }

  if (/(?:tez\s*bukhar|bahut\s*bukhar|high\s*fever|तेज़?\s*बुखार)/i.test(text)) {
    extracted.danger_fever_flag = true;
    if (!extracted.temperature_c || extracted.temperature_c < 39.5) {
      extracted.temperature_c = 39.5;
    }
  }

  // --- Bleeding ---
  // Pattern: "khoon", "bleeding", "रक्त", "khoon aa raha"
  if (/(?:khoon|khun|bleeding|bleed|रक्त|रक्तस्राव|खून)/i.test(text)) {
    extracted.bleeding = true;
  }

  // --- Seizure ---
  // Pattern: "dora", "seizure", "fits", "दौरा"
  if (/(?:dora|dauraa?|seizure|fits|mirgi|दौरा|मिर्गी)/i.test(text)) {
    extracted.seizure = true;
  }

  // --- Breathlessness ---
  // Pattern: "sans nahi", "breathless", "saans fool"
  if (/(?:sans?\s*(?:nahi|nhi|fool|phool)|breathless|saans?\s*(?:nahi|nhi|fool|phool)|साँस|श्वास)/i.test(text)) {
    extracted.breathlessness = true;
  }

  // --- Cough / TB ---
  // Pattern: "3 hafte se khansi", "2 week cough"
  const coughMatch = text.match(/(\d+)\s*(?:hafte?|hafton?|week|saptah|हफ्ते?)\s*(?:se\s*)?(?:khansi|khasi|cough|खाँसी|खांसी)/i);
  if (coughMatch) {
    extracted.tb_cough_weeks = parseInt(coughMatch[1], 10);
  }
  // Reverse pattern: "khansi 3 hafte se"
  const coughMatch2 = text.match(/(?:khansi|khasi|cough|खाँसी|खांसी)\s*(\d+)\s*(?:hafte?|hafton?|week|saptah|हफ्ते?)/i);
  if (coughMatch2 && !extracted.tb_cough_weeks) {
    extracted.tb_cough_weeks = parseInt(coughMatch2[1], 10);
  }

  // --- TB follow-up missed ---
  // Pattern: "TB nahi aaya", "follow up miss"
  if (/(?:tb\s*(?:nahi|nhi)\s*(?:aaya|aay)|tb\s*miss|follow\s*up\s*miss|टीबी\s*नहीं)/i.test(text)) {
    extracted.tb_followup_missed = true;
  }

  // --- Vaccination due ---
  // Pattern: "tika baaki", "टीका बाकी", "vaccine due"
  if (/(?:tika\s*(?:baaki|baki)|टीका\s*बाकी|vaccine?\s*due|vaccination?\s*due)/i.test(text)) {
    extracted.vaccination_due = true;
  }

  // --- Vaccination given ---
  // Pattern: "tika diya", "टीका दिया", "vaccine given"
  if (/(?:tika\s*(?:diya|de\s*diya)|टीका\s*(?:दिया|दे\s*दिया)|vaccine?\s*given|vaccination?\s*(?:given|done|complete))/i.test(text)) {
    extracted.vaccination_given = true;
  }

  // --- MUAC ---
  // Pattern: "MUAC 10.5", "muac 11"
  const muacMatch = text.match(/(?:muac|एम\.?यू\.?ए\.?सी\.?)\s*(\d{1,2}(?:\.\d)?)/i);
  if (muacMatch) {
    extracted.muac_cm = parseFloat(muacMatch[1]);
  }

  // --- Weight ---
  // Pattern: "52 kg", "55.5 kilo", "वजन 48"
  const weightMatch = text.match(/(?:weight|wajan|wazan|वजन)?\s*(\d{2,3}(?:\.\d)?)\s*(?:kg|kilo|किलो)/i);
  if (weightMatch) {
    extracted.weight_kg = parseFloat(weightMatch[1]);
  }

  // --- Gestational weeks ---
  // Pattern: "24 hafte", "28 weeks", "32 saptah"
  const gestMatch = text.match(/(\d{1,2})\s*(?:hafte?|hafton?|weeks?|saptah|हफ्ते?|सप्ताह)/i);
  if (gestMatch) {
    const weeks = parseInt(gestMatch[1], 10);
    // Only accept plausible gestational range (4-42 weeks)
    if (weeks >= 4 && weeks <= 42) {
      extracted.gestational_weeks = weeks;
    }
  }

  // --- Trimester ---
  // Pattern: "dusra trimester", "second trimester", "तीसरी तिमाही"
  const trimesterMap = {
    'pehla': 1, 'pahla': 1, 'first': 1, '1st': 1, 'पहली': 1, 'पहला': 1,
    'dusra': 2, 'doosra': 2, 'second': 2, '2nd': 2, 'दूसरी': 2, 'दूसरा': 2,
    'teesra': 3, 'tisra': 3, 'third': 3, '3rd': 3, 'तीसरी': 3, 'तीसरा': 3,
  };
  const trimMatch = text.match(/(pehla|pahla|first|1st|पहली|पहला|dusra|doosra|second|2nd|दूसरी|दूसरा|teesra|tisra|third|3rd|तीसरी|तीसरा)\s*(?:trimester|तिमाही|mahina)/i);
  if (trimMatch) {
    extracted.trimester = trimesterMap[trimMatch[1].toLowerCase()] || null;
  }

  // --- Visit type inference ---
  // Pattern: "ANC visit", "TB follow up", "tika lagaya"
  if (/(?:anc|ए\.?एन\.?सी\.?|ante\s*natal)/i.test(text)) {
    extracted.visit_type_hint = 'ANC';
  } else if (/(?:postnatal|post\s*natal|delivery\s*ke\s*baad|प्रसव\s*के\s*बाद)/i.test(text)) {
    extracted.visit_type_hint = 'Postnatal';
  } else if (/(?:tb\s*follow|tb\s*dawai|dots|टीबी\s*(?:दवाई|फॉलो))/i.test(text)) {
    extracted.visit_type_hint = 'TB Follow-up';
  } else if (/(?:tika|vaccine|vaccination|टीका|टीकाकरण)/i.test(text)) {
    extracted.visit_type_hint = 'Vaccination';
  } else if (/(?:bachcha|bachche|child|bacha|बच्चा|बच्चे|शिशु)/i.test(text)) {
    extracted.visit_type_hint = 'Child';
  }

  return extracted;
}

/**
 * Get a human-readable summary of extracted fields (Hindi + English).
 */
export function getExtractionSummary(extracted) {
  const lines = [];

  if (extracted.bp_systolic && extracted.bp_diastolic) {
    lines.push(`BP: ${extracted.bp_systolic}/${extracted.bp_diastolic} mmHg`);
  }
  if (extracted.bp_flag) {
    lines.push('BP High (बीपी ज़्यादा)');
  }
  if (extracted.temperature_c) {
    lines.push(`Temperature: ${extracted.temperature_c}°C`);
  }
  if (extracted.fever_flag) {
    lines.push('Fever (बुखार)');
  }
  if (extracted.danger_fever_flag) {
    lines.push('High Fever (तेज़ बुखार)');
  }
  if (extracted.bleeding) {
    lines.push('Bleeding (खून)');
  }
  if (extracted.seizure) {
    lines.push('Seizure (दौरा)');
  }
  if (extracted.breathlessness) {
    lines.push('Breathlessness (साँस की तकलीफ़)');
  }
  if (extracted.tb_cough_weeks) {
    lines.push(`Cough: ${extracted.tb_cough_weeks} weeks (${extracted.tb_cough_weeks} हफ्ते खाँसी)`);
  }
  if (extracted.tb_followup_missed) {
    lines.push('TB Follow-up Missed (टीबी फॉलो-अप छूटा)');
  }
  if (extracted.vaccination_due) {
    lines.push('Vaccination Due (टीका बाकी)');
  }
  if (extracted.vaccination_given) {
    lines.push('Vaccination Given (टीका दिया)');
  }
  if (extracted.muac_cm) {
    lines.push(`MUAC: ${extracted.muac_cm} cm`);
  }
  if (extracted.weight_kg) {
    lines.push(`Weight: ${extracted.weight_kg} kg (वजन)`);
  }
  if (extracted.gestational_weeks) {
    lines.push(`Gestational Weeks: ${extracted.gestational_weeks} (${extracted.gestational_weeks} हफ्ते)`);
  }
  if (extracted.trimester) {
    lines.push(`Trimester: ${extracted.trimester} (तिमाही)`);
  }
  if (extracted.visit_type_hint) {
    lines.push(`Suggested Visit Type: ${extracted.visit_type_hint}`);
  }

  return lines;
}
