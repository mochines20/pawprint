import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const baseUrl = (process.env.PAWPRINT_QA_BASE_URL || "http://localhost:4173").replace(/\/$/, "");
const source = fs.readFileSync(path.join(root, "dist/server/index.js"), "utf8");
const html = fs.readFileSync(path.join(root, "dist/index.html"), "utf8");
const worker = fs.readFileSync(path.join(root, "worker/index.template.js"), "utf8");
const assets = fs.readFileSync(path.join(root, "assets/mobile-ui.js"), "utf8") + fs.readFileSync(path.join(root, "assets/offline-queue.js"), "utf8") + fs.readFileSync(path.join(root, "assets/admin-console.js"), "utf8");
const supabaseApi = fs.readFileSync(path.join(root, "supabase/functions/pawprint-api/index.ts"), "utf8");
const deployment = fs.readFileSync(path.join(root, "supabase/migrations/20261017000000_pawprint_app.sql"), "utf8") + fs.readFileSync(path.join(root, "docs/SUPABASE-APP-SETUP.md"), "utf8");
const passed = [];
const failed = [];
const manual = [];

function pass(name, detail = "") { passed.push({ name, detail }); }
function fail(name, detail) { failed.push({ name, detail }); }
function needsManual(name, detail) { manual.push({ name, detail }); }
function includesAll(haystack, needles) { return needles.every((needle) => haystack.includes(needle)); }

async function checkPublicEndpoint(pathname, expectedStatus = 200) {
  try {
    const response = await fetch(`${baseUrl}${pathname}`);
    const body = await response.text();
    if (response.status !== expectedStatus) return fail(`GET ${pathname}`, `expected ${expectedStatus}, got ${response.status}`);
    pass(`GET ${pathname}`, `${response.status} · ${body.length} bytes`);
  } catch (error) {
    fail(`GET ${pathname}`, error.message);
  }
}

async function main() {
  await checkPublicEndpoint("/api/health");
  await checkPublicEndpoint("/api/auth/config");
  await checkPublicEndpoint("/manifest.webmanifest");
  await checkPublicEndpoint("/sw.js");
  await checkPublicEndpoint("/");

  const contractChecks = [
    ["Reject non-cat/person/screenshot/AI images", ["IMAGE_NOT_A_CAT", "PERSON_DETECTED", "SCREENSHOT_DETECTED", "AI_GENERATED_IMAGE", "validation.status"]],
    ["AI provider fallback and timeout", ["runOllama", "runGemini", "const order = provider === \"ollama\" ? [\"ollama\", \"gemini\"]", "AbortSignal.timeout(25000)"]],
    ["Duplicate image protection", ["photo_hash", "DUPLICATE_IMAGE"]],
    ["Capture-time freshness protection", ["CAPTURE_TIME_INVALID", "10 * 60 * 1000"]],
    ["Double-submit idempotency", ["request_keys", "idempotencyKey", "existingRequest"]],
    ["Camera and location permission guards", ["CAMERA_REQUIRED", "LOCATION_REQUIRED", "cameraPermission", "locationPermission"]],
    ["20-per-day rate limit", ["RATE_LIMITED", ">= 20"]],
    ["Philippines timezone and streak freeze", ["localDay", "device_time_zone", "freeze_count", "Asia/Manila"]],
    ["Blocked users excluded from public map", ["blocks.blocked_user_id", "NOT EXISTS"]],
    ["Journal/profile are user-scoped", ["async function getJournal", "const user = await requireUser", "WHERE journal_entries.user_id=?"]],
    ["Admin moderation and care resolution", ["ADMIN_REQUIRED", "async function getModerationQueue", "async function resolveCareFlag"]],
    ["Account deletion removes records and stored photos", ["async function deleteUser", "BUCKET.delete", "DELETE FROM sightings", "DELETE FROM users"]],
    ["Offline state has visible feedback", ["window.addEventListener('offline'", "You are offline"]],
    ["Offline sighting queue", ["indexedDB", "OFFLINE_QUEUED", "pawprint-offline"]],
    ["Brevo waitlist confirmation", ["sendBrevoWaitlistEmail", "api.brevo.com/v3/smtp/email", "BREVO_API_KEY"]],
    ["Push subscription storage and service worker delivery", ["push_subscriptions", "pushManager.subscribe", "addEventListener('push'"]],
    ["Supabase API and Storage persistence", ["SUPABASE_SERVICE_ROLE_KEY", "pawprint-sightings", "from(\"sightings\")", "storage_path"]],
    ["Admin moderation console", ["data-open-admin", "ADMIN_REQUIRED", "data-admin-action", "/api/admin/care-flags"]],
    ["Supabase-only deployment config", ["supabase/functions/pawprint-api/index.ts", "supabase/migrations", "SUPABASE_SERVICE_ROLE_KEY", "pawprint-sightings"]],
  ];
  for (const [name, needles] of contractChecks) {
    if (includesAll(source + html + worker + assets + supabaseApi + deployment, needles)) pass(name, "source contract present");
    else fail(name, `missing: ${needles.filter((needle) => !(source + html + worker + assets + supabaseApi + deployment).includes(needle)).join(", ")}`);
  }

  needsManual("Offline submit behavior", "An explicit offline submit guard is present; toggle the browser offline and confirm the sighting is not uploaded and the recovery message is clear.");
  needsManual("AI image rejection matrix", "Run authenticated captures with a real cat, person photo, screenshot, AI image, and non-cat image against the configured AI provider.");
  needsManual("Authenticated persistence", "Run the same sighting twice, refresh, and verify Supabase DB/storage, Journal, XP, streak, and medal records.");
  needsManual("Permission denial UX", "Deny camera and location in a real browser, then confirm the recovery instructions and retry path.");
  needsManual("Timezone boundary", "Use Asia/Manila around midnight with and without a freeze, then verify orange/black streak state.");
  needsManual("Privacy/admin isolation", "Use two normal users plus one admin to verify Journal access, blocks, moderation, care resolution, and account deletion.");

  console.log(`Pawprint edge QA · ${baseUrl}`);
  console.log(`PASS ${passed.length}`);
  for (const item of passed) console.log(`  ✓ ${item.name}${item.detail ? ` — ${item.detail}` : ""}`);
  console.log(`FAIL ${failed.length}`);
  for (const item of failed) console.log(`  ✗ ${item.name} — ${item.detail}`);
  console.log(`MANUAL ${manual.length}`);
  for (const item of manual) console.log(`  ! ${item.name} — ${item.detail}`);
  if (failed.length) process.exitCode = 1;
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
