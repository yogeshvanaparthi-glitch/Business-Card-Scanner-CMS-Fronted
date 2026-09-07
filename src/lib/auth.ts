import { API_BASE } from "@/lib/api";

const ACCESS_KEY = "ncs_cms_access_token";
const REFRESH_KEY = "ncs_cms_refresh_token";
const USER_KEY = "ncs_cms_auth_user";

export type UserRole = "SUPER_ADMIN" | "ADMIN" | "USER";

export type AuthUser = {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: UserRole;
  company_id: string | null;
};

type TokenPair = {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
};

export type LoginResponse = TokenPair & { user: AuthUser };

export function loadStoredUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_KEY);
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_KEY);
}

export function persistSession(access: string, refresh: string, user: AuthUser) {
  localStorage.setItem(ACCESS_KEY, access);
  localStorage.setItem(REFRESH_KEY, refresh);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession() {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(USER_KEY);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("ncs-cms-auth-cleared"));
  }
}

export async function login(identifier: string, password: string): Promise<LoginResponse> {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier, password }),
  });

  if (!res.ok) {
    let message = `Login failed (${res.status})`;
    try {
      const body = await res.json();
      const detail = body.detail ?? body.message;
      if (typeof detail === "string") message = detail;
      else if (detail?.message) message = detail.message;
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }

  return res.json() as Promise<LoginResponse>;
}

export async function refreshAccessToken(): Promise<string | null> {
  const refresh = getRefreshToken();
  if (!refresh) return null;

  const res = await fetch(`${API_BASE}/api/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refresh }),
  });

  if (!res.ok) {
    clearSession();
    return null;
  }

  const data = (await res.json()) as TokenPair;
  const user = loadStoredUser();
  if (!user) {
    clearSession();
    return null;
  }
  persistSession(data.access_token, data.refresh_token, user);
  return data.access_token;
}

export async function logout(): Promise<void> {
  const refresh = getRefreshToken();
  const access = getAccessToken();
  try {
    if (refresh) {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (access) headers.Authorization = `Bearer ${access}`;
      await fetch(`${API_BASE}/api/auth/logout`, {
        method: "POST",
        headers,
        body: JSON.stringify({ refresh_token: refresh }),
      });
    }
  } catch {
    /* best-effort */
  } finally {
    clearSession();
  }
}

export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers);
  if (!headers.has("Content-Type") && init?.body) {
    headers.set("Content-Type", "application/json");
  }

  let token = getAccessToken();
  if (!token) {
    token = await refreshAccessToken();
  }
  if (!token) {
    clearSession();
    throw new Error("Your session expired. Please log in again.");
  }
  headers.set("Authorization", `Bearer ${token}`);

  let res = await fetch(`${API_BASE}${path}`, { ...init, headers });

  if (res.status === 401) {
    token = await refreshAccessToken();
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
      res = await fetch(`${API_BASE}${path}`, { ...init, headers });
    } else {
      clearSession();
      throw new Error("Your session expired. Please log in again.");
    }
  }

  return res;
}

export async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await apiFetch(path, init);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/failed to fetch|networkerror|load failed|err_connection/i.test(msg)) {
      throw new Error(
        "Cannot reach the API server. Ensure the backend is running (port 5000) and the CMS dev server is up, then try again.",
      );
    }
    throw err instanceof Error ? err : new Error(msg);
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({} as Record<string, unknown>));
    const detail = body?.detail ?? body?.message ?? `Request failed (${res.status})`;
    let message: string;
    if (typeof detail === "string") {
      message = detail;
    } else if (detail && typeof detail === "object" && "message" in (detail as object)) {
      message = String((detail as { message?: unknown }).message ?? JSON.stringify(detail));
    } else if (Array.isArray(detail)) {
      message = detail
        .map((item) =>
          typeof item === "object" && item && "msg" in item
            ? String((item as { msg: unknown }).msg)
            : JSON.stringify(item),
        )
        .join("; ");
    } else {
      message = JSON.stringify(detail);
    }
    throw new Error(message || `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}
