import { supabase } from './supabase';
import type { CareFlag, CareNeed, CatVariant, Sighting } from './types';

const apiBase = String(process.env.EXPO_PUBLIC_API_BASE_URL ?? '').replace(/\/$/, '');

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!apiBase) throw new Error('MOBILE_API_NOT_CONFIGURED');
  const session = (await supabase.auth.getSession()).data.session;
  const headers = new Headers(init.headers);
  headers.set('accept', 'application/json');
  if (!(init.body instanceof FormData)) headers.set('content-type', 'application/json');
  if (session?.access_token) headers.set('authorization', `Bearer ${session.access_token}`);
  const response = await fetch(`${apiBase}${path}`, { ...init, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(String(data.error || `REQUEST_${response.status}`));
  return data as T;
}

export async function sendEmailCode(email: string) {
  await apiRequest('/api/auth/send-code', { method: 'POST', body: JSON.stringify({ email: email.trim().toLowerCase() }) });
}

export async function verifyEmailCode(email: string, token: string, password?: string) {
  const result = await apiRequest<{ session: { access_token: string; refresh_token: string } | null }>('/api/auth/verify-code', {
    method: 'POST', body: JSON.stringify({ email: email.trim().toLowerCase(), token: token.trim() }),
  });
  if (!result.session) throw new Error('AUTH_SESSION_NOT_CREATED');
  const { error } = await supabase.auth.setSession(result.session);
  if (error) throw error;
  if (password) {
    const { error: passwordError } = await supabase.auth.updateUser({ password });
    if (passwordError) throw passwordError;
  }
  return result.session;
}

export async function signInWithPassword(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });
  if (error) throw error;
  return data.session;
}

export async function signUpWithPassword(email: string, password: string) {
  const { data, error } = await supabase.auth.signUp({
    email: email.trim().toLowerCase(),
    password,
  });
  if (error) throw error;
  return data.session;
}

export async function signInWithProvider(provider: 'google' | 'apple') {
  const redirectTo = 'pawprint://auth/callback';
  const { data, error } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo, skipBrowserRedirect: true } });
  if (error) throw error;
  if (data.url) {
    const { Linking } = await import('react-native');
    await Linking.openURL(data.url);
  }
  return data.url;
}

export type Profile = {
  id: string;
  email?: string | null;
  display_name?: string | null;
  avatar_url?: string | null;
  age_group?: string | null;
  gender?: string | null;
  location_area?: string | null;
  onboarding_completed?: boolean;
  time_zone?: string | null;
  language?: string | null;
  visibility?: string;
  approximate_map?: boolean;
};

export type Dashboard = {
  streak: { current: number; best: number; freezes: number; state: string; label: string };
  journal: { unique: number };
  xp: number;
  sightings: unknown[];
  today: { count: number; target: number };
};

export type Progress = {
  xp: number;
  level: number;
  streak: { current: number; best: number; freezes: number };
  medals: { id: string; title: string; xpRequired: number; earned: boolean }[];
  journal: { total: number; unique: number };
};

export async function fetchProfile(): Promise<Profile> {
  const result = await apiRequest<{ user: Profile }>('/api/profile');
  return result.user;
}

export async function fetchDashboard(): Promise<Dashboard> { return apiRequest<Dashboard>('/api/dashboard'); }
export async function fetchProgress(): Promise<Progress> { return apiRequest<Progress>('/api/progress'); }

function variantOf(value: unknown): CatVariant {
  const normalized = String(value ?? '').toLowerCase();
  if (normalized.includes('calico')) return 'calico';
  if (normalized.includes('black')) return 'black';
  return 'orange';
}

function dateLabel(value: unknown): string {
  if (!value) return 'Recently spotted';
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return 'Recently spotted';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function relativeLabel(value: unknown): string {
  if (!value) return 'recently';
  const age = Date.now() - new Date(String(value)).getTime();
  if (!Number.isFinite(age) || age < 0) return 'just now';
  const minutes = Math.floor(age / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function expiresLabel(value: unknown): string {
  if (!value) return '24h';
  const hours = Math.max(0, Math.ceil((new Date(String(value)).getTime() - Date.now()) / 3600000));
  return hours >= 24 ? `${Math.ceil(hours / 24)}d` : `${hours}h`;
}

function mapSighting(row: any): Sighting {
  const capturedAt = row.capturedAt ?? row.captured_at;
  const area = row.area ?? {};
  return {
    id: String(row.id), variant: variantOf(row.catType ?? row.cat_type),
    lat: Number(area.latitude ?? row.latitude ?? 0), lng: Number(area.longitude ?? row.longitude ?? 0),
    when: dateLabel(capturedAt), mine: row.visibility !== 'public', seenCount: 1,
    expiresIn: expiresLabel(row.expiresAt ?? row.expires_at), seenAgo: relativeLabel(capturedAt),
  };
}

/** Live pins from the authenticated Pawprint edge function. */
export async function fetchSightings(): Promise<Sighting[]> {
  const [result, own] = await Promise.all([
    apiRequest<{ sightings: any[] }>('/api/sightings'),
    apiRequest<{ sightings: any[] }>('/api/dashboard'),
  ]);
  const ownIds = new Set((own.sightings ?? []).map((item) => String(item.id)));
  return (result.sightings ?? []).map((row) => mapSighting({ ...row, visibility: ownIds.has(String(row.id)) ? 'private' : row.visibility }))
    .filter((item) => Number.isFinite(item.lat) && Number.isFinite(item.lng));
}

function careNeed(value: unknown): CareNeed {
  const normalized = String(value ?? '').toLowerCase();
  if (normalized === 'water') return 'Water';
  if (normalized === 'food') return 'Food';
  if (normalized.includes('injur')) return 'Injured';
  if (normalized.includes('kitten')) return 'Kittens alone';
  if (normalized.includes('stuck') || normalized.includes('unsafe')) return 'Stuck / unsafe';
  return 'Other';
}

/** Live care flags for the signed-in account. */
export async function fetchCareFlags(): Promise<CareFlag[]> {
  const result = await apiRequest<{ flags: any[] }>('/api/care-flags');
  return (result.flags ?? []).map((row) => ({
    id: String(row.id), sightingId: row.sighting_id ? String(row.sighting_id) : undefined, need: careNeed(row.kind ?? row.need), note: String(row.note ?? ''),
    where: 'Approximate area', variant: variantOf(row.sightings?.cat_type ?? row.cat_type), mine: true,
  }));
}

export type NewSighting = {
  photoUri: string; showPin: boolean; latitude: number; longitude: number; description: string;
  capturedAt?: string; deviceTimeZone?: string;
};

export type SubmittedSighting = { xp: number; isNewCoat: boolean; variant: CatVariant; pct: number; status: string; reason?: string };

/** The server performs AI validation, storage, journal, XP, streak and delayed publishing. */
export async function submitSighting(input: NewSighting): Promise<SubmittedSighting> {
  const capture = await apiRequest<{ sessionId: string }>('/api/capture-sessions', {
    method: 'POST', body: JSON.stringify({
      deviceTimeZone: input.deviceTimeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'Asia/Manila',
      cameraPermission: 'granted', locationPermission: 'granted',
    }),
  });
  const auth = (await supabase.auth.getSession()).data.session;
  if (!auth?.access_token) throw new Error('AUTH_REQUIRED');
  const form = new FormData();
  form.append('photo', { uri: input.photoUri, name: `pawprint-${Date.now()}.jpg`, type: 'image/jpeg' } as any);
  form.append('captureSessionId', capture.sessionId);
  form.append('idempotencyKey', `mobile-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  form.append('description', input.description.trim());
  form.append('latitude', String(input.latitude)); form.append('longitude', String(input.longitude));
  form.append('capturedAt', input.capturedAt ?? new Date().toISOString());
  form.append('visibility', input.showPin ? 'public' : 'private');
  const response = await fetch(`${apiBase}/api/sightings`, {
    method: 'POST', headers: { accept: 'application/json', authorization: `Bearer ${auth.access_token}` }, body: form,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(String(data.error || `REQUEST_${response.status}`));
  const variant = variantOf(data.catType);
  return {
    xp: Number(data.rewards?.xp ?? 0), isNewCoat: Boolean(data.rewards?.xp) && data.status === 'accepted', variant,
    pct: Math.round(Number(data.validation?.catConfidence ?? data.validation?.confidence ?? 0) * 100) || 0,
    status: String(data.status ?? 'pending'), reason: data.reason,
  };
}

export async function raiseCareFlag(sightingId: string, need: CareNeed, note: string): Promise<void> {
  await apiRequest('/api/care-flags', { method: 'POST', body: JSON.stringify({ sightingId, kind: need, note }) });
}

export async function createRescueRequest(sightingId: string | undefined, need: CareNeed, note = ''): Promise<void> {
  await apiRequest('/api/rescue-requests', { method: 'POST', body: JSON.stringify({ sightingId, need, note }) });
}

export async function updateProfile(fields: Record<string, unknown>): Promise<Profile> {
  const result = await apiRequest<{ user: Profile }>('/api/profile', { method: 'PATCH', body: JSON.stringify(fields) });
  return result.user;
}
