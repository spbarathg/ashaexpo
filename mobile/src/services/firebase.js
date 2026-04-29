import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

// Replace with your Firebase project config
const firebaseConfig = {
  apiKey: '799528678b4e1cdc6b508f8cd1a6ec0823ff546d',
  authDomain: 'ashaaurora-18558.firebaseapp.com',
  projectId: 'ashaaurora-18558',
  storageBucket: 'ashaaurora-18558.firebasestorage.app',
  messagingSenderId: '111092307501516679280',
  appId: '1:111092307501516679280:web:fca8866f85231799b2b336',
};

// Lazy-init Firebase so the app doesn't crash on import when config is placeholder
let _app = null;
let _firestore = null;

function getApp() {
  if (!_app) {
    try {
      _app = initializeApp(firebaseConfig);
    } catch (err) {
      console.warn('Firebase init failed (config may be placeholder):', err.message);
    }
  }
  return _app;
}

// Export as a getter — sync manager calls this only when actually syncing
export function getFirestoreInstance() {
  if (!_firestore) {
    const app = getApp();
    if (app) {
      _firestore = getFirestore(app);
    }
  }
  return _firestore;
}
