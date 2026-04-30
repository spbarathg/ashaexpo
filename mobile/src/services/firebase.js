import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

// Replace with your Firebase project config
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
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
