import * as fs from "node:fs";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT ?? "bingoorodig";
let credentialsOk = false;
let initError: string | null = null;

function normalizeKey(key: string): string {
  return key.replace(/\\n/g, "\n").trim();
}

function loadCredentials(): Record<string, unknown> | null {
  const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (credPath && fs.existsSync(credPath)) {
    try {
      return JSON.parse(fs.readFileSync(credPath, "utf8")) as Record<string, unknown>;
    } catch (e) {
      console.error("[firebase] Cannot read GOOGLE_APPLICATION_CREDENTIALS file:", e);
    }
  }

  const email = process.env.FIREBASE_CLIENT_EMAIL?.trim();
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.trim();
  if (email && privateKey) {
    return {
      project_id: PROJECT_ID,
      client_email: email,
      private_key: normalizeKey(privateKey),
    };
  }

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT?.trim();
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (typeof parsed.private_key === "string") {
      parsed.private_key = normalizeKey(parsed.private_key);
    }
    return parsed;
  } catch (e) {
    console.error("[firebase] FIREBASE_SERVICE_ACCOUNT JSON inválido:", e);
    return null;
  }
}

function hasValidCredentials(cred: Record<string, unknown>): boolean {
  const email = cred.client_email ?? cred.clientEmail;
  const key = cred.private_key ?? cred.privateKey;
  return typeof email === "string" && typeof key === "string" && key.includes("BEGIN");
}

if (!getApps().length) {
  const cred = loadCredentials();
  try {
    if (cred && hasValidCredentials(cred)) {
      initializeApp({
        credential: cert(cred as Parameters<typeof cert>[0]),
        projectId: String(cred.project_id ?? cred.projectId ?? PROJECT_ID),
      });
      credentialsOk = true;
      console.log("[firebase] OK — credenciales cargadas");
    } else {
      initError =
        "Credenciales incompletas. En Render usa FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY (recomendado) o el JSON completo con private_key.";
      console.error("[firebase]", initError);
      initializeApp({ projectId: PROJECT_ID });
    }
  } catch (e) {
    initError = e instanceof Error ? e.message : String(e);
    console.error("[firebase] Error al iniciar:", initError);
    initializeApp({ projectId: PROJECT_ID });
  }
}

export const db = getFirestore();
export const auth = getAuth();
export { FieldValue, Timestamp };

export function getFirebaseStatus() {
  return {
    ok: credentialsOk,
    error: initError,
    projectId: PROJECT_ID,
  };
}

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
