import { doc, setDoc } from 'firebase/firestore';
import { getFirestoreInstance } from './firebase';
import { isOnline, onConnectivityChange } from './connectivityService';
import { getPendingItems, markDone, markFailed } from '../database/syncQueueRepository';
import { updateVisitSyncStatus } from '../database/visitRepository';
import { updatePatientSyncStatus } from '../database/patientRepository';
import { FIRESTORE_COLLECTIONS, SYNC_STATUS } from '../constants/appConfig';
import AsyncStorage from '@react-native-async-storage/async-storage';

const LAST_SYNC_KEY = 'last_sync_time';
let _syncing = false;

/**
 * Initialize sync manager — listen for reconnects and auto-sync.
 */
export function initSyncManager() {
  onConnectivityChange((connected, justReconnected) => {
    if (justReconnected) {
      processQueue();
    }
  });
}

/**
 * Process the sync queue — upload pending items to Firestore.
 * Priority order: alerts (1) → visits (2) → patients (3).
 */
export async function processQueue() {
  if (_syncing) return;
  if (!isOnline()) return;

  _syncing = true;
  try {
    const items = await getPendingItems();

    for (const item of items) {
      try {
        const payload = JSON.parse(item.payload);
        const collection = getCollection(item.record_type);

        if (!collection) {
          await markFailed(item.id);
          continue;
        }

        const db = getFirestoreInstance();
        if (!db) {
          throw new Error('Firestore not initialized');
        }

        // Write to Firestore
        await setDoc(doc(db, collection, item.record_id), payload);

        // Mark queue item as done
        await markDone(item.id);

        // Update source table sync status
        await updateSourceStatus(item.record_type, item.record_id, SYNC_STATUS.SYNCED);
      } catch (err) {
        console.warn(`Sync failed for ${item.record_type} ${item.record_id}:`, err.message);
        await markFailed(item.id);
      }
    }

    // Store last successful sync time
    await AsyncStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());
  } catch (err) {
    console.error('Sync queue processing error:', err);
  } finally {
    _syncing = false;
  }
}

/**
 * Get the Firestore collection name for a record type.
 */
function getCollection(recordType) {
  switch (recordType) {
    case 'alert': return FIRESTORE_COLLECTIONS.ALERTS;
    case 'visit': return FIRESTORE_COLLECTIONS.VISITS;
    case 'patient': return FIRESTORE_COLLECTIONS.PATIENTS;
    default: return null;
  }
}

/**
 * Update the sync status on the source table.
 */
async function updateSourceStatus(recordType, recordId, status) {
  try {
    if (recordType === 'visit') {
      await updateVisitSyncStatus(recordId, status);
    } else if (recordType === 'patient') {
      await updatePatientSyncStatus(recordId, status);
    }
    // alerts don't have a separate sync_status column
  } catch (err) {
    console.warn('Failed to update source status:', err.message);
  }
}

/**
 * Get last successful sync time.
 */
export async function getLastSyncTime() {
  try {
    return await AsyncStorage.getItem(LAST_SYNC_KEY);
  } catch {
    return null;
  }
}

/**
 * Manual trigger for sync.
 */
export async function manualSync() {
  if (!isOnline()) {
    return { success: false, message: 'No internet. Records are safely saved offline.' };
  }
  await processQueue();
  return { success: true, message: 'Sync completed.' };
}
