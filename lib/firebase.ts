import { type FirebaseApp, getApp, getApps, initializeApp } from "firebase/app";
import { type Firestore, getFirestore } from "firebase/firestore";
import { type FirebaseStorage, getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const requiredConfig = Object.entries(firebaseConfig),
  missingConfig = requiredConfig
    .filter(([, value]) => !value)
    .map(([name]) => name);

export const firebaseConfigured = missingConfig.length === 0;
export const firebaseSetupMessage = firebaseConfigured
  ? null
  : `Firebase is not configured. Add all six NEXT_PUBLIC_FIREBASE values to .env.local or GitHub repository variables, then rebuild the app. Missing: ${missingConfig.join(", ")}.`;

let app: FirebaseApp | undefined;
export let db: Firestore | undefined;
export let storage: FirebaseStorage | undefined;

if (firebaseConfigured) {
  app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  db = getFirestore(app);
  storage = getStorage(app);
}
