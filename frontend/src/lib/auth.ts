import type { EnabledModules } from "@pippo/shared";

export type UserRole = "admin" | "cajero" | "cocinero" | "superadmin" | "mesero" | "produccion";

const TOKEN_STORAGE_KEY = "pippo_auth_token";
const NEST_API_URL = process.env.NEXT_PUBLIC_NEST_API_URL;

export interface UserProfile {
  id: string;
  email: string;
  role: UserRole;
  branch_id: string | null;
  full_name: string | null;
  business_name: string | null;
  enabled_modules: EnabledModules;
  announcement: { id: string; message: string } | null;
}

export const BANNER_DISMISSED_PREFIX = "pippo_banner_dismissed_";

function decodeJwtExpiry(token: string): number | null {
  try {
    const payloadSegment = token.split(".")[1];
    const json = atob(payloadSegment.replace(/-/g, "+").replace(/_/g, "/"));
    const payload = JSON.parse(json) as { exp?: number };
    return payload.exp ?? null;
  } catch {
    return null;
  }
}

function isTokenValid(token: string): boolean {
  const exp = decodeJwtExpiry(token);
  return exp !== null && exp * 1000 > Date.now();
}

// Never rejects: if there's no token or it expired, resolves to "" — many
// services rely on this contract to build the Authorization header without
// handling a catch at every call site.
export async function getToken(): Promise<string> {
  if (typeof window === "undefined") return "";
  const token = localStorage.getItem(TOKEN_STORAGE_KEY);
  if (!token || !isTokenValid(token)) return "";
  return token;
}

export async function getUserProfile(): Promise<UserProfile | null> {
  const token = await getToken();
  if (!token) return null;

  const res = await fetch(`${NEST_API_URL}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  return res.json();
}

export async function signIn(email: string, password: string): Promise<{ user: UserProfile }> {
  const res = await fetch(`${NEST_API_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? "Credenciales incorrectas");
  }

  const data = await res.json();
  localStorage.setItem(TOKEN_STORAGE_KEY, data.access_token);
  clearDismissedBanners();
  return { user: data.user };
}

// The superadmin banner can be dismissed, but must reappear on every
// login — sessionStorage alone isn't enough (it survives a logout/login
// within the same tab), so it's cleared here by hand.
function clearDismissedBanners(): void {
  if (typeof window === "undefined") return;
  for (let i = sessionStorage.length - 1; i >= 0; i--) {
    const key = sessionStorage.key(i);
    if (key?.startsWith(BANNER_DISMISSED_PREFIX)) sessionStorage.removeItem(key);
  }
}

export async function signOut(): Promise<void> {
  localStorage.removeItem(TOKEN_STORAGE_KEY);
}
