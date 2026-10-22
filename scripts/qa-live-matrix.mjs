import process from 'node:process';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(new URL('../mobile/package.json', import.meta.url));
const { createClient } = require('@supabase/supabase-js');
const envFile = fs.readFileSync('mobile/.env.local', 'utf8');
const fileEnv = Object.fromEntries(envFile.split(/\r?\n/).flatMap((line) => {
  const match = line.match(/^\s*([A-Z0-9_]+)=(.*)\s*$/);
  return match ? [[match[1], match[2].replace(/^['"]|['"]$/g, '')]] : [];
}));
const env = (name) => process.env[name] || fileEnv[name] || '';
const client = createClient(env('EXPO_PUBLIC_SUPABASE_URL'), env('EXPO_PUBLIC_SUPABASE_ANON_KEY'), { auth: { persistSession: false } });
const signedIn = await client.auth.signInWithPassword({ email: env('PAWPRINT_QA_USER_EMAIL'), password: env('PAWPRINT_QA_USER_PASSWORD') });
if (signedIn.error || !signedIn.data.session) throw new Error('QA sign-in failed');
const base = (env('PAWPRINT_QA_BASE_URL') || 'https://pawprint-omega.vercel.app').replace(/\/$/, '');
const headers = { authorization: `Bearer ${signedIn.data.session.access_token}` };
const fixtures = String(env('PAWPRINT_QA_FIXTURES') || '').split(';').filter(Boolean).map((item) => {
  const [label, file] = item.split('|');
  return { label, file: path.resolve(file) };
});
const failures = [];
for (const fixture of fixtures) {
  try {
    const sessionResponse = await fetch(`${base}/api/capture-sessions`, { method: 'POST', headers: { ...headers, 'content-type': 'application/json' }, body: JSON.stringify({ deviceTimeZone: 'Asia/Manila', cameraPermission: 'granted', locationPermission: 'granted' }) });
    const session = await sessionResponse.json().catch(() => ({}));
    if (!sessionResponse.ok) throw new Error(`capture session failed (${sessionResponse.status}) ${session.error || ''}`);
    const form = new FormData();
    const bytes = fs.readFileSync(fixture.file);
    const mime = fixture.file.endsWith('.webp') ? 'image/webp' : fixture.file.endsWith('.jpg') || fixture.file.endsWith('.jpeg') ? 'image/jpeg' : 'image/png';
    form.append('photo', new File([bytes], path.basename(fixture.file), { type: mime }));
    form.append('captureSessionId', session.sessionId);
    form.append('idempotencyKey', `matrix-${fixture.label}-${Date.now()}`);
    form.append('description', `Live QA ${fixture.label} fixture`);
    form.append('latitude', '14.4080');
    form.append('longitude', '121.0410');
    form.append('capturedAt', new Date().toISOString());
    form.append('captureSource', 'camera');
    form.append('visibility', 'private');
    const response = await fetch(`${base}/api/sightings`, { method: 'POST', headers, body: form });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(`upload failed (${response.status}) ${body.error || ''}`);
    console.log(`${fixture.label}: ${body.status} / ${body.reason || 'none'}`);
  } catch (error) {
    failures.push(`${fixture.label}: ${error instanceof Error ? error.message : String(error)}`);
    console.log(`${fixture.label}: ERROR / ${failures.at(-1)}`);
  }
}
if (failures.length) process.exitCode = 1;
