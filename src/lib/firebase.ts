// Ka-Laung Version: 1.0.1 ✨✊
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAnalytics, isSupported } from "firebase/analytics";
import { getAuth, GoogleAuthProvider, GithubAuthProvider, signInWithPopup, signOut, onAuthStateChanged, User, setPersistence, browserLocalPersistence } from "firebase/auth";
import { getFirestore, collection, doc, setDoc, getDoc, getDocs, query, where, orderBy, onSnapshot, deleteDoc, Timestamp, serverTimestamp, disableNetwork, enableNetwork, setLogLevel } from "firebase/firestore";

// Safe config loading with environment variables as primary source
const finalConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyDKejA-7500f-X3GrdbWfYbpKDZk7hvp9M",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "khittaraai.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "khittaraai",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "khittaraai.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "758275209267",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:758275209267:web:ae0d80cf926e12bb704b46",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-S2GZHCT3J9",
  firestoreDatabaseId: import.meta.env.VITE_FIREBASE_DATABASE_ID || "(default)"
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
