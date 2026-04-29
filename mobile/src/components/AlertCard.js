import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../styles/colors';
import { spacing } from '../styles/spacing';
import RiskBadge from './RiskBadge';
import { formatRiskFlags } from '../utils/formatters';
import { formatDateTime } from '../utils/dateUtils';

export default function AlertCard({ alert }) {
  let flags = [];
  try {
    flags = typeof alert.risk_flags === 'string' ? JSON.parse(alert.risk_flags) : alert.risk_flags || [];
  } catch { flags = []; }

  return (
    <View style={[styles.card, alert.risk_level === 'high' && styles.highCard]}>
      <View style={styles.header}>
        <RiskBadge riskLevel={alert.risk_level} compact />
        <Text style={styles.date}>{formatDateTime(alert.created_at)}</Text>
      </View>
      <Text style={styles.name}>{alert.patient_name}</Text>
      <Text style={styles.village}>📍 {alert.village}</Text>
      {flags.length > 0 && (
        <View style={styles.flagsContainer}>
          {flags.map((flag, idx) => (
            <View key={idx} style={styles.flagPill}>
              <Text style={styles.flagText}>{flag.replace(/_/g, ' ')}</Text>
            </View>
          ))}
        </View>
      )}
      <Text style={styles.status}>
        Status: {alert.status === 'acknowledged' ? '✅ Acknowledged' : '⏳ Pending'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderLeftWidth: 4,
    borderLeftColor: colors.riskMedium,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  highCard: {
    borderLeftColor: colors.riskHigh,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  name: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.text,
    marginTop: 4,
  },
  village: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 2,
  },
  date: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  flagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: spacing.sm,
    gap: 6,
  },
  flagPill: {
    backgroundColor: colors.riskHigh + '15',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  flagText: {
    fontSize: 11,
    color: colors.riskHigh,
    fontWeight: '600',
  },
  status: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
});
