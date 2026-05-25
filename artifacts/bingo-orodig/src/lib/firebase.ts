import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAnalytics, isSupported } from "firebase/analytics";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY ?? "AIzaSyDTolx2K9rMTkBUq7S1CcRnBFZn1XphDdc",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? "bingoorodig.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ?? "bingoorodig",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ?? "bingoorodig.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? "201438034542",
  appId: import.meta.env.VITE_FIREBASE_APP_ID ?? "1:201438034542:web:387d971bee9c50b6e2047f",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID ?? "G-X89HMF5R96",
};

export const firebaseApp = initializeApp(firebaseConfig);
export const auth = getAuth(firebaseApp);
export const firestore = getFirestore(firebaseApp);
export const storage = getStorage(firebaseApp);

export const AUTH_EMAIL_DOMAIN = "bingoorodig.internal";

export function authEmailForUsername(username: string): string {
  return `${username.trim().toLowerCase()}@${AUTH_EMAIL_DOMAIN}`;
}

void isSupported().then((ok) => {
  if (ok) getAnalytics(firebaseApp);
});
