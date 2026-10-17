import process from 'node:process';

const baseUrl = (process.env.PAWPRINT_QA_BASE_URL || '').replace(/\/$/, '');
if (!baseUrl) {
  console.error('Set PAWPRINT_QA_BASE_URL to the deployed app or Supabase API URL before running production QA.');
  process.exitCode = 1;
} else {
  const checks = ['/api/health', '/api/auth/config', '/manifest.webmanifest', '/sw.js'];
  let failed = 0;
  for (const path of checks) {
    try {
      const response = await fetch(`${baseUrl}${path}`);
      if (!response.ok) { failed += 1; console.error(`FAIL ${path}: HTTP ${response.status}`); continue; }
      const payload = path === '/api/health' ? await response.json() : null;
      if (path === '/api/health') {
        for (const key of ['aiValidationConfigured', 'storage', 'persistence']) {
          if (!payload[key]) { failed += 1; console.error(`FAIL /api/health: ${key}=false`); }
        }
        if (payload.persistence !== 'supabase' && payload.persistence !== 'supabase-edge-function') { failed += 1; console.error(`FAIL /api/health: expected Supabase persistence, got ${payload.persistence}`); }
        console.log(`PASS /api/health: Supabase persistence and AI configuration reported`);
      } else console.log(`PASS ${path}`);
    } catch (error) { failed += 1; console.error(`FAIL ${path}: ${error.message}`); }
  }
  if (failed) process.exitCode = 1;
  else console.log('Production smoke QA passed. Authenticated two-user and real-image checks still require test accounts and fixtures.');
}
