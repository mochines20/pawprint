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
const url = env('SUPABASE_URL') || env('EXPO_PUBLIC_SUPABASE_URL');
const anonKey = env('SUPABASE_ANON_KEY') || env('EXPO_PUBLIC_SUPABASE_ANON_KEY');
const email = env('PAWPRINT_QA_ADMIN_EMAIL');
const password = env('PAWPRINT_QA_ADMIN_PASSWORD');
const itemId = env('PAWPRINT_QA_MODERATION_ID');
const nonAdminEmail = env('PAWPRINT_QA_NONADMIN_EMAIL');
const nonAdminPassword = env('PAWPRINT_QA_NONADMIN_PASSWORD');

if (!url || !anonKey || !email || !password || !itemId) {
  console.error('Set Supabase URL/key, QA admin credentials, and PAWPRINT_QA_MODERATION_ID.');
  process.exit(1);
}

const client = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
const signedIn = await client.auth.signInWithPassword({ email, password });
if (signedIn.error || !signedIn.data.session || !signedIn.data.user) throw new Error(`admin sign-in failed: ${signedIn.error?.message || 'no session'}`);
const token = signedIn.data.session.access_token;
const endpoint = `${url.replace(/\/$/, '')}/functions/v1/pawprint-api`;

const getResponse = await fetch(`${endpoint}/api/admin/moderation`, { headers: { authorization: `Bearer ${token}` } });
if (!getResponse.ok) throw new Error(`admin list failed (${getResponse.status})`);
const listed = await getResponse.json();
if (!(listed.items || []).some((item) => item.id === itemId)) throw new Error('temporary moderation item was not visible to admin');
console.log('PASS admin can list moderation queue');

const mutate = await fetch(`${endpoint}/api/admin/moderation/${itemId}`, {
  method: 'POST',
  headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
  body: JSON.stringify({ action: 'approve' }),
});
if (!mutate.ok) throw new Error(`admin mutation failed (${mutate.status})`);
const payload = await mutate.json();
if (payload.status !== 'resolved') throw new Error(`unexpected moderation mutation result: ${JSON.stringify(payload)}`);
console.log('PASS admin can resolve moderation item');

const denied = await fetch(`${endpoint}/api/admin/moderation`, { headers: { authorization: 'Bearer invalid' } });
if (denied.status !== 401) throw new Error(`invalid token expected 401, got ${denied.status}`);
console.log('PASS invalid admin token is rejected');

if (nonAdminEmail && nonAdminPassword) {
  const nonAdmin = await client.auth.signInWithPassword({ email: nonAdminEmail, password: nonAdminPassword });
  if (nonAdmin.error || !nonAdmin.data.session) throw new Error(`non-admin sign-in failed: ${nonAdmin.error?.message || 'no session'}`);
  const forbidden = await fetch(`${endpoint}/api/admin/moderation`, { headers: { authorization: `Bearer ${nonAdmin.data.session.access_token}` } });
  if (forbidden.status !== 403) throw new Error(`non-admin expected 403, got ${forbidden.status}`);
  console.log('PASS non-admin cannot access moderation queue');
}
