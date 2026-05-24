import { initializeApp, cert, getApps, type App } from "firebase-admin/app";
import { getFirestore, FieldValue, Timestamp, type Firestore } from "firebase-admin/firestore";
import { getAuth, type Auth } from "firebase-admin/auth";

type ServiceAccountJson = {
  project_id?: string;
  client_email?: string;
  private_key?: string;
  [key: string]: unknown;
};

let appInstance: App | null = null;
let dbInstance: Firestore | null = null;
let authInstance: Auth | null = null;
let initError: string | null = null;

function normalizePrivateKey(key: string): string {
  return key.replace(/\\n/g, "\n").trim();
}

function parseServiceAccountJson(raw: string): ServiceAccountJson | null {
  const trimmed = raw.trim();

  const attempts: Array<() => ServiceAccountJson> = [
    () => JSON.parse(trimmed) as ServiceAccountJson,
    () => JSON.parse(trimmed.replace(/^\uFEFF/, "")) as ServiceAccountJson,
  ];

  for (const attempt of attempts) {
    try {
      const parsed = attempt();
      if (parsed?.private_key && parsed?.client_email) {
        parsed.private_key = normalizePrivateKey(String(parsed.private_key));
        return parsed;
      }
    } catch {
      // try next
    }
  }

  return null;
}

function loadServiceAccount(): ServiceAccountJson | null {
  const json = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (json) {
    const parsed = parseServiceAccountJson(json);
    if (parsed) return parsed;
    console.error(
      "[firebase] FIREBASE_SERVICE_ACCOUNT is set but invalid JSON.",
      "Length:",
      json.length,
      "Starts with:",
      json.slice(0, 40),
    );
  }

  const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
  if (b64) {
    try {
      const decoded = Buffer.from(b64.trim(), "base64").toString("utf8");
      const parsed = parseServiceAccountJson(decoded);
      if (parsed) return parsed;
    } catch (e) {
      console.error("[firebase] FIREBASE_SERVICE_ACCOUNT_BASE64 decode failed:", e);
    }
  }

  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim();
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.trim();
  if (clientEmail && privateKey) {
    return {
      project_id: process.env.GOOGLE_CLOUD_PROJECT ?? "bingoorodig",
      client_email: clientEmail,
      private_key: normalizePrivateKey(privateKey),
    };
  }

  return null;
}

function initAdmin(): App {
  if (appInstance) return appInstance;
  if (getApps().length) {
    appInstance = getApps()[0]!;
    return appInstance;
  }

  const serviceAccount = loadServiceAccount();
  const projectId =
    serviceAccount?.project_id ?? process.env.GOOGLE_CLOUD_PROJECT ?? "bingoorodig";

  if (!serviceAccount) {
    initError =
      "Firebase credentials missing. Set FIREBASE_SERVICE_ACCOUNT (full JSON, one line) or FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY in Render.";
    console.error("[firebase]", initError);
    appInstance = initializeApp({ projectId });
    return appInstance;
  }

  try {
    appInstance = initializeApp({
      credential: cert(serviceAccount as Parameters<typeof cert>[0]),
      projectId,
    });
    initError = null;
    console.log("[firebase] Admin SDK initialized for project:", projectId);
    return appInstance;
  } catch (e) {
    initError = e instanceof Error ? e.message : String(e);
    console.error("[firebase] Init failed:", initError);
    throw e;
  }
}

export function getDb(): Firestore {
  if (!dbInstance) {
    initAdmin();
    dbInstance = getFirestore();
  }
  return dbInstance;
}

export function getAdminAuth(): Auth {
  if (!authInstance) {
    initAdmin();
    authInstance = getAuth();
  }
  return authInstance;
}

/** @deprecated use getDb() — kept for route compatibility */
export const db = new Proxy({} as Firestore, {
  get(_target, prop, receiver) {
    const real = getDb() as unknown as Record<string | symbol, unknown>;
    const value = real[prop as string];
    return typeof value === "function" ? value.bind(getDb()) : Reflect.get(real, prop, receiver);
  },
});

/** @deprecated use getAdminAuth() */
export const auth = new Proxy({} as Auth, {
  get(_target, prop, receiver) {
    const real = getAdminAuth() as unknown as Record<string | symbol, unknown>;
    const value = real[prop as string];
    return typeof value === "function" ? value.bind(getAdminAuth()) : Reflect.get(real, prop, receiver);
  },
});

export function getFirebaseStatus(): { ok: boolean; error: string | null; projectId: string } {
  try {
    initAdmin();
    const sa = loadServiceAccount();
    return {
      ok: !!sa && !initError,
      error: initError,
      projectId: sa?.project_id ?? process.env.GOOGLE_CLOUD_PROJECT ?? "bingoorodig",
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
      projectId: process.env.GOOGLE_CLOUD_PROJECT ?? "bingoorodig",
    };
  }
}

export { FieldValue, Timestamp };

export const AUTH_EMAIL_DOMAIN = "bingoorodig.internal";

export function authEmailForUsername(username: string): string {
  return `${username.trim().toLowerCase()}@${AUTH_EMAIL_DOMAIN}`;
}

export async function nextId(counterName: string): Promise<number> {
  const ref = getDb().collection("_counters").doc(counterName);
  return getDb().runTransaction(async (tx) => {
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

// Initialize on boot so Render logs show credential problems early.
try {
  initAdmin();
  getDb();
  getAdminAuth();
} catch (e) {
  console.error("[firebase] Startup initialization failed:", e);
}
