import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { colors } from '../styles/colors';
import { spacing } from '../styles/spacing';
import { getPatientById } from '../database/patientRepository';
import { getVisitsByPatientId } from '../database/visitRepository';
import StatusBadge from '../components/StatusBadge';
import RiskBadge from '../components/RiskBadge';
import VisitCard from '../components/VisitCard';
import EmptyState from '../components/EmptyState';
import { capitalize } from '../utils/formatters';
import { formatDate } from '../utils/dateUtils';

export default function PatientDetailScreen({ route, navigation }) {
  const { patientId } = route.params;
  const [patient, setPatient] = useState(null);
  const [visits, setVisits] = useState([]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [patientId])
  );

  const loadData = async () => {
    try {
      const p = await getPatientById(patientId);
      setPatient(p);
      const v = await getVisitsByPatientId(patientId);
      setVisits(v);
    } catch (err) {
      console.error('Failed to load patient details:', err);
    }
  };

  // Determine highest risk from visits
  const highestRisk = visits.reduce((max, v) => {
    if (v.risk_level === 'high') return 'high';
    if (v.risk_level === 'medium' && max !== 'high') return 'medium';
    return max;
  }, 'none');

  if (!patient) {
    return (
      <ScrollView style={styles.container}>
        {/* Loading Skeleton */}
        <View style={styles.profileCard}>
          <View style={[styles.avatarLarge, { backgroundColor: colors.border }]} />
          <View style={{ width: 160, height: 20, backgroundColor: colors.border, borderRadius: 8, marginTop: 12 }} />
          <View style={{ width: 200, height: 14, backgroundColor: colors.divider, borderRadius: 6, marginTop: 8 }} />
          <View style={{ width: 120, height: 14, backgroundColor: colors.divider, borderRadius: 6, marginTop: 6 }} />
        </View>
        <View style={{ marginHorizontal: spacing.md, height: 48, backgroundColor: colors.border, borderRadius: 12, marginBottom: spacing.md }} />
        <View style={{ marginHorizontal: spacing.md }}>
          <View style={{ height: 16, width: 140, backgroundColor: colors.border, borderRadius: 6, marginBottom: spacing.sm }} />
          {[1,2,3].map(i => (
            <View key={i} style={{ height: 72, backgroundColor: colors.divider, borderRadius: 12, marginBottom: 8 }} />
          ))}
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* Patient Profile Card */}
      <View style={styles.profileCard}>
        <View style={styles.avatarLarge}>
          <Text style={styles.avatarText}>{patient.name?.charAt(0)?.toUpperCase()}</Text>
        </View>
        <Text style={styles.name}>{patient.name}</Text>
        <Text style={styles.details}>
          {patient.age} years • {capitalize(patient.sex)} • {patient.village}
        </Text>
        <Text style={styles.details}>📞 {patient.phone || 'N/A'}</Text>
        <Text style={styles.condition}>{capitalize(patient.condition_type)}</Text>

        <View style={styles.badgeRow}>
          <StatusBadge status={patient.sync_status} />
          {highestRisk !== 'none' && (
            <RiskBadge riskLevel={highestRisk} compact />
          )}
        </View>
      </View>

      {/* Add Visit Button */}
      <TouchableOpacity
        style={styles.addVisitButton}
        onPress={() => navigation.navigate('AddVisit', { patientId: patient.id, patientName: patient.name })}
        activeOpacity={0.8}
      >
        <Text style={styles.addVisitText}>+ Add Visit / विजिट जोड़ें</Text>
      </TouchableOpacity>

      {/* Visit History */}
      <Text style={styles.sectionTitle}>Visit History ({visits.length})</Text>
      {visits.length === 0 ? (
        <EmptyState icon="📋" title="No visits yet" message="Add the first visit for this patient" />
      ) : (
        visits.map(visit => <VisitCard key={visit.id} visit={visit} />)
      )}

      <View style={{ height: spacing.xl }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingText: {
    fontSize: 16,
    textAlign: 'center',
    marginTop: spacing.xl,
    color: colors.textSecondary,
  },
  profileCard: {
    backgroundColor: colors.surface,
    margin: spacing.md,
    padding: spacing.lg,
    borderRadius: 16,
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  avatarLarge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  avatarText: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.primary,
  },
  name: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
  },
  details: {
    fontSize: 15,
    color: colors.textSecondary,
    marginTop: 2,
  },
  condition: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '600',
    marginTop: 4,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: spacing.md,
  },
  addVisitButton: {
    backgroundColor: colors.primary,
    marginHorizontal: spacing.md,
    padding: spacing.md,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  addVisitText: {
    color: colors.textLight,
    fontSize: 16,
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
});
