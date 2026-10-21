import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
let playwright;
try {
  playwright = require(process.env.PAWPRINT_PLAYWRIGHT || 'playwright');
} catch {
  playwright = require(path.join(process.env.USERPROFILE || process.env.HOME, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
}

const { chromium } = playwright;
const origin = process.env.PAWPRINT_TEST_URL || 'http://localhost:4173';
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
const page = await context.newPage();

// The public build intentionally blocks authenticated API routes. This isolated
// boundary fixture supplies an authenticated user, so opt out of that public
// policy before the application scripts initialize.
await context.addInitScript(() => {
  Object.defineProperty(window, 'PAWPRINT_PUBLIC_DEMO_ONLY', {
    configurable: false,
    writable: false,
    value: false,
  });
});

await context.route('**/assets/supabase-auth*.js*', route => route.fulfill({
  contentType: 'application/javascript',
  body: "window.pawprintAuthGate={ready:true,queue:[]};window.pawprintSession={user:{id:'qa-boundary'}};window.pawprintPublicProfile={nickname:'Boundary QA',avatar:'cat-tangerine'};window.dispatchEvent(new CustomEvent('pawprint-authenticated',{detail:{continueToApp:true}}));",
}));

let onlineUploads = 0;
await context.route('**/api/**', async route => {
  const request = route.request();
  const url = new URL(request.url());
  if (url.pathname === '/api/sightings' && request.method() === 'POST') {
    onlineUploads += 1;
    return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ status: 'accepted', sightingId: 'qa-online-sync' }) });
  }
  const data = url.pathname === '/api/dashboard'
    ? { streak: { current: 0, active: false }, today: { count: 0, target: 1 }, xp: 0, journal: { unique: 0 }, sightings: [] }
    : url.pathname === '/api/progress'
      ? { xp: 0, level: 1, medals: [], nextMedal: null, streak: { current: 0 } }
      : url.pathname === '/api/me'
        ? { user: { display_name: 'Boundary QA', language: 'en', time_zone: 'Asia/Manila' } }
        : url.pathname === '/api/journal'
          ? { entries: [] }
          : url.pathname === '/api/sightings'
            ? { sightings: [] }
            : url.pathname === '/api/map'
              ? { clusters: [] }
              : {};
  return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) });
});

await page.goto(`${origin}/?qa=local-boundaries#app`, { waitUntil: 'domcontentloaded' });
await page.locator('.pw-home').waitFor();

await context.setOffline(true);
const offlineResult = await page.evaluate(async () => {
  const form = new FormData();
  form.append('idempotencyKey', 'qa-offline-boundary');
  form.append('photo', new Blob(['qa-image'], { type: 'image/jpeg' }), 'qa.jpg');
  form.append('description', 'Offline boundary test photo.');
  form.append('latitude', '14.42');
  form.append('longitude', '121.03');
  const response = await fetch('/api/sightings', { method: 'POST', body: form });
  return { status: response.status, body: await response.json(), queued: (await window.pawprintOfflineQueue.list()).length };
});
assert.equal(offlineResult.status, 202);
assert.equal(offlineResult.body.reason, 'OFFLINE_QUEUED');
assert.equal(offlineResult.queued, 1);

await context.setOffline(false);
await page.evaluate(() => window.pawprintOfflineQueue.flush());
await page.waitForFunction(async () => (await window.pawprintOfflineQueue.list()).length === 0);
assert.equal(onlineUploads, 1);
console.log('PASS offline sighting queue and reconnect flush');

await context.clearPermissions();
const permissionResult = await page.evaluate(async () => {
  const result = { camera: 'not-tested', location: 'not-tested' };
  try {
    await navigator.mediaDevices.getUserMedia({ video: true });
    result.camera = 'granted';
  } catch (error) {
    result.camera = error?.name || 'rejected';
  }
  try {
    await new Promise((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 3000 }));
    result.location = 'granted';
  } catch (error) {
    result.location = error?.code === 1 ? 'denied' : error?.name || `code-${error?.code || 'unknown'}`;
  }
  return result;
});
assert.notEqual(permissionResult.camera, 'granted');
assert.notEqual(permissionResult.location, 'granted');
console.log(`PASS browser permission denial boundary (camera=${permissionResult.camera}, location=${permissionResult.location})`);

await browser.close();
