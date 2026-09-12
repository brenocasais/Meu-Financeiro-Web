import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

/**
 * Exact Firebase configuration provided for "Meu Financeiro"
 * Connected to the same real Firestore and Authentication as the Android app in production.
 */
export const firebaseConfig = {
  apiKey: "AIzaSyCY80akfkc0cAPICSoUoYFzXm-XR3VEDPU",
  authDomain: "meu-financeiro-v2-9a8f5.firebaseapp.com",
  projectId: "meu-financeiro-v2-9a8f5",
  storageBucket: "meu-financeiro-v2-9a8f5.firebasestorage.app",
  messagingSenderId: "930171495351",
  appId: "1:930171495351:web:20b65bd86cdd071252fe32",
  measurementId: "G-YE8LWWSLQQ"
};

// Initialize Firebase only once
export const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Initialize Firestore
export const db = getFirestore(app);

// Initialize Firebase Authentication
export const auth = getAuth(app);

// Google Sign-In Provider for Phase 2
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });
