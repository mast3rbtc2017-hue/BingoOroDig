import { auth } from "./firebase";

const DEFAULT_PROD_API = "https://bingoorodig-api.onrender.com";

const API_BASE =
  (import.meta.env.VITE_API_URL as string | undefined)?.trim().replace(/\/+$/, "") ||
  (import.meta.env.PROD ? DEFAULT_PROD_API : "");

export function apiUrl(path: string): string {
  if (path.startsWith("http")) return path;
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return API_BASE ? `${API_BASE}${normalized}` : normalized;
}

async function authBearer(): Promise<string | null> {
  const user = auth.currentUser;
  if (!user) return null;
  try {
    return await user.getIdToken();
  } catch {
    return null;
  }
}

export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = await authBearer();
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return fetch(apiUrl(path), { ...init, headers });
}

export async function apiJson<T = unknown>(
  path: string,
  method: string,
  body?: unknown,
): Promise<T> {
  const res = await apiFetch(path, {
    method,
    body: body != null ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || "Error en la solicitud");
  }
  return data as T;
}
