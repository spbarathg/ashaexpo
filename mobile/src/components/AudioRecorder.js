import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Animated, Easing, ActivityIndicator,
} from 'react-native';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import { colors } from '../styles/colors';
import { spacing } from '../styles/spacing';
import { processRecording } from '../services/voiceService';

// ─── Recording configuration ───────────────────────────────────────────────────

const RECORDING_OPTIONS = {
  android: {
    extension: '.m4a',
    outputFormat: Audio.AndroidOutputFormat.MPEG_4,
    audioEncoder: Audio.AndroidAudioEncoder.AAC,
    sampleRate: 44100,
    numberOfChannels: 1,
    bitRate: 128000,
  },
  ios: {
    extension: '.m4a',
    outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
    audioQuality: Audio.IOSAudioQuality.HIGH,
    sampleRate: 44100,
    numberOfChannels: 1,
    bitRate: 128000,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
  web: { mimeType: 'audio/webm', bitsPerSecond: 128000 },
};

// ─── Component ──────────────────────────────────────────────────────────────────

/**
 * AudioRecorder — Expo-compatible voice recorder.
 *
 * Props:
 *   visitType                 — passed down to generate correct mock
 *   onResult(result)          — called with the sanitized response object
 *   onProcessingChange(bool)  — called when processing state changes
 */
export default function AudioRecorder({ visitType, onResult, onProcessingChange }) {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [recordingDuration, setRecordingDuration] = useState(0);

  const recordingRef = useRef(null);
  const durationTimerRef = useRef(null);

  // ── Animations ──

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const ringAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isRecording) {
      // Pulsing mic button
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.15,
            duration: 600,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 600,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      ).start();

      // Glow opacity
      Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, {
            toValue: 1,
            duration: 800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(glowAnim, {
            toValue: 0.3,
            duration: 800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      ).start();

      // Expanding ring
      Animated.loop(
        Animated.timing(ringAnim, {
          toValue: 1,
          duration: 1500,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        })
      ).start();
    } else {
      pulseAnim.stopAnimation();
      glowAnim.stopAnimation();
      ringAnim.stopAnimation();
      pulseAnim.setValue(1);
      glowAnim.setValue(0);
      ringAnim.setValue(0);
    }
  }, [isRecording]);

  // ── Cleanup ──

  useEffect(() => {
    return () => {
      if (durationTimerRef.current) clearInterval(durationTimerRef.current);
      if (recordingRef.current) {
        recordingRef.current.stopAndUnloadAsync().catch(() => {});
      }
    };
  }, []);

  // ── Processing state sync ──

  useEffect(() => {
    onProcessingChange?.(isProcessing);
  }, [isProcessing]);

  // ── Duration formatter ──

  const formatDuration = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // ── Start recording ──

  const startRecording = async () => {
    try {
      setStatusText('Requesting permission...');

      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        setStatusText('⚠️ Microphone permission denied');
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync(RECORDING_OPTIONS);
      await recording.startAsync();

      recordingRef.current = recording;
      setIsRecording(true);
      setRecordingDuration(0);
      setStatusText('🎙️ Listening... Tap to stop');

      // Duration timer
      durationTimerRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('[AudioRecorder] startRecording failed:', err);
      setStatusText('⚠️ Could not start recording');
      setIsRecording(false);
    }
  };

  // ── Stop recording + process ──

  const stopRecording = async () => {
    if (!recordingRef.current) return;

    // Stop duration timer
    if (durationTimerRef.current) {
      clearInterval(durationTimerRef.current);
      durationTimerRef.current = null;
    }

    setIsRecording(false);
    setIsProcessing(true);
    setStatusText('⏳ Processing recording...');

    try {
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;

      if (!uri) {
        setStatusText('⚠️ Recording file not found');
        setIsProcessing(false);
        return;
      }

      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });

      // Process through hybrid voice service (handles connectivity + persistence + mock)
      setStatusText('⏳ Processing recording...');
      const result = await processRecording(uri, 'audio/mp4', visitType);

      // Use the service-provided status message
      setStatusText(result.message);

      // Deliver data if available
      if (result.data && Object.keys(result.data).length > 0) {
        onResult?.(result.data);
      }
    } catch (err) {
      console.error('[AudioRecorder] stopRecording/process failed:', err);
      setStatusText('⚠️ Processing failed — recording saved');
    } finally {
      setIsProcessing(false);
    }
  };

  // ── Tap handler ──

  const handlePress = () => {
    if (isProcessing) return;
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  // ── Derived animation values ──

  const ringScale = ringAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 2.2],
  });
  const ringOpacity = ringAnim.interpolate({
    inputRange: [0, 0.7, 1],
    outputRange: [0.5, 0.15, 0],
  });

  // ── Render ──

  return (
    <View style={s.wrapper}>
      {/* Recording ring animation */}
      {isRecording && (
        <Animated.View
          style={[
            s.ring,
            {
              transform: [{ scale: ringScale }],
              opacity: ringOpacity,
            },
          ]}
        />
      )}

      {/* Glow backdrop */}
      {isRecording && (
        <Animated.View
          style={[
            s.glow,
            { opacity: glowAnim },
          ]}
        />
      )}

      {/* Main mic button */}
      <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
        <TouchableOpacity
          style={[
            s.micButton,
            isRecording && s.micButtonRecording,
            isProcessing && s.micButtonProcessing,
          ]}
          onPress={handlePress}
          disabled={isProcessing}
          activeOpacity={0.7}
        >
          {isProcessing ? (
            <ActivityIndicator size="large" color={colors.textLight} />
          ) : (
            <Text style={s.micIcon}>{isRecording ? '⏹️' : '🎙️'}</Text>
          )}
        </TouchableOpacity>
      </Animated.View>

      {/* Duration badge */}
      {isRecording && (
        <View style={s.durationBadge}>
          <View style={s.redDot} />
          <Text style={s.durationText}>{formatDuration(recordingDuration)}</Text>
        </View>
      )}

      {/* Status text */}
      {statusText ? (
        <Text style={[s.status, isProcessing && s.statusProcessing]}>
          {statusText}
        </Text>
      ) : (
        <Text style={s.hint}>
          🎙️ Tap to record patient visit / विजिट रिकॉर्ड करें
        </Text>
      )}

      {/* Removed AI branding line */}
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────────

const MIC_SIZE = 72;
const GLOW_SIZE = MIC_SIZE + 32;
const RING_SIZE = MIC_SIZE + 16;

const s = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
    marginBottom: spacing.md,
    position: 'relative',
  },

  // ── Ring animation ──
  ring: {
    position: 'absolute',
    width: RING_SIZE,
    height: RING_SIZE,
    borderRadius: RING_SIZE / 2,
    borderWidth: 2.5,
    borderColor: colors.riskHigh,
    top: spacing.lg + (MIC_SIZE - RING_SIZE) / 2,
  },

  // ── Glow ──
  glow: {
    position: 'absolute',
    width: GLOW_SIZE,
    height: GLOW_SIZE,
    borderRadius: GLOW_SIZE / 2,
    backgroundColor: colors.riskHigh + '25',
    top: spacing.lg + (MIC_SIZE - GLOW_SIZE) / 2,
  },

  // ── Mic button ──
  micButton: {
    width: MIC_SIZE,
    height: MIC_SIZE,
    borderRadius: MIC_SIZE / 2,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    // Shadow
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  micButtonRecording: {
    backgroundColor: colors.riskHigh,
    shadowColor: colors.riskHigh,
  },
  micButtonProcessing: {
    backgroundColor: colors.info,
    shadowColor: colors.info,
    opacity: 0.85,
  },
  micIcon: {
    fontSize: 30,
  },

  // ── Duration badge ──
  durationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.riskHigh + '18',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    marginTop: 10,
  },
  redDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.riskHigh,
    marginRight: 6,
  },
  durationText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.riskHigh,
    fontVariant: ['tabular-nums'],
  },

  // ── Status text ──
  status: {
    marginTop: 10,
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'center',
    paddingHorizontal: spacing.md,
  },
  statusProcessing: {
    color: colors.info,
  },
  hint: {
    marginTop: 10,
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
  },

  // ── AI branding ──
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    opacity: 0.6,
  },
  brandText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
  },
  brandDot: {
    fontSize: 11,
    color: colors.textMuted,
    marginHorizontal: 4,
  },
  brandSub: {
    fontSize: 11,
    color: colors.textSecondary,
  },
});
