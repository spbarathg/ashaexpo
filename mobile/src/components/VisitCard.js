import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../styles/colors';
import { spacing } from '../styles/spacing';
import RiskBadge from './RiskBadge';
import { formatBP, formatTemp } from '../utils/formatters';
import { formatDateTime } from '../utils/dateUtils';
import { capitalize } from '../utils/formatters';

export default function VisitCard({ visit }) {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.type}>{visit.visit_type}</Text>
        <Text style={styles.date}>{formatDateTime(visit.created_at)}</Text>
      </View>

      {(visit.bp_systolic || visit.bp_diastolic) && (
        <Text style={styles.detail}>BP: {formatBP(visit.bp_systolic, visit.bp_diastolic)}</Text>
      )}
      {visit.temperature_c ? (
        <Text style={styles.detail}>Temp: {formatTemp(visit.temperature_c)}</Text>
      ) : null}
      {visit.muac_cm ? (
        <Text style={styles.detail}>MUAC: {visit.muac_cm} cm</Text>
      ) : null}
      {visit.bleeding ? <Text style={styles.flag}>🩸 Bleeding</Text> : null}
      {visit.seizure ? <Text style={styles.flag}>⚡ Seizure</Text> : null}
      {visit.breathlessness ? <Text style={styles.flag}>😮‍💨 Breathlessness</Text> : null}
      {visit.raw_note ? (
        <Text style={styles.note} numberOfLines={2}>📝 {visit.raw_note}</Text>
      ) : null}

      {visit.risk_level && visit.risk_level !== 'none' && (
        <View style={styles.riskRow}>
          <RiskBadge riskLevel={visit.risk_level} compact />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  type: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.primary,
  },
  date: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  detail: {
    fontSize: 14,
    color: colors.text,
    marginTop: 2,
  },
  flag: {
    fontSize: 14,
    color: colors.riskHigh,
    marginTop: 2,
    fontWeight: '500',
  },
  note: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 4,
    fontStyle: 'italic',
  },
  riskRow: {
    marginTop: spacing.sm,
  },
});
