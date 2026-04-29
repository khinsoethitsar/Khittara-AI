// Ka-Laung Version: 1.0.1 ✨✊
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, GithubAuthProvider, signInWithPopup, signOut, onAuthStateChanged, User, setPersistence, browserLocalPersistence } from "firebase/auth";
import { getFirestore, collection, doc, setDoc, getDoc, getDocs, query, where, orderBy, onSnapshot, deleteDoc, Timestamp, serverTimestamp, disableNetwork, enableNetwork, setLogLevel } from "firebase/firestore";

import firebaseConfig from "../../firebase-applet-config.json";

// Use environment variable for API Key if available (from GitHub Secrets during build)
const finalConfig = {
  ...firebaseConfig,
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || firebaseConfig.apiKey
};

const app = initializeApp(finalConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, finalConfig.firestoreDatabaseId);

// Set persistence to local for better cross-origin reliability in iframes
setPersistence(auth, browserLocalPersistence).catch(err => console.error("Error setting persistence:", err));

// Set log level to silent to prevent quota errors from flooding the console
setLogLevel('silent');

const googleProvider = new GoogleAuthProvider();
const githubProvider = new GithubAuthProvider();

export const signInWithGoogle = async () => {
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

    // Re-throw original for AuthScreen to handle code-specific logic
    throw error;
  }
};

export const signInWithGithub = async () => {
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
    
    throw error;
  }
};

export const logout = () => signOut(auth);

export { onAuthStateChanged, collection, doc, setDoc, getDoc, getDocs, query, where, orderBy, onSnapshot, deleteDoc, Timestamp, serverTimestamp, disableNetwork, enableNetwork };
export type { User };
