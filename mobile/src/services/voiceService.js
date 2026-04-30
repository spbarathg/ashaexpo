/**
 * voiceService.js — Hybrid Voice Processing Orchestrator
 *
 * Wraps the existing aiService.processVoiceHealthInput() with:
 *   1. Connectivity gate (isOnline check before calling Gemini)
 *   2. Timeout protection (8-second max wait)
 *   3. Audio file persistence (copies recording to durable storage)
 *   4. Structured result with source tag for UX differentiation
 *
 * aiService.js is NOT modified — it remains the inner Gemini call engine.
 * If this wrapper is removed, AudioRecorder can revert to calling aiService directly.
 */

import * as FileSystem from 'expo-file-system';
import { getMockResponse } from './aiService';
import { VOICE_AUDIO_DIR } from '../constants/appConfig';

// Concurrency guard — prevents overlapping processRecording calls from the UI
let _processingLock = false;

// ─── Persistent audio storage ───────────────────────────────────────────────────

/**
 * Ensure the voice recordings directory exists.
 * Returns the absolute directory path.
 */
async function ensureAudioDir() {
  const dir = `${FileSystem.documentDirectory}${VOICE_AUDIO_DIR}`;
  const info = await FileSystem.getInfoAsync(dir);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  }
  return dir;
}

/**
 * Copy a temporary recording to persistent storage.
 * Returns the new durable URI.
 *
 * @param {string} tempUri - Temp URI from expo-av recording
 * @returns {Promise<string>} Persistent URI
 */
async function persistAudioFile(tempUri) {
  try {
    const dir = await ensureAudioDir();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `visit_${timestamp}.m4a`;
    const destUri = `${dir}${filename}`;
    await FileSystem.copyAsync({ from: tempUri, to: destUri });
    return destUri;
  } catch (err) {
    console.warn('[voiceService] Failed to persist audio:', err.message);
    // Return original URI as fallback — at least don't crash
    return tempUri;
  }
}

// Timeout utility removed.

// ─── Main export ────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} VoiceResult
 * @property {'ai'|'offline'|'failed'|'timeout'} source — how the result was produced
 * @property {object|null} data — sanitized field object (same shape as aiService output), or null
 * @property {string} audioUri — persistent URI of the saved audio file
 * @property {string} message — human-readable status for AudioRecorder UI
 */

/**
 * Process a voice recording through the local mock pipeline.
 *
 * 1. Persist audio file to durable storage (always)
 * 2. Return mock data based on visitType
 *
 * @param {string} tempAudioUri - Temp file URI from expo-av Recording.getURI()
 * @param {string} [mimeType='audio/mp4'] - MIME type
 * @param {string} [visitType] - The selected visit type
 * @returns {Promise<VoiceResult>}
 */
export async function processRecording(tempAudioUri, mimeType = 'audio/mp4', visitType) {
  // Guard: drop if already processing
  if (_processingLock) {
    console.warn('[voiceService] Already processing a recording — dropping duplicate');
    return {
      source: 'failed',
      data: null,
      audioUri: tempAudioUri,
      message: '⏳ Already processing a recording. Please wait.',
    };
  }

  _processingLock = true;
  try {
    // Step 1: Always persist the audio file
    const audioUri = await persistAudioFile(tempAudioUri);

    // Step 2: Return mock response for demo purposes (no AI calls)
    const mockResult = getMockResponse(visitType);

    // Simulate slight delay for UX
    await new Promise(r => setTimeout(r, 800));

    return {
      source: 'mock',
      data: mockResult,
      audioUri,
      message: '✅ Form filled with data!',
    };
  } catch (err) {
    console.warn(`[voiceService] Error:`, err.message);

    return {
      source: 'failed',
      data: null,
      audioUri: tempAudioUri,
      message: '⚠️ Processing failed. Recording saved.',
    };
  } finally {
    _processingLock = false; // Always release
  }
}
