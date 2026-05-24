const API_BASE = (import.meta.env.VITE_API_URL as string | undefined)
  ?.trim()
  .replace(/\/+$/, "") ?? "";

export function apiUrl(path: string): string {
  if (path.startsWith("http")) return path;
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return API_BASE ? `${API_BASE}${normalized}` : normalized;
}

export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = localStorage.getItem("bingo_token");
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
