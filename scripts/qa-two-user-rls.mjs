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
const emailA = env('PAWPRINT_QA_USER_A_EMAIL');
const passwordA = env('PAWPRINT_QA_USER_A_PASSWORD');
const emailB = env('PAWPRINT_QA_USER_B_EMAIL');
const passwordB = env('PAWPRINT_QA_USER_B_PASSWORD');

if (!url || !anonKey || !emailA || !passwordA || !emailB || !passwordB) {
  console.error('Set SUPABASE_URL, SUPABASE_ANON_KEY, and two QA credentials before running this test.');
  process.exit(1);
}
if (url.includes('your-project') || anonKey.includes('your-public')) {
  console.error('Refusing to run against placeholder Supabase credentials.');
  process.exit(1);
}

async function signIn(label, email, password) {
  const client = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const result = await client.auth.signInWithPassword({ email, password });
  if (result.error || !result.data.user) throw new Error(`${label} sign-in failed: ${result.error?.message || 'no user returned'}`);
  return { label, client, userId: result.data.user.id, accessToken: result.data.session?.access_token || '' };
}

async function ensureOwnProfile(actor) {
  const nickname = actor.label === 'user A' ? 'RlsQaA2026' : 'RlsQaB2026';
  const result = await fetch(`${url.replace(/\/$/, '')}/functions/v1/pawprint-api/api/profile`, {
    method: 'PATCH',
    headers: { authorization: `Bearer ${actor.accessToken}`, 'content-type': 'application/json' },
    body: JSON.stringify({ displayName: nickname }),
  });
  if (!result.ok) throw new Error(`${actor.label} profile setup failed (${result.status})`);
}

async function assertNoRows(actor, table, column, otherId) {
  const result = await actor.client.from(table).select('*').eq(column, otherId).limit(1);
  if (result.error) throw new Error(`${actor.label} ${table} query errored: ${result.error.message}`);
  if ((result.data || []).length) throw new Error(`${actor.label} can read another user's ${table}`);
  console.log(`PASS ${actor.label} cannot read another user's ${table}`);
}

const users = await Promise.all([
  signIn('user A', emailA, passwordA),
  signIn('user B', emailB, passwordB),
]);
if (users[0].userId === users[1].userId) throw new Error('QA accounts must be different users');

await Promise.all(users.map(ensureOwnProfile));

for (const [actor, other] of [[users[0], users[1]], [users[1], users[0]]]) {
  await assertNoRows(actor, 'profiles', 'id', other.userId);
  await assertNoRows(actor, 'sightings', 'user_id', other.userId);
  await assertNoRows(actor, 'journal_entries', 'user_id', other.userId);
  await assertNoRows(actor, 'care_flags', 'user_id', other.userId);
  await assertNoRows(actor, 'reports', 'user_id', other.userId);
  const ownProfile = await actor.client.from('profiles').select('id').eq('id', actor.userId).limit(1);
  if (ownProfile.error || !ownProfile.data?.length) throw new Error(`${actor.label} cannot read its own profile`);
  console.log(`PASS ${actor.label} can read its own profile only`);
}

console.log('Two-user RLS QA passed. Direct clients cannot read the other user\'s profile, exact sightings, Journal, Care Flags, or reports.');
