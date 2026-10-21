import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient, type Session } from "@supabase/supabase-js";

const apiBase = String(process.env.EXPO_PUBLIC_API_BASE_URL || "").replace(/\/$/, "");
const supabaseUrl = String(process.env.EXPO_PUBLIC_SUPABASE_URL || "");
const supabaseAnonKey = String(process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "");

export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: { storage: AsyncStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
    })
  : null;

const hasRealApiBase = apiBase && !apiBase.includes("your-pawprint-api.example.com");
const hasRealSupabase = supabaseUrl && !supabaseUrl.includes("your-project.supabase.co") && supabaseAnonKey && !supabaseAnonKey.includes("your-public-anon-key");
export const isConfigured = Boolean(hasRealApiBase && hasRealSupabase && supabase);

export async function getSession(): Promise<Session | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!apiBase) throw new Error("MOBILE_API_NOT_CONFIGURED");
  const session = await getSession();
  const headers = new Headers(init.headers);
  headers.set("accept", "application/json");
  if (!(init.body instanceof FormData)) headers.set("content-type", "application/json");
  if (session?.access_token) headers.set("authorization", `Bearer ${session.access_token}`);
  const response = await fetch(`${apiBase}${path}`, { ...init, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(String(data.error || `REQUEST_${response.status}`));
  return data as T;
}

export async function signOut() {
  await supabase?.auth.signOut();
}

export async function sendEmailCode(email: string) {
  if (!supabase || !isConfigured) throw new Error("MOBILE_AUTH_NOT_CONFIGURED");
  await apiRequest<{ status: string; provider: string }>("/api/auth/send-code", {
    method: "POST",
    body: JSON.stringify({ email: email.trim().toLowerCase() }),
  });
}

export async function verifyEmailCode(email: string, token: string) {
  if (!supabase || !isConfigured) throw new Error("MOBILE_AUTH_NOT_CONFIGURED");
  const result = await apiRequest<{ session: Session | null }>("/api/auth/verify-code", {
    method: "POST",
    body: JSON.stringify({ email: email.trim().toLowerCase(), token: token.trim() }),
  });
  if (!result.session) throw new Error("AUTH_SESSION_NOT_CREATED");
  const { error } = await supabase.auth.setSession(result.session);
  if (error) throw error;
  return result.session;
}

export async function signInWithProvider(provider: "google" | "apple") {
  if (!supabase) throw new Error("MOBILE_AUTH_NOT_CONFIGURED");
  const redirectTo = typeof window !== "undefined" ? window.location.origin : "pawprint://auth/callback";
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo, skipBrowserRedirect: typeof window === "undefined" },
  });
  if (error) throw error;
  if (typeof window !== "undefined" && data.url) window.location.assign(data.url);
  return data.url;
}
