// Ka-Laung Version: 1.0.2 ✨✊ (Priority Config)
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAnalytics, isSupported } from "firebase/analytics";
import { getAuth, GoogleAuthProvider, GithubAuthProvider, signInWithPopup, signOut, onAuthStateChanged, User, setPersistence, browserLocalPersistence } from "firebase/auth";
import { getFirestore, collection, doc, setDoc, getDoc, getDocs, query, where, orderBy, onSnapshot, deleteDoc, Timestamp, serverTimestamp, disableNetwork, enableNetwork, setLogLevel } from "firebase/firestore";

// New Config provided by အစ်ကို MinThitSarAung
const NEW_CONFIG = {
  apiKey: "AIzaSyDKejA-7500f-X3GrdbWfYbpKDZk7hvp9M",
  authDomain: "khittaraai.firebaseapp.com",
  projectId: "khittaraai",
  storageBucket: "khittaraai.firebasestorage.app",
  messagingSenderId: "758275209267",
  appId: "1:758275209267:web:ae0d80cf926e12bb704b46",
  measurementId: "G-S2GZHCT3J9",
  firestoreDatabaseId: "(default)"
};

// Safe config loading: Use environment variables if set, otherwise use the new confirmed config
const finalConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || NEW_CONFIG.apiKey,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || NEW_CONFIG.authDomain,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || NEW_CONFIG.projectId,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || NEW_CONFIG.storageBucket,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || NEW_CONFIG.messagingSenderId,
  appId: import.meta.env.VITE_FIREBASE_APP_ID || NEW_CONFIG.appId,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || NEW_CONFIG.measurementId,
  firestoreDatabaseId: import.meta.env.VITE_FIREBASE_DATABASE_ID || NEW_CONFIG.firestoreDatabaseId
};

if (!finalConfig.apiKey) {
  console.warn("Firebase API Key is missing. Please set VITE_FIREBASE_API_KEY in your settings.");
}

const app = !getApps().length ? initializeApp(finalConfig) : getApp();
export const auth = getAuth(app);
export const db = getFirestore(app, finalConfig.firestoreDatabaseId);

// Initialize Analytics if supported
export const analytics = typeof window !== 'undefined' ? isSupported().then(yes => yes ? getAnalytics(app) : null).catch(() => null) : null;

// Set persistence to local for better cross-origin reliability in iframes
setPersistence(auth, browserLocalPersistence).catch(err => console.error("Error setting persistence:", err));

// Set log level to silent to prevent quota errors from flooding the console
setLogLevel('silent');

const googleProvider = new GoogleAuthProvider();
const githubProvider = new GithubAuthProvider();

let isSignInInProgress = false;

export const signInWithGoogle = async () => {
  if (isSignInInProgress) {
    console.warn("A sign-in request is already in progress.");
    return;
  }
  
  isSignInInProgress = true;
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error: any) {
    console.error("Firebase Google Sign-in Error:", error.code, error.message);
    
    // Explicitly handle and normalize errors for our UI
    if (error.code === 'auth/unauthorized-domain') {
       const currentDomain = window.location.hostname;
       const err = new Error(`Domain "${currentDomain}" is not authorized. Please add it to your Firebase Console.`);
       (err as any).code = 'auth/unauthorized-domain';
       throw err;
    }

    if (error.code === 'auth/popup-closed-by-user') {
      const err = new Error("The sign-in popup was closed before completion. If this happens automatically, please try opening the app in a new tab.");
      (err as any).code = 'auth/popup-closed-by-user';
      throw err;
    }

    // Re-throw original for AuthScreen to handle code-specific logic
    throw error;
  } finally {
    isSignInInProgress = false;
  }
};

export const signInWithGithub = async () => {
  if (isSignInInProgress) {
    console.warn("A sign-in request is already in progress.");
    return;
  }

  isSignInInProgress = true;
  try {
    const result = await signInWithPopup(auth, githubProvider);
    return result.user;
  } catch (error: any) {
    console.error("Firebase GitHub Sign-in Error:", error.code, error.message);
    
    if (error.code === 'auth/unauthorized-domain') {
       const currentDomain = window.location.hostname;
       const err = new Error(`Domain "${currentDomain}" is not authorized. Please add it to your Firebase Console.`);
       (err as any).code = 'auth/unauthorized-domain';
       throw err;
    }

    if (error.code === 'auth/popup-closed-by-user') {
      const err = new Error("The sign-in popup was closed before completion. If this happens automatically, please try opening the app in a new tab.");
      (err as any).code = 'auth/popup-closed-by-user';
      throw err;
    }
    
    throw error;
  } finally {
    isSignInInProgress = false;
  }
};

export const logout = () => signOut(auth);

export { onAuthStateChanged, collection, doc, setDoc, getDoc, getDocs, query, where, orderBy, onSnapshot, deleteDoc, Timestamp, serverTimestamp, disableNetwork, enableNetwork };
export type { User };
