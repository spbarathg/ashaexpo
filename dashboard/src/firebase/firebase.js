import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: '799528678b4e1cdc6b508f8cd1a6ec0823ff546d',
  authDomain: 'ashaaurora-18558.firebaseapp.com',
  projectId: 'ashaaurora-18558',
  storageBucket: 'ashaaurora-18558.firebasestorage.app',
  messagingSenderId: '111092307501516679280',
  appId: '1:111092307501516679280:web:fca8866f85231799b2b336',
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
