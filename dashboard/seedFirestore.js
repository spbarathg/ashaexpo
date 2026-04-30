import { initializeApp } from 'firebase/app';
import { getFirestore, collection, writeBatch, doc, getDocs } from 'firebase/firestore';

// Firebase config
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

// Simple ID generator
const genId = () => Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

// Known Villages from heatmapService.js
const VILLAGES = [
  'Rampur', 'Sundarpur', 'Mohanganj', 'Lakshmipur',
  'Keshavnagar', 'Devipatan', 'Chandrapur', 'Sitamarhi'
];

const NAMES = ['Sunita', 'Kamla', 'Ramu', 'Shanti', 'Anita', 'Rajesh', 'Priya', 'Meena', 'Ramesh', 'Sita', 'Kiran', 'Laxmi', 'Suresh', 'Vikram', 'Pooja'];
const SURNAMES = ['Devi', 'Kumar', 'Singh', 'Sharma', 'Verma', 'Yadav', 'Gupta', 'Patel'];

const VISIT_TYPES = ['ANC', 'Child', 'TB Follow-up', 'Postnatal', 'Vaccination', 'General'];

function randomDate(start, end) {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime())).toISOString();
}

async function clearCollection(collName) {
  console.log(`Clearing collection: ${collName}...`);
  const snapshot = await getDocs(collection(db, collName));
  const batch = writeBatch(db);
  snapshot.docs.forEach((document) => {
    batch.delete(document.ref);
  });
  if (snapshot.size > 0) {
    await batch.commit();
  }
}

async function seedData() {
  try {
    await clearCollection('alerts');
    await clearCollection('visits');
    await clearCollection('patients');

    console.log('Generating scalable demo dataset...');

    const patients = [];
    const visits = [];
    const alerts = [];

    // Generate 120 patients
    for (let i = 0; i < 120; i++) {
      const pId = genId();
      const village = VILLAGES[i % VILLAGES.length];
      const name = `${NAMES[Math.floor(Math.random() * NAMES.length)]} ${SURNAMES[Math.floor(Math.random() * SURNAMES.length)]}`;
      const isPregnant = Math.random() < 0.3;
      
      patients.push({
        id: pId,
        name: name,
        age: Math.floor(Math.random() * 50) + 18,
        gender: isPregnant ? 'Female' : (Math.random() > 0.5 ? 'Male' : 'Female'),
        village: village,
        asha_id: 'ASHA-001',
        created_at: randomDate(new Date(2025, 0, 1), new Date()),
        synced: 1,
      });

      // Generate 1-4 visits per patient
      const numVisits = Math.floor(Math.random() * 4) + 1;
      
      for (let j = 0; j < numVisits; j++) {
        const vId = genId();
        let vType = VISIT_TYPES[Math.floor(Math.random() * VISIT_TYPES.length)];
        if (isPregnant) vType = 'ANC';
        
        let riskLevel = 'none';
        let flags = [];
        
        // Add random risks to show scalable heatmap
        if (Math.random() < 0.15) {
          riskLevel = 'high';
          flags.push(Math.random() > 0.5 ? 'bleeding' : 'seizure');
        } else if (Math.random() < 0.25) {
          riskLevel = 'medium';
          if (vType === 'TB Follow-up') flags.push('tb_followup_missed');
          else if (vType === 'Vaccination') flags.push('vaccination_due');
          else flags.push('breathlessness');
        }

        visits.push({
          id: vId,
          patient_id: pId,
          village: village,
          visit_type: vType,
          risk_level: riskLevel,
          risk_flags: JSON.stringify(flags),
          tb_followup_missed: flags.includes('tb_followup_missed') ? 1 : 0,
          vaccination_due: flags.includes('vaccination_due') ? 1 : 0,
          vaccination_given: 0,
          raw_note: 'Generated demo note for scalable demo.',
          created_at: randomDate(new Date(2026, 3, 1), new Date()),
        });

        // Generate alerts for high/medium risks
        if (riskLevel === 'high' || riskLevel === 'medium') {
          alerts.push({
            id: genId(),
            visit_id: vId,
            patient_id: pId,
            patient_name: name,
            village: village,
            risk_level: riskLevel,
            risk_flags: flags,
            status: Math.random() > 0.4 ? 'sent' : 'acknowledged', // leave many active to show up
            doctor_notified: Math.random() > 0.8 ? 1 : 0,
            created_at: randomDate(new Date(2026, 3, 1), new Date()),
          });
        }
      }
    }

    // Write in batches of 400 max (Firestore batch limit is 500)
    const writeData = async (dataArray, collName) => {
      console.log(`Writing ${dataArray.length} ${collName}...`);
      for (let i = 0; i < dataArray.length; i += 400) {
        const batch = writeBatch(db);
        const chunk = dataArray.slice(i, i + 400);
        chunk.forEach(item => {
          const docRef = doc(db, collName, item.id);
          batch.set(docRef, item);
        });
        await batch.commit();
      }
    };

    await writeData(patients, 'patients');
    await writeData(visits, 'visits');
    await writeData(alerts, 'alerts');

    console.log(`✅ Scalable seeding complete!`);
    console.log(`Total Patients: ${patients.length}`);
    console.log(`Total Visits: ${visits.length}`);
    console.log(`Total Alerts: ${alerts.length}`);
    process.exit(0);

  } catch (err) {
    console.error('Seeding failed:', err);
    process.exit(1);
  }
}

seedData();
