import process from 'node:process';
import fs from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(new URL('../mobile/package.json', import.meta.url));
const { createClient } = require('@supabase/supabase-js');
const fileEnv = fs.existsSync('mobile/.env.local')
  ? Object.fromEntries(fs.readFileSync('mobile/.env.local', 'utf8').split(/\r?\n/).flatMap((line) => {
      const match = line.match(/^\s*([A-Z0-9_]+)=(.*)\s*$/);
      return match ? [[match[1], match[2].replace(/^['"]|['"]$/g, '')]] : [];
    }))
  : {};
const env = (name) => process.env[name] || fileEnv[name] || '';
const client = createClient(env('SUPABASE_URL') || env('EXPO_PUBLIC_SUPABASE_URL'), env('SUPABASE_ANON_KEY') || env('EXPO_PUBLIC_SUPABASE_ANON_KEY'), { auth: { persistSession: false } });
const signedIn = await client.auth.signInWithPassword({ email: env('PAWPRINT_QA_USER_EMAIL'), password: env('PAWPRINT_QA_USER_PASSWORD') });
if (signedIn.error || !signedIn.data.session) throw new Error('QA sign-in failed');
const response = await fetch(`${(env('PAWPRINT_QA_BASE_URL') || 'https://pawprint-omega.vercel.app').replace(/\/$/, '')}/api/account`, { method: 'DELETE', headers: { authorization: `Bearer ${signedIn.data.session.access_token}` } });
const body = await response.json().catch(() => ({}));
if (!response.ok) throw new Error(`DELETE /api/account failed (${response.status}): ${body.error || body.message || 'unknown error'}`);
console.log('PASS QA account cleanup');
