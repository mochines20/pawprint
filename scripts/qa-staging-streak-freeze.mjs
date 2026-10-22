import process from 'node:process';
import fs from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(new URL('../mobile/package.json', import.meta.url));
const { createClient } = require('@supabase/supabase-js');

function loadEnvFile(path) {
  if (!fs.existsSync(path)) return {};
  return Object.fromEntries(fs.readFileSync(path, 'utf8').split(/\r?\n/).flatMap((line) => {
    const match = line.match(/^\s*([A-Z0-9_]+)=(.*)\s*$/);
    return match ? [[match[1], match[2].replace(/^['"]|['"]$/g, '')]] : [];
  }));
}

const fileEnv = {
  ...loadEnvFile(new URL('../mobile/.env.local', import.meta.url)),
  ...loadEnvFile(new URL('../.env.staging', import.meta.url)),
  ...loadEnvFile(new URL('../mobile/.env.staging', import.meta.url)),
};
const env = (name) => process.env[name] || fileEnv[name] || '';
const supabaseUrl = env('SUPABASE_URL') || env('EXPO_PUBLIC_SUPABASE_URL');
const anonKey = env('SUPABASE_ANON_KEY') || env('EXPO_PUBLIC_SUPABASE_ANON_KEY');
const serviceRoleKey = env('PAWPRINT_QA_SERVICE_ROLE_KEY');
const base = (env('PAWPRINT_QA_BASE_URL') || '').replace(/\/$/, '');
const email = env('PAWPRINT_QA_USER_EMAIL');
const password = env('PAWPRINT_QA_USER_PASSWORD');
const fixture = env('PAWPRINT_QA_CAT_FIXTURE') || new URL('../assets/cat-tabby-paving.webp', import.meta.url);

if (!supabaseUrl || !anonKey || !serviceRoleKey || !base || !email || !password) {
  throw new Error('Set staging Supabase URL/anon key/service role, QA base URL, and QA credentials.');
}
if (base.includes('pawprint-omega.vercel.app') || supabaseUrl.includes('xfmackyuxabagrstrpku')) {
  throw new Error('Refusing to run staging streak fixture against production.');
}

const auth = createClient(supabaseUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
const service = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
const signedIn = await auth.auth.signInWithPassword({ email, password });
if (signedIn.error || !signedIn.data.session || !signedIn.data.user) throw new Error(`QA sign-in failed: ${signedIn.error?.message || 'no session'}`);
const userId = signedIn.data.user.id;
const token = signedIn.data.session.access_token;
const headers = { authorization: `Bearer ${token}` };

const profile = await fetch(`${base}/api/profile`, { method: 'PATCH', headers: { ...headers, 'content-type': 'application/json' }, body: JSON.stringify({ displayName: `StreakQa_${Date.now()}`, timeZone: 'Asia/Manila' }) });
if (!profile.ok) throw new Error(`profile setup failed (${profile.status})`);

const previousLocalDay = new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10);
const seeded = await service.from('streaks').upsert({ user_id: userId, current_count: 3, best_count: 3, freeze_count: 1, last_local_day: previousLocalDay, updated_at: new Date().toISOString() });
if (seeded.error) throw new Error(`streak seed failed: ${seeded.error.message}`);

const captureResponse = await fetch(`${base}/api/capture-sessions`, { method: 'POST', headers: { ...headers, 'content-type': 'application/json' }, body: JSON.stringify({ deviceTimeZone: 'Asia/Manila', cameraPermission: 'granted', locationPermission: 'granted' }) });
const capture = await captureResponse.json().catch(() => ({}));
if (!captureResponse.ok) throw new Error(`capture session failed (${captureResponse.status})`);

const bytes = fs.readFileSync(fixture);
const form = new FormData();
form.append('photo', new File([bytes], 'staging-accepted-cat.webp', { type: 'image/webp' }));
form.append('captureSessionId', capture.sessionId);
form.append('idempotencyKey', `staging-streak-${Date.now()}`);
form.append('description', 'Staging accepted cat streak-freeze test');
form.append('latitude', '14.4080');
form.append('longitude', '121.0410');
form.append('capturedAt', new Date().toISOString());
form.append('captureSource', 'camera');
form.append('visibility', 'private');
const sightingResponse = await fetch(`${base}/api/sightings`, { method: 'POST', headers, body: form });
const sighting = await sightingResponse.json().catch(() => ({}));
if (!sightingResponse.ok) throw new Error(`accepted upload failed (${sightingResponse.status}) ${sighting.error || ''}`);
if (sighting.status !== 'accepted') throw new Error(`fixture was not accepted: ${sighting.status}/${sighting.reason}`);
if (sighting.rewards?.streak?.current !== 4 || sighting.rewards?.streak?.freezes !== 0) throw new Error(`freeze result mismatch: ${JSON.stringify(sighting.rewards?.streak)}`);
console.log('PASS staging accepted upload consumed one streak freeze and continued the streak');
