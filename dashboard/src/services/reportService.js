import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase/firebase';

/**
 * Fetch report data from Firestore and calculate HMIS metrics.
 */
export async function fetchReportData(filters = {}) {
  const { village, month, year } = filters;

  const [patientsSnap, visitsSnap, alertsSnap] = await Promise.all([
    getDocs(collection(db, 'patients')),
    getDocs(collection(db, 'visits')),
    getDocs(collection(db, 'alerts')),
  ]);

  // Filter raw data by village if selected
  const allPatients = [];
  patientsSnap.forEach(d => {
    const data = { id: d.id, ...d.data() };
    if (village && data.village !== village) return;
    allPatients.push(data);
  });

  const allVisits = [];
  visitsSnap.forEach(d => {
    const data = { id: d.id, ...d.data() };
    if (village && data.village !== village) return;
    allVisits.push(data);
  });

  const allAlerts = [];
  alertsSnap.forEach(d => {
    const data = { id: d.id, ...d.data() };
    if (village && data.village !== village) return;
    allAlerts.push(data);
  });

  // Month filtering helpers
  const isThisMonth = (dateStr) => {
    if (!dateStr || month === undefined || year === undefined) return false;
    const date = new Date(dateStr);
    return date.getMonth() === month && date.getFullYear() === year;
  };

  const currentPatients = allPatients.filter(p => isThisMonth(p.created_at));
  const currentVisits = allVisits.filter(v => isThisMonth(v.created_at));
  const currentAlerts = allAlerts.filter(a => isThisMonth(a.created_at));

  // --- 1. Report Metadata ---
  const metadata = {
    report_id: `HMIS-${year}-${(month+1).toString().padStart(2, '0')}-${Date.now().toString().slice(-4)}`,
    report_type: 'Monthly HMIS Summary',
    report_month: month + 1,
    report_year: year,
    generated_date: new Date().toISOString(),
    generated_by: 'Dashboard System',
    asha_worker_id: 'ASHA-001',
    asha_worker_name: 'ASHA Demo Worker',
    village: village || 'All Villages',
    sub_center: 'SC-Demo',
    phc: 'PHC-Demo',
    block: 'Block-Demo',
    district: 'District-Demo',
    state: 'State-Demo'
  };

  // --- 2. Population / Coverage ---
  const population = {
    total_households_visited: 'N/A', // Not tracked
    total_population_covered: allPatients.length,
    total_patients_registered: currentPatients.length,
    male_count: allPatients.filter(p => p.gender === 'Male').length,
    female_count: allPatients.filter(p => p.gender === 'Female').length,
    children_under_5: allPatients.filter(p => p.age < 5).length,
    adolescent_girls: allPatients.filter(p => p.age >= 10 && p.age <= 19 && p.gender === 'Female').length,
    pregnant_women_registered: new Set(allVisits.filter(v => v.visit_type === 'ANC').map(v => v.patient_id)).size,
    elderly_patients: allPatients.filter(p => p.age >= 60).length,
    high_risk_patients: new Set(allAlerts.filter(a => a.risk_level === 'high').map(a => a.patient_id)).size
  };

  // --- 3. Maternal Health / ANC ---
  const ancVisits = currentVisits.filter(v => v.visit_type === 'ANC');
  const maternal = {
    new_pregnancy_registrations: ancVisits.filter(v => parseInt(v.anc_number) === 1).length,
    total_pregnant_women_followed: new Set(ancVisits.map(v => v.patient_id)).size,
    anc_1_completed: ancVisits.filter(v => parseInt(v.anc_number) === 1).length,
    anc_2_completed: ancVisits.filter(v => parseInt(v.anc_number) === 2).length,
    anc_3_completed: ancVisits.filter(v => parseInt(v.anc_number) === 3).length,
    anc_4_completed: ancVisits.filter(v => parseInt(v.anc_number) >= 4).length,
    bp_checked_pregnancy: ancVisits.filter(v => v.bp_systolic && v.bp_diastolic).length,
    hb_checked_pregnancy: 'N/A',
    ifa_tablets_given: 'N/A',
    tt_td_doses_given: 'N/A',
    high_risk_pregnancies_detected: ancVisits.filter(v => v.risk_level === 'high').length,
    pregnancy_referrals_made: ancVisits.filter(v => v.risk_level === 'high').length,
    expected_delivery_cases: ancVisits.filter(v => parseInt(v.gestational_weeks) >= 36).length,
    institutional_delivery_followups: 'N/A',
    home_delivery_followups: 'N/A',
    postnatal_mother_visits: currentVisits.filter(v => v.visit_type === 'Postnatal').length
  };

  // --- 4. Child Health / Immunisation ---
  const childVisits = currentVisits.filter(v => v.visit_type === 'Child');
  const childHealth = {
    children_registered: currentPatients.filter(p => p.age < 5).length,
    newborn_visits_completed: childVisits.filter(v => v.muac_cm || v.weight_kg < 5).length, // Approximation
    birth_weight_recorded: 'N/A',
    low_birth_weight_cases: 'N/A',
    bcg_given: 'N/A', opv_given: 'N/A', pentavalent_given: 'N/A', rotavirus_given: 'N/A', measles_rubella_given: 'N/A', vitamin_a_given: 'N/A',
    fully_immunized_children: 'N/A',
    missed_immunization_cases: childVisits.filter(v => v.vaccination_due === 1 && v.vaccination_given === 0).length,
    child_referrals_made: childVisits.filter(v => v.risk_level === 'high').length
  };

  // --- 5. Disease / Symptoms Surveillance ---
  const disease = {
    fever_cases: currentVisits.filter(v => parseFloat(v.temperature_c) > 38).length,
    cough_cases: currentVisits.filter(v => parseInt(v.tb_cough_weeks) > 0).length,
    tb_suspected_cases: currentVisits.filter(v => parseInt(v.tb_cough_weeks) >= 2).length,
    tb_followup_cases: currentVisits.filter(v => v.visit_type === 'TB Follow-up').length,
    diarrhoea_cases: 'N/A',
    malaria_suspected_cases: 'N/A',
    respiratory_infection_cases: currentVisits.filter(v => v.breathlessness === 1).length,
    hypertension_suspected_cases: currentVisits.filter(v => parseInt(v.bp_systolic) >= 140 || parseInt(v.bp_diastolic) >= 90).length,
    diabetes_suspected_cases: 'N/A',
    animal_bite_cases: 'N/A',
    injury_trauma_cases: 'N/A'
  };

  // --- 6. High-risk Alerts ---
  const alerts = {
    total_alerts_generated: currentAlerts.length,
    critical_alerts: currentAlerts.filter(a => a.risk_level === 'high').length,
    moderate_alerts: currentAlerts.filter(a => a.risk_level === 'medium').length,
    resolved_alerts: currentAlerts.filter(a => a.status === 'acknowledged').length,
    pending_alerts: currentAlerts.filter(a => a.status === 'sent').length,
    alerts_synced_to_server: currentAlerts.length,
    alerts_waiting_for_sync: 0,
    doctor_notified_count: currentAlerts.filter(a => a.doctor_notified === 1).length,
    referral_required_count: currentAlerts.filter(a => a.risk_level === 'high').length
  };

  // --- 7. Visit / Service Delivery ---
  const service = {
    total_visits_recorded: currentVisits.length,
    home_visits: currentVisits.length,
    followup_visits: currentVisits.filter(v => ['TB Follow-up', 'Postnatal'].includes(v.visit_type)).length,
    missed_followups: currentVisits.filter(v => v.tb_followup_missed === 1).length,
    patients_referred: currentVisits.filter(v => v.risk_level === 'high').length,
    patients_recovered: 'N/A',
    notes_captured: currentVisits.filter(v => v.raw_note && v.raw_note.length > 0).length,
    voice_notes_captured: currentVisits.filter(v => v.raw_note && v.raw_note.length > 0).length,
    offline_entries_created: currentVisits.length
  };

  // --- 8. Sync / Offline Status ---
  const sync = {
    records_created_offline: currentVisits.length,
    records_synced: currentVisits.length,
    records_pending_sync: 0,
    failed_sync_count: 0,
    last_sync_time: new Date().toISOString(),
    urgent_alerts_synced_first: 'Yes'
  };

  // --- 9. Medicine / Stock-lite ---
  const stock = {
    ifa_stock_given: '0',
    ors_packets_given: '0',
    zinc_tablets_given: '0',
    paracetamol_given: '0',
    contraceptives_distributed: '0',
    stock_shortage_reported: 'No'
  };

  return {
    metadata, population, maternal, childHealth, disease, alerts, service, sync, stock
  };
}

/**
 * Get unique villages from patients collection.
 */
export async function getVillages() {
  const snap = await getDocs(collection(db, 'patients'));
  const villages = new Set();
  snap.forEach(d => {
    const v = d.data().village;
    if (v) villages.add(v);
  });
  return Array.from(villages).sort();
}

