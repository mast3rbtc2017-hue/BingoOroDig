import { initializeApp, cert, getApps, type App } from "firebase-admin/app";
import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

function initAdmin(): App {
  if (getApps().length) return getApps()[0]!;

  const json = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (json) {
    const serviceAccount = JSON.parse(json) as Record<string, string>;
    return initializeApp({
      credential: cert(serviceAccount as Parameters<typeof cert>[0]),
      projectId: serviceAccount.project_id ?? process.env.GOOGLE_CLOUD_PROJECT ?? "bingoorodig",
    });
  }

  // Firebase Cloud Functions / GCP default credentials
  return initializeApp({
    projectId: process.env.GOOGLE_CLOUD_PROJECT ?? "bingoorodig",
  });
}

initAdmin();

export const db = getFirestore();
export const auth = getAuth();
export { FieldValue, Timestamp };

export const AUTH_EMAIL_DOMAIN = "bingoorodig.internal";

export function authEmailForUsername(username: string): string {
  return `${username.trim().toLowerCase()}@${AUTH_EMAIL_DOMAIN}`;
}

export async function nextId(counterName: string): Promise<number> {
  const ref = db.collection("_counters").doc(counterName);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const next = (snap.data()?.value ?? 0) + 1;
    tx.set(ref, { value: next });
    return next;
  });
}

export function toIso(value: unknown): string {
  if (!value) return new Date().toISOString();
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  return String(value);
}
