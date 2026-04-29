/**
 * seedFirestore.js — Pre-seed Firestore with demo data for hackathon presentation.
 * 
 * Run once before demo:   node seedFirestore.js
 * 
 * Creates: 4 villages × 3 patients, 16 visits with risk flags, 8 alerts.
 * All data uses realistic Indian names, Hindi notes, and medically plausible values.
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: '799528678b4e1cdc6b508f8cd1a6ec0823ff546d',
  authDomain: 'ashaaurora-18558.firebaseapp.com',
  projectId: 'ashaaurora-18558',
  storageBucket: 'ashaaurora-18558.firebasestorage.app',
  messagingSenderId: '111092307501516679280',
  appId: '1:111092307501516679280:web:fca8866f85231799b2b336',
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ── Helpers ──
function id() { return 'demo-' + Math.random().toString(36).substr(2, 12); }
function daysAgo(n) { return new Date(Date.now() - n * 86400000).toISOString(); }

// ── Patients ──
const patients = [
  // Rampur
  { id: 'p-sunita',    name: 'Sunita Devi',     age: 24, sex: 'female', village: 'Rampur',    phone: '9876543210', asha_id: 'ASHA-001', condition_type: 'pregnancy', created_at: daysAgo(30) },
  { id: 'p-ramu',      name: 'Ramu Prasad',     age: 45, sex: 'male',   village: 'Rampur',    phone: '9876543211', asha_id: 'ASHA-001', condition_type: 'tb',        created_at: daysAgo(28) },
  { id: 'p-anita',     name: 'Anita Kumari',    age: 28, sex: 'female', village: 'Rampur',    phone: '9876543212', asha_id: 'ASHA-001', condition_type: 'pregnancy', created_at: daysAgo(25) },
  // Sundarpur
  { id: 'p-priya',     name: 'Priya Sharma',    age: 18, sex: 'female', village: 'Sundarpur', phone: '9876543220', asha_id: 'ASHA-002', condition_type: 'pregnancy', created_at: daysAgo(20) },
  { id: 'p-rahul',     name: 'Rahul (3 yrs)',   age: 3,  sex: 'male',   village: 'Sundarpur', phone: '9876543221', asha_id: 'ASHA-002', condition_type: 'child',     created_at: daysAgo(18) },
  { id: 'p-meena',     name: 'Meena Devi',      age: 30, sex: 'female', village: 'Sundarpur', phone: '9876543222', asha_id: 'ASHA-002', condition_type: 'pregnancy', created_at: daysAgo(15) },
  // Mohanganj
  { id: 'p-kamla',     name: 'Kamla Bai',       age: 35, sex: 'female', village: 'Mohanganj', phone: '9876543230', asha_id: 'ASHA-003', condition_type: 'tb',        created_at: daysAgo(22) },
  { id: 'p-arjun',     name: 'Arjun (2 yrs)',   age: 2,  sex: 'male',   village: 'Mohanganj', phone: '9876543231', asha_id: 'ASHA-003', condition_type: 'child',     created_at: daysAgo(19) },
  { id: 'p-sita',      name: 'Sita Gupta',      age: 22, sex: 'female', village: 'Mohanganj', phone: '9876543232', asha_id: 'ASHA-003', condition_type: 'general',   created_at: daysAgo(12) },
  // Lakshmipur
  { id: 'p-geeta',     name: 'Geeta Devi',      age: 26, sex: 'female', village: 'Lakshmipur',phone: '9876543240', asha_id: 'ASHA-004', condition_type: 'pregnancy', created_at: daysAgo(14) },
  { id: 'p-bablu',     name: 'Bablu (1 yr)',    age: 1,  sex: 'male',   village: 'Lakshmipur',phone: '9876543241', asha_id: 'ASHA-004', condition_type: 'child',     created_at: daysAgo(10) },
  { id: 'p-rekha',     name: 'Rekha Yadav',     age: 32, sex: 'female', village: 'Lakshmipur',phone: '9876543242', asha_id: 'ASHA-004', condition_type: 'general',   created_at: daysAgo(8)  },
];

// ── Visits ──
const visits = [
  // Sunita — HIGH RISK: severe hypertension + bleeding
  { id: 'v-sunita-1', patient_id: 'p-sunita', visit_type: 'ANC', bp_systolic: 165, bp_diastolic: 112, weight_kg: 52, gestational_weeks: 32, trimester: 3, bleeding: 1, seizure: 0, breathlessness: 0, vaccination_due: 0, vaccination_given: 0, tb_followup_missed: 0, tb_cough_weeks: null, postnatal_day: null, temperature_c: null, muac_cm: null, risk_level: 'high', risk_flags: JSON.stringify(['SEVERE_HYPERTENSION','BLEEDING_PREGNANCY']), raw_note: 'BP bahut zyada hai 165/112, khoon bhi aa raha hai. Turant hospital bhejein.', created_at: daysAgo(2), village: 'Rampur', patient_name: 'Sunita Devi' },
  // Sunita — earlier normal visit
  { id: 'v-sunita-2', patient_id: 'p-sunita', visit_type: 'ANC', bp_systolic: 120, bp_diastolic: 78, weight_kg: 50, gestational_weeks: 28, trimester: 3, bleeding: 0, seizure: 0, breathlessness: 0, vaccination_due: 0, vaccination_given: 0, tb_followup_missed: 0, tb_cough_weeks: null, postnatal_day: null, temperature_c: null, muac_cm: null, risk_level: 'none', risk_flags: '[]', raw_note: 'Normal visit. BP 120/78, sab theek.', created_at: daysAgo(14), village: 'Rampur', patient_name: 'Sunita Devi' },
  // Ramu — HIGH RISK: TB followup missed
  { id: 'v-ramu-1', patient_id: 'p-ramu', visit_type: 'TB Follow-up', bp_systolic: null, bp_diastolic: null, weight_kg: 48, gestational_weeks: null, trimester: null, bleeding: 0, seizure: 0, breathlessness: 0, vaccination_due: 0, vaccination_given: 0, tb_followup_missed: 1, tb_cough_weeks: 6, postnatal_day: null, temperature_c: 38.2, muac_cm: null, risk_level: 'high', risk_flags: JSON.stringify(['TB_FOLLOWUP_MISSED','TB_COUGH_SCREENING_DUE']), raw_note: 'TB follow-up miss ho gaya, 6 hafte se khansi, bukhar 38.2.', created_at: daysAgo(1), village: 'Rampur', patient_name: 'Ramu Prasad' },
  // Anita — medium: high BP in pregnancy
  { id: 'v-anita-1', patient_id: 'p-anita', visit_type: 'ANC', bp_systolic: 145, bp_diastolic: 92, weight_kg: 58, gestational_weeks: 20, trimester: 2, bleeding: 0, seizure: 0, breathlessness: 0, vaccination_due: 0, vaccination_given: 0, tb_followup_missed: 0, tb_cough_weeks: null, postnatal_day: null, temperature_c: null, muac_cm: null, risk_level: 'medium', risk_flags: JSON.stringify(['HIGH_BP_PREGNANCY']), raw_note: 'BP thoda zyada 145/92. Monitoring mein rakhein.', created_at: daysAgo(3), village: 'Rampur', patient_name: 'Anita Kumari' },
  // Priya — HIGH: teen pregnancy + high BP
  { id: 'v-priya-1', patient_id: 'p-priya', visit_type: 'ANC', bp_systolic: 142, bp_diastolic: 91, weight_kg: 45, gestational_weeks: 16, trimester: 2, bleeding: 0, seizure: 0, breathlessness: 0, vaccination_due: 0, vaccination_given: 0, tb_followup_missed: 0, tb_cough_weeks: null, postnatal_day: null, temperature_c: null, muac_cm: null, risk_level: 'medium', risk_flags: JSON.stringify(['TEEN_PREGNANCY','HIGH_BP_PREGNANCY']), raw_note: 'Ladki ki umr 18 saal, BP 142/91. Bahut dhyan rakhna hoga.', created_at: daysAgo(4), village: 'Sundarpur', patient_name: 'Priya Sharma' },
  // Rahul — HIGH: child with danger fever + breathlessness + malnutrition
  { id: 'v-rahul-1', patient_id: 'p-rahul', visit_type: 'Child', bp_systolic: null, bp_diastolic: null, weight_kg: 9, gestational_weeks: null, trimester: null, bleeding: 0, seizure: 0, breathlessness: 1, vaccination_due: 1, vaccination_given: 0, tb_followup_missed: 0, tb_cough_weeks: null, postnatal_day: null, temperature_c: 40.1, muac_cm: 10.5, risk_level: 'high', risk_flags: JSON.stringify(['DANGER_FEVER','BREATHLESSNESS_CHILD','SEVERE_MALNUTRITION','VACCINATION_OVERDUE']), raw_note: 'Bachche ko tez bukhar 40.1, saans ki taklif, MUAC 10.5 cm. Tika baaki.', created_at: daysAgo(1), village: 'Sundarpur', patient_name: 'Rahul (3 yrs)' },
  // Meena — normal
  { id: 'v-meena-1', patient_id: 'p-meena', visit_type: 'ANC', bp_systolic: 118, bp_diastolic: 75, weight_kg: 55, gestational_weeks: 12, trimester: 1, bleeding: 0, seizure: 0, breathlessness: 0, vaccination_due: 0, vaccination_given: 0, tb_followup_missed: 0, tb_cough_weeks: null, postnatal_day: null, temperature_c: null, muac_cm: null, risk_level: 'none', risk_flags: '[]', raw_note: 'Normal ANC visit. Pehla trimester, sab theek hai.', created_at: daysAgo(5), village: 'Sundarpur', patient_name: 'Meena Devi' },
  // Kamla — medium: TB cough screening
  { id: 'v-kamla-1', patient_id: 'p-kamla', visit_type: 'TB Follow-up', bp_systolic: null, bp_diastolic: null, weight_kg: 42, gestational_weeks: null, trimester: null, bleeding: 0, seizure: 0, breathlessness: 0, vaccination_due: 0, vaccination_given: 0, tb_followup_missed: 0, tb_cough_weeks: 3, postnatal_day: null, temperature_c: null, muac_cm: null, risk_level: 'medium', risk_flags: JSON.stringify(['TB_COUGH_SCREENING_DUE']), raw_note: '3 hafte se khansi, sputum test karana hoga.', created_at: daysAgo(3), village: 'Mohanganj', patient_name: 'Kamla Bai' },
  // Arjun — HIGH: child seizure
  { id: 'v-arjun-1', patient_id: 'p-arjun', visit_type: 'Child', bp_systolic: null, bp_diastolic: null, weight_kg: 8, gestational_weeks: null, trimester: null, bleeding: 0, seizure: 1, breathlessness: 0, vaccination_due: 1, vaccination_given: 0, tb_followup_missed: 0, tb_cough_weeks: null, postnatal_day: null, temperature_c: 39.6, muac_cm: 12.0, risk_level: 'high', risk_flags: JSON.stringify(['SEIZURE','DANGER_FEVER','VACCINATION_OVERDUE']), raw_note: 'Bachche ko dora padha aur tez bukhar 39.6. Tika baaki hai.', created_at: daysAgo(1), village: 'Mohanganj', patient_name: 'Arjun (2 yrs)' },
  // Sita — vaccination visit (normal)
  { id: 'v-sita-1', patient_id: 'p-sita', visit_type: 'Vaccination', bp_systolic: null, bp_diastolic: null, weight_kg: null, gestational_weeks: null, trimester: null, bleeding: 0, seizure: 0, breathlessness: 0, vaccination_due: 1, vaccination_given: 1, tb_followup_missed: 0, tb_cough_weeks: null, postnatal_day: null, temperature_c: 36.8, muac_cm: null, risk_level: 'none', risk_flags: '[]', raw_note: 'Tika lagaya gaya. Sab normal.', created_at: daysAgo(6), village: 'Mohanganj', patient_name: 'Sita Gupta' },
  // Geeta — HIGH: ANC with bleeding + seizure
  { id: 'v-geeta-1', patient_id: 'p-geeta', visit_type: 'ANC', bp_systolic: 155, bp_diastolic: 100, weight_kg: 60, gestational_weeks: 36, trimester: 3, bleeding: 1, seizure: 1, breathlessness: 0, vaccination_due: 0, vaccination_given: 0, tb_followup_missed: 0, tb_cough_weeks: null, postnatal_day: null, temperature_c: null, muac_cm: null, risk_level: 'high', risk_flags: JSON.stringify(['BLEEDING_PREGNANCY','SEIZURE','HIGH_BP_PREGNANCY']), raw_note: 'Khoon aur dora dono. BP 155/100. Emergency referral zaroori.', created_at: daysAgo(0), village: 'Lakshmipur', patient_name: 'Geeta Devi' },
  // Bablu — medium: child with fever + vaccination overdue
  { id: 'v-bablu-1', patient_id: 'p-bablu', visit_type: 'Child', bp_systolic: null, bp_diastolic: null, weight_kg: 7, gestational_weeks: null, trimester: null, bleeding: 0, seizure: 0, breathlessness: 0, vaccination_due: 1, vaccination_given: 0, tb_followup_missed: 0, tb_cough_weeks: null, postnatal_day: null, temperature_c: 38.5, muac_cm: 12.5, risk_level: 'medium', risk_flags: JSON.stringify(['FEVER','VACCINATION_OVERDUE']), raw_note: 'Halka bukhar 38.5. Tika lagwana hai.', created_at: daysAgo(2), village: 'Lakshmipur', patient_name: 'Bablu (1 yr)' },
  // Rekha — postnatal, medium
  { id: 'v-rekha-1', patient_id: 'p-rekha', visit_type: 'Postnatal', bp_systolic: 130, bp_diastolic: 85, weight_kg: 55, gestational_weeks: null, trimester: null, bleeding: 0, seizure: 0, breathlessness: 0, vaccination_due: 0, vaccination_given: 0, tb_followup_missed: 0, tb_cough_weeks: null, postnatal_day: 4, temperature_c: null, muac_cm: null, risk_level: 'medium', risk_flags: JSON.stringify(['POSTPARTUM_FOLLOW_UP_MISSED']), raw_note: 'Delivery ke 4 din baad visit. BP 130/85. Follow-up zaroori.', created_at: daysAgo(3), village: 'Lakshmipur', patient_name: 'Rekha Yadav' },
];

// ── Alerts (only for medium/high risk visits) ──
const alerts = visits
  .filter(v => v.risk_level === 'high' || v.risk_level === 'medium')
  .map(v => ({
    id: 'a-' + v.id.replace('v-', ''),
    visit_id: v.id,
    patient_id: v.patient_id,
    patient_name: v.patient_name,
    village: v.village,
    risk_flags: v.risk_flags,
    risk_level: v.risk_level,
    status: 'sent',
    doctor_notified: false,
    created_at: v.created_at,
    asha_phone: patients.find(p => p.id === v.patient_id)?.phone || '',
  }));

// ── Seed function ──
async function seed() {
  console.log('🌱 Seeding Firestore with demo data...\n');

  console.log(`  📋 ${patients.length} patients...`);
  for (const p of patients) {
    await setDoc(doc(db, 'patients', p.id), { ...p, sync_status: 'synced' });
  }

  console.log(`  🏥 ${visits.length} visits...`);
  for (const v of visits) {
    await setDoc(doc(db, 'visits', v.id), { ...v, sync_status: 'synced' });
  }

  console.log(`  🚨 ${alerts.length} alerts...`);
  for (const a of alerts) {
    await setDoc(doc(db, 'alerts', a.id), a);
  }

  console.log('\n✅ Firestore seeded successfully!');
  console.log(`   ${patients.length} patients • ${visits.length} visits • ${alerts.length} alerts`);
  console.log('   Villages: Rampur, Sundarpur, Mohanganj, Lakshmipur\n');
  process.exit(0);
}

seed().catch(err => {
  console.error('❌ Seeding failed:', err);
  process.exit(1);
});
