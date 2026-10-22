import process from 'node:process';
import fs from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(new URL('../mobile/package.json', import.meta.url));
const { createClient } = require('@supabase/supabase-js');

function loadEnvFile(path) {
  if (!fs.existsSync(path)) return {};
  return Object.fromEntries(fs.readFileSync(path, 'utf8').split(/\r?\n/).flatMap((line) => {
    const match = line.match(/^\s*([A-Z0-9_]+)=(.*)\s*$/);
    if (!match) return [];
    return [[match[1], match[2].replace(/^['"]|['"]$/g, '')]];
  }));
}

const fileEnv = loadEnvFile(new URL('../mobile/.env.local', import.meta.url));
const env = (name) => process.env[name] || fileEnv[name] || '';
const supabaseUrl = env('SUPABASE_URL') || env('EXPO_PUBLIC_SUPABASE_URL');
const anonKey = env('SUPABASE_ANON_KEY') || env('EXPO_PUBLIC_SUPABASE_ANON_KEY');
const apiBase = (env('PAWPRINT_QA_BASE_URL') || 'https://pawprint-omega.vercel.app').replace(/\/$/, '');
const email = env('PAWPRINT_QA_USER_EMAIL');
const password = env('PAWPRINT_QA_USER_PASSWORD');
const fixture = env('PAWPRINT_QA_CAT_FIXTURE') || new URL('../assets/cat-tabby-paving.webp', import.meta.url);

if (!supabaseUrl || !anonKey || !email || !password) {
  throw new Error('Set Supabase public credentials and one QA email/password before running.');
}

const authClient = createClient(supabaseUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
const signedIn = await authClient.auth.signInWithPassword({ email, password });
if (signedIn.error || !signedIn.data.session) throw new Error('QA sign-in failed');
const token = signedIn.data.session.access_token;
const headers = { accept: 'application/json', authorization: `Bearer ${token}` };

async function api(path, options = {}) {
  const response = await fetch(`${apiBase}${path}`, { ...options, headers: { ...headers, ...(options.headers || {}) } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${options.method || 'GET'} ${path} failed (${response.status}): ${body.error || body.message || 'unknown error'}`);
  return body;
}

const nickname = `LiveQa_${Math.random().toString(36).slice(2, 9)}`;
const profile = await api('/api/profile', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ displayName: nickname, language: 'en', timeZone: 'Asia/Manila' }) });
if (profile.user?.display_name !== nickname) throw new Error('Profile persistence response did not contain the saved nickname');
console.log('PASS authenticated profile persistence');

const capture = await api('/api/capture-sessions', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ deviceTimeZone: 'Asia/Manila', cameraPermission: 'granted', locationPermission: 'granted' }) });
if (!capture.sessionId) throw new Error('Capture session was not created');

const bytes = fs.readFileSync(fixture);
const capturedAt = new Date().toISOString();
const requestKey = `live-qa-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const makeForm = () => {
  const form = new FormData();
  form.append('photo', new File([bytes], 'qa-cat.webp', { type: 'image/webp' }));
  form.append('captureSessionId', capture.sessionId);
  form.append('idempotencyKey', requestKey);
  form.append('description', 'Live QA cat persistence test');
  form.append('latitude', '14.4080');
  form.append('longitude', '121.0410');
  form.append('capturedAt', capturedAt);
  form.append('captureSource', 'camera');
  form.append('visibility', 'private');
  return form;
};

const first = await api('/api/sightings', { method: 'POST', body: makeForm() });
if (!first.sightingId) throw new Error('Live sighting was not created');
console.log(`PASS authenticated sighting persistence (${first.status})`);

const replay = await api('/api/sightings', { method: 'POST', body: makeForm() });
if (replay.sightingId !== first.sightingId) throw new Error('Idempotency replay did not return the original sighting');
console.log('PASS sighting idempotency replay');

const [profileAfter, journal, progress, sightings] = await Promise.all([
  api('/api/profile'),
  api('/api/journal'),
  api('/api/progress'),
  api('/api/sightings'),
]);
if (profileAfter.user?.display_name !== nickname) throw new Error('Saved profile was not readable after refresh');
if (!Array.isArray(journal.entries) || !Array.isArray(sightings.sightings)) throw new Error('Authenticated collections did not load');
if (!progress.streak || typeof progress.xp !== 'number') throw new Error('Progress/streak data did not load');
if (first.status === 'accepted' && !sightings.sightings.some((item) => item.id === first.sightingId)) throw new Error('Persisted sighting was not returned to its owner');
console.log(`PASS authenticated refresh persistence (journal=${journal.entries.length}, sightings=${sightings.sightings.length}, xp=${progress.xp})`);

if (process.env.PAWPRINT_QA_CLEANUP === 'true') {
  await api('/api/account', { method: 'DELETE' });
  console.log('PASS QA account cleanup requested');
}
