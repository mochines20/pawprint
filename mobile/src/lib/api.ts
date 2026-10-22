import { supabase } from './supabase';
import { Platform } from 'react-native';
import type { CareFlag, CareNeed, CatVariant, Sighting } from './types';

const apiBase = String(process.env.EXPO_PUBLIC_API_BASE_URL ?? '').replace(/\/$/, '');

async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit, timeoutMs = 30000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (error) {
    if (controller.signal.aborted) throw new Error('NETWORK_TIMEOUT');
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!apiBase) throw new Error('MOBILE_API_NOT_CONFIGURED');
  const session = (await supabase.auth.getSession()).data.session;
  const headers = new Headers(init.headers);
  headers.set('accept', 'application/json');
  if (!(init.body instanceof FormData)) headers.set('content-type', 'application/json');
  if (session?.access_token) headers.set('authorization', `Bearer ${session.access_token}`);
  const response = await fetchWithTimeout(`${apiBase}${path}`, { ...init, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(String(data.message || data.error || `REQUEST_${response.status}`));
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

export async function requestPasswordReset(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo: 'pawprint://auth/reset-password' });
  if (error) throw error;
}

export async function changeEmail(email: string) {
  const { data, error } = await supabase.auth.updateUser({ email: email.trim().toLowerCase() });
  if (error) throw error;
  return data.user;
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
  cat_spotter_type?: string | null;
  streak_reminders?: boolean;
  care_flag_reminders?: boolean;
  safety_pledge_accepted?: boolean;
  privacy_notice_version?: string | null;
  privacy_consent_at?: string | null;
  safety_pledge_at?: string | null;
  terms_accepted_at?: string | null;
  guardian_consent_at?: string | null;
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

function variantOf(...values: unknown[]): CatVariant {
  const normalized = values.map((value) => String(value ?? '').toLowerCase()).join(' ');
  if (normalized.includes('calico')) return 'calico';
  if (normalized.includes('black') || normalized.includes('tuxedo')) return 'black';
  return 'orange';
}

function validCoordinate(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
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
  // Only use the delayed/rounded public area returned by the API.
  // Exact latitude/longitude fields must never be rendered by the client.
  const lat = Number(area.latitude);
  const lng = Number(area.longitude);
  return {
    id: String(row.id), variant: variantOf(row.catType, row.cat_type, row.coatType, row.coat_type),
    lat, lng,
    when: dateLabel(capturedAt), mine: Boolean(row.isOwner ?? row.mine ?? row.visibility === 'private'), seenCount: Number(row.seenCount ?? 1),
    expiresIn: expiresLabel(row.expiresAt ?? row.expires_at), seenAgo: relativeLabel(capturedAt),
    catBreed: row.catBreed ?? row.cat_breed ?? undefined,
    description: row.description ?? undefined,
    photoUrl: row.photoUrl ?? null,
    emergency: Boolean(row.emergency),
    capturedAt: capturedAt ? String(capturedAt) : undefined,
  };
}

/** Live pins from the authenticated Pawprint edge function. */
export async function fetchSightings(): Promise<Sighting[]> {
  const result = await apiRequest<{ sightings: any[] }>('/api/sightings');
  return (result.sightings ?? [])
    .map(mapSighting)
    .filter((item) => validCoordinate(item.lat, -90, 90) && validCoordinate(item.lng, -180, 180));
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
    where: 'Approximate area', variant: variantOf(row.sightings?.cat_type, row.cat_type), mine: true,
  }));
}

export type NewSighting = {
  photoUri: string; captureSource?: 'camera' | 'gallery'; showPin: boolean; latitude?: number; longitude?: number; description: string;
  capturedAt?: string; deviceTimeZone?: string;
};

export type SubmittedSighting = { xp: number; isNewCoat: boolean; variant: CatVariant; pct: number; status: string; reason?: string };

/** The server performs AI validation, storage, journal, XP, streak and delayed publishing. */
export async function submitSighting(input: NewSighting): Promise<SubmittedSighting> {
  const capture = await apiRequest<{ sessionId: string }>('/api/capture-sessions', {
    method: 'POST', body: JSON.stringify({
      deviceTimeZone: input.deviceTimeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'Asia/Manila',
      cameraPermission: input.captureSource === 'gallery' ? 'not_used' : 'granted',
      locationPermission: input.captureSource === 'gallery' ? 'not_used' : 'granted',
    }),
  });
  const auth = (await supabase.auth.getSession()).data.session;
  if (!auth?.access_token) throw new Error('AUTH_REQUIRED');
  const form = new FormData();
  if (Platform.OS === 'web' && /^(blob:|data:)/.test(input.photoUri)) {
    const photoResponse = await fetch(input.photoUri);
    if (!photoResponse.ok) throw new Error('PHOTO_READ_FAILED');
    const photoBlob = await photoResponse.blob();
    form.append('photo', photoBlob, `pawprint-${Date.now()}.${photoBlob.type.split('/')[1] || 'jpg'}`);
  } else {
    form.append('photo', { uri: input.photoUri, name: `pawprint-${Date.now()}.jpg`, type: 'image/jpeg' } as any);
  }
  form.append('captureSessionId', capture.sessionId);
  form.append('idempotencyKey', `mobile-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  form.append('description', input.description.trim());
  if (Number.isFinite(input.latitude) && Number.isFinite(input.longitude)) {
    form.append('latitude', String(input.latitude)); form.append('longitude', String(input.longitude));
  }
  form.append('capturedAt', input.capturedAt ?? new Date().toISOString());
  form.append('captureSource', input.captureSource ?? 'camera');
  form.append('visibility', input.showPin ? 'public' : 'private');
  const response = await fetchWithTimeout(`${apiBase}/api/sightings`, {
    method: 'POST', headers: { accept: 'application/json', authorization: `Bearer ${auth.access_token}` }, body: form,
  }, 45000);
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

export async function reportContent(targetType: 'sighting' | 'care_flag' | 'profile', targetId: string, reason = 'other', note = '') {
  await apiRequest('/api/reports', { method: 'POST', body: JSON.stringify({ targetType, targetId, reason, note }) });
}

export async function blockContent(targetType: 'sighting' | 'care_flag' | 'profile', targetId: string) {
  await apiRequest('/api/blocks', { method: 'POST', body: JSON.stringify({ targetType, targetId }) });
}

export async function markSightingSeen(sightingId: string) {
  return apiRequest<{ status: string }>('/api/sightings/seen', { method: 'POST', body: JSON.stringify({ sightingId }) });
}

export async function deleteAccount() {
  await apiRequest('/api/account', { method: 'DELETE' });
}

export async function createRescueRequest(sightingId: string | undefined, need: CareNeed, note = ''): Promise<void> {
  await apiRequest('/api/rescue-requests', { method: 'POST', body: JSON.stringify({ sightingId, need, note }) });
}

export async function updateProfile(fields: Record<string, unknown>): Promise<Profile> {
  const result = await apiRequest<{ user: Profile }>('/api/profile', { method: 'PATCH', body: JSON.stringify(fields) });
  return result.user;
}
