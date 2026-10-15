const APP_HTML = __PAWPRINT_HTML__;
const SNEAK_PEEK_GIF = "__PAWPRINT_SNEAK_PEEK_GIF__";
const SNEAK_PEEK_SVG = __PAWPRINT_SNEAK_PEEK_SVG__;
const PAWPRINT_ICON_SVG = __PAWPRINT_ICON_SVG__;
const CAT_PAW_SVG = __PAWPRINT_CAT_PAW_SVG__;
const PWA_MANIFEST = JSON.stringify({ name: "Pawprint", short_name: "Pawprint", start_url: "/#app", display: "standalone", background_color: "#f1f2f4", theme_color: "#ffb815", description: "Spot cats. Leave a safer trace.", icons: [{ src: "/assets/pawprint-icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any maskable" }] });
const PWA_SERVICE_WORKER = `const CACHE='pawprint-shell-v1'; self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.add('/')))); self.addEventListener('fetch',event=>{if(event.request.method!=='GET')return; event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request).then(response=>{if(new URL(event.request.url).origin===location.origin){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy));}return response;}).catch(()=>caches.match('/'))));});`;

const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
};

const now = () => new Date().toISOString();
const id = () => crypto.randomUUID();

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: JSON_HEADERS });
}

function userFrom(request) {
  const decodeHeader = (value) => {
    if (!value) return null;
    try { return decodeURIComponent(value); } catch { return value; }
  };
  const id = decodeHeader(request.headers.get("oai-authenticated-user-id"));
  if (!id) return null;
  return {
    id,
    email: decodeHeader(request.headers.get("oai-authenticated-user-email")),
    name: decodeHeader(request.headers.get("oai-authenticated-user-full-name")),
  };
}

async function requireUser(request, env) {
  const user = userFrom(request);
  if (!user) throw new Response(JSON.stringify({ error: "AUTH_REQUIRED" }), { status: 401, headers: JSON_HEADERS });
  const timestamp = now();
  await env.DB.prepare(
    `INSERT INTO users (id, email, display_name, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET email=excluded.email, display_name=excluded.display_name, updated_at=excluded.updated_at`,
  ).bind(user.id, user.email, user.name, timestamp, timestamp).run();
  await ensureRuntimeTables(env);
  await env.DB.prepare("INSERT OR IGNORE INTO user_settings (user_id,updated_at) VALUES (?,?)").bind(user.id, timestamp).run();
  return user;
}

async function ensureRuntimeTables(env) {
  await env.DB.batch([
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS capture_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      device_time_zone TEXT NOT NULL DEFAULT 'Asia/Manila',
      camera_permission TEXT NOT NULL,
      location_permission TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      used_at TEXT,
      created_at TEXT NOT NULL
    )`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS reward_ledger (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      sighting_id TEXT NOT NULL REFERENCES sightings(id),
      kind TEXT NOT NULL,
      amount INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE(user_id, sighting_id, kind)
    )`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS user_settings (
      user_id TEXT PRIMARY KEY REFERENCES users(id),
      default_visibility TEXT NOT NULL DEFAULT 'friends',
      show_age_group INTEGER NOT NULL DEFAULT 0,
      allow_friend_requests INTEGER NOT NULL DEFAULT 1,
      notification_preference TEXT NOT NULL DEFAULT 'included',
      updated_at TEXT NOT NULL
    )`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS request_keys (
      user_id TEXT NOT NULL REFERENCES users(id),
      request_key TEXT NOT NULL,
      response_json TEXT,
      created_at TEXT NOT NULL,
      PRIMARY KEY(user_id, request_key)
    )`),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS capture_sessions_user_idx ON capture_sessions (user_id, created_at DESC)"),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS reward_ledger_user_idx ON reward_ledger (user_id, created_at DESC)"),
  ]);
  // Keep existing installations compatible with the richer capture flow.
  try { await env.DB.prepare("ALTER TABLE sightings ADD COLUMN description TEXT").run(); } catch { /* column already exists */ }
  try { await env.DB.prepare("ALTER TABLE users ADD COLUMN avatar_url TEXT").run(); } catch { /* column already exists */ }
  try { await env.DB.prepare("ALTER TABLE users ADD COLUMN age_group TEXT").run(); } catch { /* column already exists */ }
  try { await env.DB.prepare("ALTER TABLE sightings ADD COLUMN barangay_name TEXT").run(); } catch { /* column already exists */ }
  try { await env.DB.prepare("ALTER TABLE sightings ADD COLUMN city_name TEXT").run(); } catch { /* column already exists */ }
  try { await env.DB.prepare("ALTER TABLE sightings ADD COLUMN country_name TEXT NOT NULL DEFAULT 'Philippines'").run(); } catch { /* column already exists */ }
  try { await env.DB.prepare("ALTER TABLE sightings ADD COLUMN ai_confidence REAL").run(); } catch { /* column already exists */ }
  await env.DB.batch([
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), type TEXT NOT NULL,
      title TEXT NOT NULL, body TEXT NOT NULL, read_at TEXT, created_at TEXT NOT NULL
    )`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS user_badges (
      user_id TEXT NOT NULL REFERENCES users(id), badge_id TEXT NOT NULL, earned_at TEXT NOT NULL,
      PRIMARY KEY(user_id, badge_id)
    )`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS quests (
      id TEXT PRIMARY KEY, slug TEXT NOT NULL UNIQUE, title TEXT NOT NULL, description TEXT NOT NULL,
      target INTEGER NOT NULL DEFAULT 1, kind TEXT NOT NULL, starts_at TEXT NOT NULL, ends_at TEXT NOT NULL
    )`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS quest_progress (
      user_id TEXT NOT NULL REFERENCES users(id), quest_id TEXT NOT NULL REFERENCES quests(id),
      count INTEGER NOT NULL DEFAULT 0, completed_at TEXT, updated_at TEXT NOT NULL,
      PRIMARY KEY(user_id, quest_id)
    )`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS community_assets (
      id TEXT PRIMARY KEY, kind TEXT NOT NULL, title TEXT NOT NULL, description TEXT,
      latitude REAL, longitude REAL, public_geohash TEXT, area_name TEXT, contact TEXT,
      verified INTEGER NOT NULL DEFAULT 0, created_by TEXT REFERENCES users(id), created_at TEXT NOT NULL
    )`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS rescue_requests (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), sighting_id TEXT,
      need TEXT NOT NULL, note TEXT, public_geohash TEXT, status TEXT NOT NULL DEFAULT 'open',
      created_at TEXT NOT NULL, resolved_at TEXT
    )`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS moderation_queue (
      id TEXT PRIMARY KEY, target_type TEXT NOT NULL, target_id TEXT NOT NULL, reason TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open', assigned_to TEXT, action TEXT, created_at TEXT NOT NULL, resolved_at TEXT
    )`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS partner_reports (
      id TEXT PRIMARY KEY, partner_name TEXT NOT NULL, period_start TEXT NOT NULL, period_end TEXT NOT NULL,
      payload_json TEXT NOT NULL, created_by TEXT REFERENCES users(id), created_at TEXT NOT NULL
    )`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS waitlist_signups (
      id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, platform_interest TEXT NOT NULL DEFAULT 'ios_android',
      source TEXT, created_at TEXT NOT NULL
    )`),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS notifications_user_idx ON notifications (user_id, created_at DESC)"),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS community_assets_kind_idx ON community_assets (kind, created_at DESC)"),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS rescue_status_idx ON rescue_requests (status, created_at DESC)"),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS moderation_status_idx ON moderation_queue (status, created_at DESC)"),
  ]);
  const today = localDay("UTC");
  const weekEnd = new Date(Date.now() + 7 * 86400000).toISOString();
  await env.DB.prepare(`INSERT OR IGNORE INTO quests (id,slug,title,description,target,kind,starts_at,ends_at) VALUES (?,?,?,?,?,?,?)`)
    .bind("quest-daily-pawprint", "daily-pawprint", "Daily Pawprint", "Log one safe cat sighting today.", 1, "sighting", `${today}T00:00:00.000Z`, weekEnd).run();
}

const RARITY_ORDER = ["Common", "Uncommon", "Rare", "Super Rare"];
function rarityFor(catType, total = 0) {
  const normalized = String(catType || "").toLowerCase();
  if (normalized.includes("calico") || normalized.includes("tortoiseshell")) return "Rare";
  if (normalized.includes("black") || normalized.includes("white")) return total < 10 ? "Super Rare" : "Rare";
  if (normalized.includes("tuxedo") || normalized.includes("gray")) return "Uncommon";
  return "Common";
}
function levelFor(xp) { return Math.max(1, Math.floor(Math.sqrt(Math.max(0, Number(xp || 0)) / 100)) + 1); }
function isAdmin(request, env) {
  const user = userFrom(request);
  const configured = String(env.ADMIN_USER_IDS || "").split(",").map((value) => value.trim()).filter(Boolean);
  return Boolean(user && configured.includes(user.id));
}
async function createNotification(env, userId, type, title, body) {
  await env.DB.prepare("INSERT INTO notifications (id,user_id,type,title,body,created_at) VALUES (?,?,?,?,?,?)")
    .bind(id(), userId, type, title, body, now()).run();
}

function encodeGeohash(latitude, longitude, precision = 6) {
  const alphabet = "0123456789bcdefghjkmnpqrstuvwxyz";
  let lat = [-90, 90];
  let lon = [-180, 180];
  let even = true;
  let bit = 0;
  let character = 0;
  let output = "";
  while (output.length < precision) {
    const range = even ? lon : lat;
    const value = even ? longitude : latitude;
    const middle = (range[0] + range[1]) / 2;
    if (value >= middle) { character = character * 2 + 1; range[0] = middle; }
    else { character *= 2; range[1] = middle; }
    even = !even;
    bit += 1;
    if (bit === 5) { output += alphabet[character]; bit = 0; character = 0; }
  }
  return output;
}

function geohashCenter(hash) {
  const alphabet = "0123456789bcdefghjkmnpqrstuvwxyz";
  let lat = [-90, 90];
  let lon = [-180, 180];
  let even = true;
  for (const character of hash) {
    const value = alphabet.indexOf(character);
    for (let mask = 16; mask; mask >>= 1) {
      const range = even ? lon : lat;
      if (value & mask) range[0] = (range[0] + range[1]) / 2;
      else range[1] = (range[0] + range[1]) / 2;
      even = !even;
    }
  }
  return { latitude: (lat[0] + lat[1]) / 2, longitude: (lon[0] + lon[1]) / 2 };
}

async function sha256(bytes) {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function bytesToBase64(bytes) {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  return btoa(binary);
}

function parseModelJson(text) {
  const cleaned = String(text || "").trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  try { return JSON.parse(cleaned); } catch { return JSON.parse(cleaned.match(/\{[\s\S]*\}/)?.[0] || "{}"); }
}

async function validateWithGemini(env, bytes, contentType) {
  const model = env.GEMINI_MODEL || "gemini-2.5-flash";
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY },
    body: JSON.stringify({
      contents: [{ parts: [
        { text: "Inspect this camera capture for Pawprint. Return JSON only. Accept only if a real cat is clearly visible. Reject if there is no cat, a person or recognizable human face, a screenshot or screen/photo-of-a-screen, unsafe or graphic content, or an uncertain result. Suggest one coat/pattern label from: orange tabby, tuxedo, black, white, calico, tortoiseshell, gray tabby, ginger-white, mixed, unclassified. Use booleans for catDetected, personDetected, screenshotDetected, unsafe, duplicate; include reason and suggestedCoatType." },
        { inlineData: { mimeType: contentType || "image/jpeg", data: bytesToBase64(bytes) } },
      ] }],
      generationConfig: {
        temperature: 0,
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            catDetected: { type: "BOOLEAN" }, personDetected: { type: "BOOLEAN" }, screenshotDetected: { type: "BOOLEAN" },
            unsafe: { type: "BOOLEAN" }, duplicate: { type: "BOOLEAN" }, reason: { type: "STRING" }, suggestedCoatType: { type: "STRING" },
          },
          required: ["catDetected", "personDetected", "screenshotDetected", "unsafe", "duplicate", "reason", "suggestedCoatType"],
        },
      },
    }),
  });
  if (!response.ok) throw new Error(`GEMINI_${response.status}`);
  const payload = await response.json();
  const text = payload.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("") || "";
  const result = parseModelJson(text);
  return {
    status: result.catDetected && !result.personDetected && !result.screenshotDetected && !result.duplicate && !result.unsafe ? "accepted" : "rejected",
    reason: result.reason || "AI_VALIDATION_REJECTED",
    catType: result.suggestedCoatType || "Unclassified cat",
  };
}

async function validatePhoto(env, bytes, contentType) {
  if (env.GEMINI_API_KEY) {
    try { return await validateWithGemini(env, bytes, contentType); }
    catch { return { status: "needs_review", reason: "AI_PROVIDER_UNAVAILABLE", catType: null }; }
  }
  if (env.AI_VALIDATION_URL) {
    try {
      const response = await fetch(env.AI_VALIDATION_URL, {
        method: "POST",
        headers: { "content-type": contentType || "image/jpeg", "authorization": env.AI_VALIDATION_TOKEN ? `Bearer ${env.AI_VALIDATION_TOKEN}` : "" },
        body: bytes,
      });
      if (!response.ok) return { status: "needs_review", reason: "AI_PROVIDER_UNAVAILABLE" };
      const result = await response.json();
      return {
        status: result.catDetected && !result.personDetected && !result.screenshotDetected && !result.duplicate && !result.unsafe ? "accepted" : "rejected",
        reason: result.reason || null,
        catType: result.suggestedCoatType || null,
      };
    } catch {
      return { status: "needs_review", reason: "AI_PROVIDER_UNAVAILABLE" };
    }
  }
  return { status: "needs_review", reason: "AI_VALIDATION_NOT_CONFIGURED", catType: null };
}

async function writeAudit(env, userId, action, entityType, entityId, metadata = {}) {
  await env.DB.prepare(
    `INSERT INTO audit_events (id, user_id, action, entity_type, entity_id, metadata_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).bind(id(), userId, action, entityType, entityId, JSON.stringify(metadata), now()).run();
}

async function getSightings(request, env) {
  await ensureRuntimeTables(env);
  const user = userFrom(request);
  const current = now();
  const rows = user
    ? await env.DB.prepare(
      `SELECT id, user_id, cat_type, description, public_geohash, captured_at, published_at, expires_at, visibility,
              EXISTS(SELECT 1 FROM care_flags WHERE care_flags.sighting_id=sightings.id AND care_flags.status='open') AS emergency
       FROM sightings
       WHERE validation_status='accepted' AND published_at <= ? AND expires_at > ?
         AND (visibility='public' OR user_id=?)
         AND NOT EXISTS (SELECT 1 FROM blocks WHERE blocks.user_id=? AND blocks.blocked_user_id=sightings.user_id)
       ORDER BY captured_at DESC LIMIT 200`,
    ).bind(current, current, user.id, user.id).all()
    : await env.DB.prepare(
      `SELECT id, user_id, cat_type, description, public_geohash, captured_at, published_at, expires_at, visibility,
              EXISTS(SELECT 1 FROM care_flags WHERE care_flags.sighting_id=sightings.id AND care_flags.status='open') AS emergency
       FROM sightings WHERE validation_status='accepted' AND visibility='public' AND published_at <= ? AND expires_at > ?
       ORDER BY captured_at DESC LIMIT 200`,
    ).bind(current, current).all();
  return rows.results.map((row) => ({
    id: row.id,
    catType: row.cat_type,
    rarity: rarityFor(row.cat_type),
    description: row.description || "",
    photoUrl: row.visibility === "public" ? `/api/sightings/${row.id}/photo` : null,
    area: geohashCenter(row.public_geohash),
    capturedAt: row.captured_at,
    publishedAt: row.published_at,
    expiresAt: row.expires_at,
    isOwner: Boolean(user && row.user_id === user.id),
    emergency: Boolean(row.emergency),
  }));
}

async function getSightingPhoto(request, env, sightingId) {
  await ensureRuntimeTables(env);
  const sighting = await env.DB.prepare(
    `SELECT photo_key, visibility, validation_status, published_at, expires_at
     FROM sightings WHERE id=? LIMIT 1`,
  ).bind(sightingId).first();
  const current = now();
  if (!sighting || sighting.visibility !== "public" || sighting.validation_status !== "accepted" || sighting.published_at > current || sighting.expires_at <= current) {
    return new Response("Not found", { status: 404 });
  }
  if (!env.BUCKET || !sighting.photo_key) return new Response("Not found", { status: 404 });
  const object = await env.BUCKET.get(sighting.photo_key);
  if (!object) return new Response("Not found", { status: 404 });
  const headers = new Headers();
  headers.set("content-type", object.httpMetadata?.contentType || "image/jpeg");
  headers.set("cache-control", "public, max-age=300, must-revalidate");
  return new Response(object.body, { headers });
}

async function startCaptureSession(request, env) {
  const user = await requireUser(request, env);
  const body = await request.json().catch(() => ({}));
  const cameraPermission = String(body.cameraPermission || "");
  const locationPermission = String(body.locationPermission || "");
  if (cameraPermission !== "granted") return json({ error: "CAMERA_REQUIRED" }, 400);
  if (locationPermission !== "granted") return json({ error: "LOCATION_REQUIRED" }, 400);
  const sessionId = id();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  const timeZone = typeof body.deviceTimeZone === "string" && body.deviceTimeZone.length <= 80 ? body.deviceTimeZone : "Asia/Manila";
  await env.DB.prepare(
    `INSERT INTO capture_sessions (id,user_id,device_time_zone,camera_permission,location_permission,expires_at,created_at)
     VALUES (?,?,?,?,?,?,?)`,
  ).bind(sessionId, user.id, timeZone, cameraPermission, locationPermission, expiresAt, now()).run();
  await writeAudit(env, user.id, "capture_session.started", "capture_session", sessionId, { timeZone });
  return json({ sessionId, expiresAt }, 201);
}

function localDay(timeZone, value = new Date()) {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(value);
  } catch {
    return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).format(value);
  }
}

async function updateStreak(env, userId, timeZone, sightingId) {
  const day = localDay(timeZone);
  const previous = await env.DB.prepare("SELECT current_count,best_count,last_local_day,freeze_count FROM streaks WHERE user_id=?").bind(userId).first();
  let currentCount = 1;
  let freezeCount = Number(previous?.freeze_count ?? 1);
  if (previous?.last_local_day === day) currentCount = Number(previous.current_count || 1);
  else if (previous?.last_local_day) {
    const previousDate = new Date(`${previous.last_local_day}T00:00:00Z`);
    const currentDate = new Date(`${day}T00:00:00Z`);
    const dayGap = Math.round((currentDate - previousDate) / 86400000);
    if (dayGap === 1) currentCount = Number(previous.current_count || 0) + 1;
    else if (dayGap === 2 && freezeCount > 0) { currentCount = Number(previous.current_count || 0) + 1; freezeCount -= 1; }
  }
  const bestCount = Math.max(Number(previous?.best_count || 0), currentCount);
  await env.DB.prepare(
    `INSERT INTO streaks (user_id,current_count,best_count,last_local_day,freeze_count,updated_at)
     VALUES (?,?,?,?,?,?)
     ON CONFLICT(user_id) DO UPDATE SET current_count=excluded.current_count,best_count=excluded.best_count,last_local_day=excluded.last_local_day,freeze_count=excluded.freeze_count,updated_at=excluded.updated_at`,
  ).bind(userId, currentCount, bestCount, day, freezeCount, now()).run();
  await env.DB.prepare("INSERT OR IGNORE INTO reward_ledger (id,user_id,sighting_id,kind,amount,created_at) VALUES (?,?,?,?,?,?)").bind(id(), userId, sightingId, "sighting_xp", 24, now()).run();
  return { currentCount, bestCount, freezeCount };
}

async function getJournal(request, env) {
  const user = await requireUser(request, env);
  const rows = await env.DB.prepare(
    `SELECT journal_entries.id, journal_entries.sighting_id, journal_entries.cat_type,
            journal_entries.spotted_at, journal_entries.first_spotted, journal_entries.created_at,
            sightings.visibility, sightings.validation_status, sightings.expires_at
     FROM journal_entries
     JOIN sightings ON sightings.id = journal_entries.sighting_id
     WHERE journal_entries.user_id=?
     ORDER BY journal_entries.spotted_at DESC LIMIT 200`,
  ).bind(user.id).all();
  const summary = await env.DB.prepare(
    `SELECT COUNT(*) AS total, SUM(CASE WHEN first_spotted=1 THEN 1 ELSE 0 END) AS unique_count
     FROM journal_entries WHERE user_id=?`,
  ).bind(user.id).first();
  return json({
    entries: rows.results.map((row) => ({
      id: row.id,
      sightingId: row.sighting_id,
      catType: row.cat_type || "Unclassified cat",
      spottedAt: row.spotted_at,
      firstSpotted: Boolean(row.first_spotted),
      visibility: row.visibility,
      validationStatus: row.validation_status,
      expiresAt: row.expires_at,
    })),
    summary: { total: Number(summary?.total || 0), unique: Number(summary?.unique_count || 0) },
  });
}

async function getDashboard(request, env) {
  const user = await requireUser(request, env);
  const [sightings, journal, streak, rewards] = await Promise.all([
    getSightings(request, env),
    env.DB.prepare("SELECT COUNT(*) AS total, SUM(CASE WHEN first_spotted=1 THEN 1 ELSE 0 END) AS unique_count FROM journal_entries WHERE user_id=?").bind(user.id).first(),
    env.DB.prepare("SELECT current_count,best_count,freeze_count FROM streaks WHERE user_id=?").bind(user.id).first(),
    env.DB.prepare("SELECT COALESCE(SUM(amount),0) AS total FROM reward_ledger WHERE user_id=?").bind(user.id).first(),
  ]);
  return json({ sightings, journal: { total: Number(journal?.total || 0), unique: Number(journal?.unique_count || 0) }, streak: { current: Number(streak?.current_count || 0), best: Number(streak?.best_count || 0), freezes: Number(streak?.freeze_count || 1) }, xp: Number(rewards?.total || 0) });
}

async function getCareFlags(request, env) {
  const user = await requireUser(request, env);
  const rows = await env.DB.prepare(
    `SELECT care_flags.id, care_flags.sighting_id, care_flags.kind, care_flags.note,
            care_flags.status, care_flags.created_at, sightings.cat_type
     FROM care_flags JOIN sightings ON sightings.id=care_flags.sighting_id
     WHERE care_flags.user_id=? ORDER BY care_flags.created_at DESC LIMIT 100`,
  ).bind(user.id).all();
  return json({ flags: rows.results.map((row) => ({
    id: row.id,
    sightingId: row.sighting_id,
    catType: row.cat_type || "Cat sighting",
    kind: row.kind,
    note: row.note,
    status: row.status,
    createdAt: row.created_at,
  })) });
}

async function updateProfile(request, env) {
  const user = await requireUser(request, env);
  const body = await request.json();
  const displayName = typeof body.displayName === "string" ? body.displayName.trim().slice(0, 80) : null;
  const avatarUrl = typeof body.avatarUrl === "string" ? body.avatarUrl.trim().slice(0, 500) : null;
  const ageGroup = ["13_17", "18_24", "25_34", "35_44", "45_plus", "prefer_not_to_say"].includes(body.ageGroup) ? body.ageGroup : null;
  const timeZone = typeof body.timeZone === "string" && body.timeZone.length <= 80 ? body.timeZone : "Asia/Manila";
  const language = ["en", "fil", "es", "ja"].includes(body.language) ? body.language : "en";
  const defaultVisibility = ["public", "friends", "private"].includes(body.defaultVisibility) ? body.defaultVisibility : "friends";
  const notificationPreference = ["included", "important", "off"].includes(body.notificationPreference) ? body.notificationPreference : "included";
  await env.DB.prepare(
    `UPDATE users SET display_name=COALESCE(?, display_name), avatar_url=COALESCE(?, avatar_url), age_group=COALESCE(?, age_group), time_zone=?, language=?, updated_at=? WHERE id=?`,
  ).bind(displayName, avatarUrl, ageGroup, timeZone, language, now(), user.id).run();
  await env.DB.prepare(
    `INSERT INTO user_settings (user_id,default_visibility,show_age_group,allow_friend_requests,notification_preference,updated_at)
     VALUES (?,?,?,?,?,?)
     ON CONFLICT(user_id) DO UPDATE SET default_visibility=excluded.default_visibility,notification_preference=excluded.notification_preference,updated_at=excluded.updated_at`,
  ).bind(user.id, defaultVisibility, body.showAgeGroup ? 1 : 0, body.allowFriendRequests === false ? 0 : 1, notificationPreference, now()).run();
  await writeAudit(env, user.id, "profile.updated", "user", user.id, { timeZone, language });
   const profile = await env.DB.prepare(`SELECT users.id,users.email,users.display_name,users.avatar_url,users.age_group,users.time_zone,users.language,
      user_settings.default_visibility,user_settings.show_age_group,user_settings.allow_friend_requests,user_settings.notification_preference
      FROM users LEFT JOIN user_settings ON user_settings.user_id=users.id WHERE users.id=?`).bind(user.id).first();
  return json({ user: profile });
}

async function getProfile(request, env) {
  const user = await requireUser(request, env);
  const profile = await env.DB.prepare(`SELECT users.id,users.email,users.display_name,users.avatar_url,users.age_group,users.time_zone,users.language,
      user_settings.default_visibility,user_settings.show_age_group,user_settings.allow_friend_requests,user_settings.notification_preference
      FROM users LEFT JOIN user_settings ON user_settings.user_id=users.id WHERE users.id=?`).bind(user.id).first();
  return json({ user: profile });
}

async function createSighting(request, env) {
  const user = await requireUser(request, env);
  const form = await request.formData();
  const photo = form.get("photo");
  const captureSessionId = String(form.get("captureSessionId") || "");
  const idempotencyKey = String(form.get("idempotencyKey") || "").slice(0, 160);
  const latitude = Number(form.get("latitude"));
  const longitude = Number(form.get("longitude"));
  const description = String(form.get("description") || "").trim().slice(0, 280);
  const visibility = ["public", "friends", "private"].includes(String(form.get("visibility"))) ? String(form.get("visibility")) : "friends";
  if (!captureSessionId || !idempotencyKey || description.length < 8 || !(photo instanceof File) || !photo.type.startsWith("image/") || photo.size > 10 * 1024 * 1024 || !Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return json({ error: "INVALID_SIGHTING" }, 400);
  }
  const existingRequest = await env.DB.prepare("SELECT response_json FROM request_keys WHERE user_id=? AND request_key=?").bind(user.id, idempotencyKey).first();
  if (existingRequest?.response_json) return new Response(existingRequest.response_json, { status: 201, headers: JSON_HEADERS });
  const session = await env.DB.prepare("SELECT id,device_time_zone,expires_at,used_at FROM capture_sessions WHERE id=? AND user_id=?").bind(captureSessionId, user.id).first();
  if (!session || session.used_at || new Date(session.expires_at) <= new Date()) return json({ error: "CAPTURE_SESSION_INVALID" }, 409);
  const recent = await env.DB.prepare("SELECT COUNT(*) AS total FROM sightings WHERE user_id=? AND uploaded_at>? ").bind(user.id, new Date(Date.now() - 60 * 60 * 1000).toISOString()).first();
  if (Number(recent?.total || 0) >= 30) return json({ error: "RATE_LIMITED" }, 429);
  const capturedAt = now();
  const bytes = new Uint8Array(await photo.arrayBuffer());
  const photoHash = await sha256(bytes);
  const duplicate = await env.DB.prepare("SELECT id FROM sightings WHERE photo_hash=? LIMIT 1").bind(photoHash).first();
  if (duplicate) return json({ error: "DUPLICATE_IMAGE", duplicateOf: duplicate.id }, 409);
  const sightingId = id();
  const photoKey = `${user.id}/${sightingId}.${photo.type === "image/png" ? "png" : "jpg"}`;
  if (env.BUCKET) await env.BUCKET.put(photoKey, bytes, { httpMetadata: { contentType: photo.type || "image/jpeg" } });
  const uploadedAt = new Date();
  const publishedAt = new Date(uploadedAt.getTime() + 5 * 60 * 1000);
  const expiresAt = new Date(uploadedAt.getTime() + 24 * 60 * 60 * 1000);
  const validation = await validatePhoto(env, bytes, photo.type);
  await env.DB.prepare(
    `INSERT INTO sightings (id,user_id,photo_key,photo_hash,cat_type,description,validation_status,validation_reason,visibility,latitude,longitude,public_geohash,captured_at,uploaded_at,published_at,expires_at,created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
  ).bind(sightingId, user.id, photoKey, photoHash, validation.catType, description, validation.status, validation.reason, visibility, latitude, longitude, encodeGeohash(latitude, longitude, 6), capturedAt, uploadedAt.toISOString(), publishedAt.toISOString(), expiresAt.toISOString(), uploadedAt.toISOString()).run();
  let streak = null;
  if (validation.status === "accepted") {
    const previousCat = await env.DB.prepare("SELECT 1 FROM journal_entries WHERE user_id=? AND cat_type=? LIMIT 1").bind(user.id, validation.catType || "Unclassified cat").first();
    await env.DB.prepare(
      `INSERT INTO journal_entries (id,user_id,sighting_id,cat_type,spotted_at,first_spotted,created_at) VALUES (?,?,?,?,?,?,?)`,
    ).bind(id(), user.id, sightingId, validation.catType, capturedAt, previousCat ? 0 : 1, now()).run();
    streak = await updateStreak(env, user.id, session.device_time_zone || "Asia/Manila", sightingId);
    const quest = await env.DB.prepare("SELECT id,target FROM quests WHERE slug='daily-pawprint' AND starts_at<=? AND ends_at>? LIMIT 1").bind(now(), now()).first();
    if (quest) await env.DB.prepare(`INSERT INTO quest_progress (user_id,quest_id,count,completed_at,updated_at) VALUES (?,?,?,?,?)
      ON CONFLICT(user_id,quest_id) DO UPDATE SET count=MIN(quest_progress.count+1,excluded.count),completed_at=COALESCE(quest_progress.completed_at,excluded.completed_at),updated_at=excluded.updated_at`)
      .bind(user.id, quest.id, 1, now(), now()).run();
    await createNotification(env, user.id, "sighting", "Pawprint saved", `Your ${validation.catType || "cat"} sighting earned XP. Public pins appear after 5 minutes and expire after 24 hours.`);
  }
  await env.DB.prepare("UPDATE capture_sessions SET used_at=? WHERE id=? AND user_id=?").bind(now(), captureSessionId, user.id).run();
  await writeAudit(env, user.id, "sighting.created", "sighting", sightingId, { validationStatus: validation.status, visibility });
  const responseBody = { sightingId, status: validation.status, reason: validation.reason, catType: validation.catType, rarity: rarityFor(validation.catType), description, publishedAt: publishedAt.toISOString(), expiresAt: expiresAt.toISOString(), rewards: validation.status === "accepted" ? { xp: 24, streak } : null };
  await env.DB.prepare("INSERT INTO request_keys (user_id,request_key,response_json,created_at) VALUES (?,?,?,?)").bind(user.id, idempotencyKey, JSON.stringify(responseBody), now()).run();
  return json(responseBody, 201);
}

async function deleteSighting(request, env, sightingId) {
  const user = await requireUser(request, env);
  const sighting = await env.DB.prepare("SELECT id,photo_key FROM sightings WHERE id=? AND user_id=?").bind(sightingId, user.id).first();
  if (!sighting) return json({ error: "SIGHTING_NOT_FOUND" }, 404);
  if (env.BUCKET && sighting.photo_key) await env.BUCKET.delete(sighting.photo_key);
  await env.DB.batch([
    env.DB.prepare("DELETE FROM care_flags WHERE sighting_id=?").bind(sightingId),
    env.DB.prepare("DELETE FROM reports WHERE target_type='sighting' AND target_id=?").bind(sightingId),
    env.DB.prepare("DELETE FROM reward_ledger WHERE sighting_id=?").bind(sightingId),
    env.DB.prepare("DELETE FROM journal_entries WHERE sighting_id=?").bind(sightingId),
    env.DB.prepare("DELETE FROM sightings WHERE id=? AND user_id=?").bind(sightingId, user.id),
  ]);
  await writeAudit(env, user.id, "sighting.deleted", "sighting", sightingId);
  return json({ status: "deleted", sightingId });
}

async function createCareFlag(request, env) {
  const user = await requireUser(request, env);
  const body = await request.json();
  const kind = String(body.kind || "");
  if (!body.sightingId || !["thin", "injured", "pregnant", "lone_kitten", "other"].includes(kind)) return json({ error: "INVALID_CARE_FLAG" }, 400);
  const sighting = await env.DB.prepare("SELECT id FROM sightings WHERE id=? AND validation_status='accepted' AND expires_at>? AND (visibility='public' OR user_id=?)").bind(String(body.sightingId), now(), user.id).first();
  if (!sighting) return json({ error: "SIGHTING_NOT_ELIGIBLE" }, 400);
  const duplicate = await env.DB.prepare("SELECT id FROM care_flags WHERE user_id=? AND sighting_id=? AND kind=? AND status='open' LIMIT 1").bind(user.id, sighting.id, kind).first();
  if (duplicate) return json({ error: "CARE_FLAG_EXISTS", careFlagId: duplicate.id }, 409);
  const careId = id();
  await env.DB.prepare("INSERT INTO care_flags (id,user_id,sighting_id,kind,note,created_at) VALUES (?,?,?,?,?,?)").bind(careId, user.id, sighting.id, kind, typeof body.note === "string" ? body.note.slice(0, 500) : null, now()).run();
  await writeAudit(env, user.id, "care_flag.created", "care_flag", careId);
  return json({ careFlagId: careId, status: "open" }, 201);
}

async function createReport(request, env) {
  const user = await requireUser(request, env);
  const body = await request.json();
  const allowedTargets = ["sighting", "user", "care_flag"];
  const allowedReasons = ["unsafe", "harassment", "privacy", "spam", "other"];
  if (!allowedTargets.includes(body.targetType) || !body.targetId || !allowedReasons.includes(body.reason)) return json({ error: "INVALID_REPORT" }, 400);
  const reportId = id();
  await env.DB.prepare("INSERT INTO reports (id,user_id,target_type,target_id,reason,note,created_at) VALUES (?,?,?,?,?,?,?)").bind(reportId, user.id, body.targetType, String(body.targetId), body.reason, typeof body.note === "string" ? body.note.slice(0, 500) : null, now()).run();
  await env.DB.prepare("INSERT INTO moderation_queue (id,target_type,target_id,reason,created_at) VALUES (?,?,?,?,?)").bind(id(), body.targetType, String(body.targetId), body.reason, now()).run();
  await writeAudit(env, user.id, "report.created", body.targetType, body.targetId, { reportId });
  return json({ reportId, status: "open" }, 201);
}

async function createBlock(request, env) {
  const user = await requireUser(request, env);
  const body = await request.json();
  const blockedUserId = String(body.blockedUserId || "");
  if (!blockedUserId || blockedUserId === user.id) return json({ error: "INVALID_BLOCK" }, 400);
  const target = await env.DB.prepare("SELECT id FROM users WHERE id=?").bind(blockedUserId).first();
  if (!target) return json({ error: "USER_NOT_FOUND" }, 404);
  await env.DB.prepare("INSERT OR IGNORE INTO blocks (user_id,blocked_user_id,created_at) VALUES (?,?,?)").bind(user.id, blockedUserId, now()).run();
  await writeAudit(env, user.id, "user.blocked", "user", blockedUserId);
  return json({ status: "blocked", blockedUserId });
}

async function exportUser(request, env) {
  const user = await requireUser(request, env);
  const [profile, settings, sightings, journal, streaks, rewards, careFlags, reports] = await Promise.all([
    env.DB.prepare("SELECT id,email,display_name,time_zone,language,created_at FROM users WHERE id=?").bind(user.id).first(),
    env.DB.prepare("SELECT default_visibility,show_age_group,allow_friend_requests,notification_preference,updated_at FROM user_settings WHERE user_id=?").bind(user.id).first(),
    env.DB.prepare("SELECT id,cat_type,validation_status,visibility,captured_at,uploaded_at,expires_at FROM sightings WHERE user_id=? ORDER BY captured_at DESC").bind(user.id).all(),
    env.DB.prepare("SELECT id,sighting_id,cat_type,spotted_at,first_spotted,created_at FROM journal_entries WHERE user_id=? ORDER BY spotted_at DESC").bind(user.id).all(),
    env.DB.prepare("SELECT current_count,best_count,last_local_day,freeze_count,updated_at FROM streaks WHERE user_id=?").bind(user.id).first(),
    env.DB.prepare("SELECT id,sighting_id,kind,amount,created_at FROM reward_ledger WHERE user_id=? ORDER BY created_at DESC").bind(user.id).all(),
    env.DB.prepare("SELECT id,sighting_id,kind,note,status,created_at FROM care_flags WHERE user_id=? ORDER BY created_at DESC").bind(user.id).all(),
    env.DB.prepare("SELECT id,target_type,target_id,reason,note,status,created_at FROM reports WHERE user_id=? ORDER BY created_at DESC").bind(user.id).all(),
  ]);
  await writeAudit(env, user.id, "user.exported", "user", user.id);
  return new Response(JSON.stringify({ exportedAt: now(), profile, settings, sightings: sightings.results, journal: journal.results, streaks, rewards: rewards.results, careFlags: careFlags.results, reports: reports.results }), { headers: { "content-type": "application/json; charset=utf-8", "content-disposition": `attachment; filename=pawprint-export-${user.id}.json` } });
}

async function deleteUser(request, env) {
  const user = await requireUser(request, env);
  const rows = await env.DB.prepare("SELECT photo_key FROM sightings WHERE user_id=?").bind(user.id).all();
  if (env.BUCKET) await Promise.all(rows.results.filter((row) => row.photo_key).map((row) => env.BUCKET.delete(row.photo_key)));
  await env.DB.batch([
    env.DB.prepare("DELETE FROM request_keys WHERE user_id=?").bind(user.id),
    env.DB.prepare("DELETE FROM capture_sessions WHERE user_id=?").bind(user.id),
    env.DB.prepare("DELETE FROM reward_ledger WHERE user_id=?").bind(user.id),
    env.DB.prepare("DELETE FROM user_settings WHERE user_id=?").bind(user.id),
    env.DB.prepare("DELETE FROM care_flags WHERE user_id=?").bind(user.id),
    env.DB.prepare("DELETE FROM reports WHERE user_id=?").bind(user.id),
    env.DB.prepare("DELETE FROM journal_entries WHERE user_id=?").bind(user.id),
    env.DB.prepare("DELETE FROM sightings WHERE user_id=?").bind(user.id),
    env.DB.prepare("DELETE FROM streaks WHERE user_id=?").bind(user.id),
    env.DB.prepare("DELETE FROM audit_events WHERE user_id=?").bind(user.id),
    env.DB.prepare("DELETE FROM blocks WHERE user_id=? OR blocked_user_id=?").bind(user.id, user.id),
    env.DB.prepare("DELETE FROM users WHERE id=?").bind(user.id),
  ]);
  return json({ status: "completed" });
}

async function awardBadges(env, userId, stats) {
  const badges = [];
  if (Number(stats.journalTotal || 0) >= 1) badges.push("first-pawprint");
  if (Number(stats.journalUnique || 0) >= 5) badges.push("alley-scout");
  if (Number(stats.bestStreak || 0) >= 7) badges.push("week-walker");
  if (Number(stats.careFlags || 0) >= 1) badges.push("gentle-helper");
  for (const badgeId of badges) await env.DB.prepare("INSERT OR IGNORE INTO user_badges (user_id,badge_id,earned_at) VALUES (?,?,?)").bind(userId, badgeId, now()).run();
  return badges;
}

async function getProgress(request, env) {
  const user = await requireUser(request, env);
  const [xp, journal, streak, flags, badges, quests] = await Promise.all([
    env.DB.prepare("SELECT COALESCE(SUM(amount),0) AS total FROM reward_ledger WHERE user_id=?").bind(user.id).first(),
    env.DB.prepare("SELECT COUNT(*) AS total, SUM(first_spotted) AS unique_count FROM journal_entries WHERE user_id=?").bind(user.id).first(),
    env.DB.prepare("SELECT current_count,best_count,freeze_count FROM streaks WHERE user_id=?").bind(user.id).first(),
    env.DB.prepare("SELECT COUNT(*) AS total FROM care_flags WHERE user_id=?").bind(user.id).first(),
    env.DB.prepare("SELECT badge_id,earned_at FROM user_badges WHERE user_id=? ORDER BY earned_at DESC").bind(user.id).all(),
    env.DB.prepare(`SELECT quests.slug,quests.title,quests.description,quests.target,COALESCE(quest_progress.count,0) AS count,quest_progress.completed_at
      FROM quests LEFT JOIN quest_progress ON quest_progress.quest_id=quests.id AND quest_progress.user_id=?
      WHERE quests.ends_at>? ORDER BY quests.ends_at ASC`).bind(user.id, now()).all(),
  ]);
  const totalXp = Number(xp?.total || 0);
  const stats = { journalTotal: Number(journal?.total || 0), journalUnique: Number(journal?.unique_count || 0), bestStreak: Number(streak?.best_count || 0), careFlags: Number(flags?.total || 0) };
  const earned = await awardBadges(env, user.id, stats);
  return json({ xp: totalXp, level: levelFor(totalXp), nextLevelXp: Math.pow(levelFor(totalXp), 2) * 100, streak: { current: Number(streak?.current_count || 0), best: Number(streak?.best_count || 0), freezes: Number(streak?.freeze_count || 1) }, badges: [...new Set([...(badges.results || []).map((row) => row.badge_id), ...earned])], quests: quests.results.map((row) => ({ slug: row.slug, title: row.title, description: row.description, target: Number(row.target), count: Number(row.count), completed: Boolean(row.completed_at) })), rarity: { common: "Common", uncommon: "Uncommon", rare: "Rare", superRare: "Super Rare" } });
}

async function getLeaderboards(request, env) {
  const scope = ["barangay", "city", "country"].includes(new URL(request.url).searchParams.get("scope")) ? new URL(request.url).searchParams.get("scope") : "country";
  const regionExpression = scope === "barangay" ? "COALESCE(MAX(sightings.barangay_name),'Approximate barangay')" : scope === "city" ? "COALESCE(MAX(sightings.city_name),'Approximate city')" : "'Philippines'";
  const rows = await env.DB.prepare(`SELECT users.id,COALESCE(users.display_name,'Pawprint spotter') AS name,${regionExpression} AS region,
      COUNT(DISTINCT sightings.id) AS sightings,COALESCE(SUM(reward_ledger.amount),0) AS xp
      FROM users LEFT JOIN sightings ON sightings.user_id=users.id AND sightings.validation_status='accepted'
      LEFT JOIN reward_ledger ON reward_ledger.user_id=users.id
      GROUP BY users.id,users.display_name ORDER BY xp DESC,sightings DESC LIMIT 50`).all();
  return json({ scope, leaders: rows.results.map((row, index) => ({ rank: index + 1, id: row.id, name: row.name, region: row.region, sightings: Number(row.sightings || 0), xp: Number(row.xp || 0), level: levelFor(row.xp) })) });
}

async function getNotifications(request, env) {
  const user = await requireUser(request, env);
  const rows = await env.DB.prepare("SELECT id,type,title,body,read_at,created_at FROM notifications WHERE user_id=? ORDER BY created_at DESC LIMIT 50").bind(user.id).all();
  return json({ notifications: rows.results.map((row) => ({ id: row.id, type: row.type, title: row.title, body: row.body, read: Boolean(row.read_at), createdAt: row.created_at })) });
}

async function markNotification(request, env, notificationId) {
  const user = await requireUser(request, env);
  await env.DB.prepare("UPDATE notifications SET read_at=? WHERE id=? AND user_id=?").bind(now(), notificationId, user.id).run();
  return json({ status: "read", notificationId });
}

async function getCalendar(request, env) {
  const user = await requireUser(request, env);
  const rows = await env.DB.prepare(`SELECT journal_entries.id,journal_entries.cat_type,journal_entries.spotted_at,
      sightings.expires_at,sightings.city_name,sightings.barangay_name
      FROM journal_entries JOIN sightings ON sightings.id=journal_entries.sighting_id
      WHERE journal_entries.user_id=? ORDER BY journal_entries.spotted_at DESC LIMIT 400`).bind(user.id).all();
  return json({ entries: rows.results.map((row) => ({ id: row.id, catType: row.cat_type || "Unclassified cat", spottedAt: row.spotted_at, area: new Date(row.expires_at) <= new Date() ? (row.barangay_name || row.city_name || "Approximate Philippines area") : "Private until pin expires" })) });
}

async function getMapData(request, env) {
  const zoom = Math.max(3, Math.min(18, Number(new URL(request.url).searchParams.get("zoom") || 12)));
  const sightings = await getSightings(request, env);
  const precision = zoom < 6 ? 2 : zoom < 9 ? 3 : zoom < 12 ? 4 : 5;
  const groups = new Map();
  for (const sighting of sightings) {
    const key = encodeGeohash(sighting.area.latitude, sighting.area.longitude, precision);
    const group = groups.get(key) || { id: key, count: 0, emergency: false, area: geohashCenter(key), sample: sighting };
    group.count += 1; group.emergency ||= sighting.emergency; groups.set(key, group);
  }
  return json({ zoom, precision, clusters: [...groups.values()].map(({ sample, ...cluster }) => ({ ...cluster, sample: { id: sample.id, catType: sample.catType, description: sample.description, photoUrl: sample.photoUrl, capturedAt: sample.capturedAt } })) });
}

async function getCommunity(request, env) {
  await ensureRuntimeTables(env);
  const kind = new URL(request.url).searchParams.get("kind");
  const query = kind && ["feeding_station", "tnr", "adoption"].includes(kind) ? "SELECT id,kind,title,description,public_geohash,area_name,contact,verified,created_at FROM community_assets WHERE kind=? ORDER BY created_at DESC LIMIT 100" : "SELECT id,kind,title,description,public_geohash,area_name,contact,verified,created_at FROM community_assets ORDER BY created_at DESC LIMIT 100";
  const rows = kind && ["feeding_station", "tnr", "adoption"].includes(kind) ? await env.DB.prepare(query).bind(kind).all() : await env.DB.prepare(query).all();
  return json({ assets: rows.results.map((row) => ({ id: row.id, kind: row.kind, title: row.title, description: row.description, area: row.public_geohash ? geohashCenter(row.public_geohash) : null, areaName: row.area_name || "Approximate area", contact: row.contact, verified: Boolean(row.verified), createdAt: row.created_at })) });
}

async function createRescueRequest(request, env) {
  const user = await requireUser(request, env);
  const body = await request.json().catch(() => ({}));
  const need = String(body.need || "").trim().slice(0, 80);
  if (!need) return json({ error: "RESCUE_NEED_REQUIRED" }, 400);
  const sighting = body.sightingId ? await env.DB.prepare("SELECT public_geohash FROM sightings WHERE id=? AND (user_id=? OR visibility='public') LIMIT 1").bind(String(body.sightingId), user.id).first() : null;
  const requestId = id();
  await env.DB.prepare("INSERT INTO rescue_requests (id,user_id,sighting_id,need,note,public_geohash,created_at) VALUES (?,?,?,?,?,?,?)").bind(requestId, user.id, body.sightingId || null, need, String(body.note || "").slice(0, 500), sighting?.public_geohash || null, now()).run();
  await createNotification(env, user.id, "rescue_request", "Rescue request received", "Your request is queued for nearby volunteers and partner shelters.");
  await writeAudit(env, user.id, "rescue_request.created", "rescue_request", requestId);
  return json({ requestId, status: "open" }, 201);
}

async function createCommunityAsset(request, env) {
  const user = await requireUser(request, env);
  const body = await request.json().catch(() => ({}));
  const kind = String(body.kind || "");
  if (!["feeding_station", "tnr", "adoption"].includes(kind) || !String(body.title || "").trim()) return json({ error: "INVALID_COMMUNITY_ASSET" }, 400);
  const latitude = Number(body.latitude), longitude = Number(body.longitude);
  const assetId = id();
  await env.DB.prepare("INSERT INTO community_assets (id,kind,title,description,latitude,longitude,public_geohash,area_name,contact,created_by,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)")
    .bind(assetId, kind, String(body.title).trim().slice(0, 120), String(body.description || "").slice(0, 500), Number.isFinite(latitude) ? latitude : null, Number.isFinite(longitude) ? longitude : null, Number.isFinite(latitude) && Number.isFinite(longitude) ? encodeGeohash(latitude, longitude, 5) : null, String(body.areaName || "Approximate area").slice(0, 120), String(body.contact || "").slice(0, 160), user.id, now()).run();
  return json({ assetId, status: "pending_review" }, 201);
}

async function getWrapped(request, env) {
  const user = await requireUser(request, env);
  const [journal, xp, streak, care] = await Promise.all([
    env.DB.prepare("SELECT COUNT(*) AS total,COUNT(DISTINCT cat_type) AS types FROM journal_entries WHERE user_id=?").bind(user.id).first(),
    env.DB.prepare("SELECT COALESCE(SUM(amount),0) AS total FROM reward_ledger WHERE user_id=?").bind(user.id).first(),
    env.DB.prepare("SELECT best_count FROM streaks WHERE user_id=?").bind(user.id).first(),
    env.DB.prepare("SELECT COUNT(*) AS total FROM care_flags WHERE user_id=? AND status!='rejected'").bind(user.id).first(),
  ]);
  return json({ year: new Date().getUTCFullYear(), stats: { catsSpotted: Number(journal?.total || 0), typesCollected: Number(journal?.types || 0), xp: Number(xp?.total || 0), bestStreak: Number(streak?.best_count || 0), careFlags: Number(care?.total || 0) }, shareText: `My Pawprint Wrapped: ${Number(journal?.total || 0)} cats spotted, ${Number(xp?.total || 0)} XP earned, and ${Number(care?.total || 0)} care signals shared.` });
}

async function getShareCard(request, env) {
  const wrapped = await getWrapped(request, env);
  const payload = await wrapped.json();
  return json({ card: { ...payload, brand: "Pawprint", tagline: "Spot cats. Leave a safer trace." } });
}

async function getAdminAnalytics(request, env) {
  if (!isAdmin(request, env)) return json({ error: "ADMIN_REQUIRED" }, 403);
  const [users, sightings, accepted, retention] = await Promise.all([
    env.DB.prepare("SELECT COUNT(*) AS total FROM users").first(),
    env.DB.prepare("SELECT COUNT(*) AS total FROM sightings").first(),
    env.DB.prepare("SELECT COUNT(*) AS total FROM sightings WHERE validation_status='accepted'").first(),
    env.DB.prepare("SELECT COUNT(DISTINCT user_id) AS active_users FROM sightings WHERE uploaded_at>=datetime('now','-30 day')").first(),
  ]);
  return json({ metrics: { users: Number(users?.total || 0), sightings: Number(sightings?.total || 0), acceptedPhotos: Number(accepted?.total || 0), activeUsers30d: Number(retention?.active_users || 0) }, generatedAt: now() });
}

async function getModerationQueue(request, env) {
  if (!isAdmin(request, env)) return json({ error: "ADMIN_REQUIRED" }, 403);
  const rows = await env.DB.prepare("SELECT id,target_type,target_id,reason,status,action,created_at,resolved_at FROM moderation_queue WHERE status='open' ORDER BY created_at ASC LIMIT 200").all();
  return json({ items: rows.results });
}

async function resolveModeration(request, env, moderationId) {
  if (!isAdmin(request, env)) return json({ error: "ADMIN_REQUIRED" }, 403);
  const user = await requireUser(request, env);
  const body = await request.json().catch(() => ({}));
  const action = ["dismiss", "remove", "needs_review"].includes(body.action) ? body.action : "needs_review";
  await env.DB.prepare("UPDATE moderation_queue SET status=?,action=?,assigned_to=?,resolved_at=? WHERE id=?").bind(action === "needs_review" ? "open" : "resolved", action, user.id, action === "needs_review" ? null : now(), moderationId).run();
  await writeAudit(env, user.id, "moderation.resolved", "moderation", moderationId, { action });
  return json({ moderationId, status: action === "needs_review" ? "open" : "resolved", action });
}

async function getPartnerReports(request, env) {
  if (!isAdmin(request, env)) return json({ error: "ADMIN_REQUIRED" }, 403);
  const rows = await env.DB.prepare("SELECT id,partner_name,period_start,period_end,payload_json,created_at FROM partner_reports ORDER BY created_at DESC LIMIT 100").all();
  return json({ reports: rows.results.map((row) => ({ ...row, payload: JSON.parse(row.payload_json || "{}") })) });
}

async function createPartnerReport(request, env) {
  if (!isAdmin(request, env)) return json({ error: "ADMIN_REQUIRED" }, 403);
  const user = await requireUser(request, env);
  const body = await request.json().catch(() => ({}));
  if (!String(body.partnerName || "").trim() || !body.periodStart || !body.periodEnd) return json({ error: "INVALID_PARTNER_REPORT" }, 400);
  const reportId = id();
  await env.DB.prepare("INSERT INTO partner_reports (id,partner_name,period_start,period_end,payload_json,created_by,created_at) VALUES (?,?,?,?,?,?,?)")
    .bind(reportId, String(body.partnerName).trim().slice(0, 120), String(body.periodStart), String(body.periodEnd), JSON.stringify(body.payload || {}), user.id, now()).run();
  return json({ reportId, status: "created" }, 201);
}

async function createWaitlist(request, env) {
  const body = await request.json().catch(() => ({}));
  const email = String(body.email || "").trim().toLowerCase();
  const platformInterest = ["ios", "android", "ios_android"].includes(body.platformInterest) ? body.platformInterest : "ios_android";
  const source = String(body.source || "landing").trim().slice(0, 80) || "landing";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return json({ error: "INVALID_EMAIL" }, 400);
  await env.DB.prepare("INSERT OR IGNORE INTO waitlist_signups (id,email,platform_interest,source,created_at) VALUES (?,?,?,?,?)")
    .bind(id(), email, platformInterest, source, now()).run();
  return json({ status: "subscribed", platformInterest }, 201);
}

async function expireSightings(request, env) {
  const secret = env.EXPIRY_JOB_TOKEN;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) return json({ error: "FORBIDDEN" }, 403);
  const expired = await env.DB.prepare("UPDATE sightings SET validation_reason=COALESCE(validation_reason,'expired') WHERE expires_at <= ? AND validation_status='accepted' RETURNING id").bind(now()).all();
  return json({ expiredCount: expired.results.length });
}

async function api(request, env, url) {
  if (url.pathname === "/api/health") return json({ ok: true, service: "pawprint", time: now() });
  if (url.pathname === "/api/capture-sessions" && request.method === "POST") return startCaptureSession(request, env);
  if (url.pathname === "/api/dashboard" && request.method === "GET") return getDashboard(request, env);
  if (url.pathname === "/api/progress" && request.method === "GET") return getProgress(request, env);
  if (url.pathname === "/api/leaderboards" && request.method === "GET") return getLeaderboards(request, env);
  if (url.pathname === "/api/notifications" && request.method === "GET") return getNotifications(request, env);
  if (url.pathname.startsWith("/api/notifications/") && request.method === "PATCH") return markNotification(request, env, url.pathname.split("/").pop());
  if (url.pathname === "/api/calendar" && request.method === "GET") return getCalendar(request, env);
  if (url.pathname === "/api/map" && request.method === "GET") return getMapData(request, env);
  if (url.pathname === "/api/community" && request.method === "GET") return getCommunity(request, env);
  if (url.pathname === "/api/rescue-requests" && request.method === "POST") return createRescueRequest(request, env);
  if (url.pathname === "/api/community-assets" && request.method === "GET") return getCommunity(request, env);
  if (url.pathname === "/api/community-assets" && request.method === "POST") return createCommunityAsset(request, env);
  if (url.pathname === "/api/wrapped" && request.method === "GET") return getWrapped(request, env);
  if (url.pathname === "/api/share-card" && request.method === "GET") return getShareCard(request, env);
  if (url.pathname === "/api/admin/analytics" && request.method === "GET") return getAdminAnalytics(request, env);
  if (url.pathname === "/api/admin/moderation" && request.method === "GET") return getModerationQueue(request, env);
  if (url.pathname.startsWith("/api/admin/moderation/") && request.method === "POST") return resolveModeration(request, env, url.pathname.split("/").pop());
  if (url.pathname === "/api/admin/partner-reports" && request.method === "GET") return getPartnerReports(request, env);
  if (url.pathname === "/api/admin/partner-reports" && request.method === "POST") return createPartnerReport(request, env);
  if (url.pathname === "/api/waitlist" && request.method === "POST") return createWaitlist(request, env);
  if (url.pathname === "/api/me" && request.method === "GET") {
    return getProfile(request, env);
  }
  if (url.pathname === "/api/sightings" && request.method === "GET") return json({ sightings: await getSightings(request, env) });
  if (url.pathname === "/api/sightings" && request.method === "POST") return createSighting(request, env);
  const photoMatch = url.pathname.match(/^\/api\/sightings\/([^/]+)\/photo$/);
  if (photoMatch && request.method === "GET") return getSightingPhoto(request, env, photoMatch[1]);
  if (url.pathname.startsWith("/api/sightings/") && request.method === "DELETE") return deleteSighting(request, env, url.pathname.split("/").pop());
  if (url.pathname === "/api/journal" && request.method === "GET") return getJournal(request, env);
  if (url.pathname === "/api/care-flags" && request.method === "GET") return getCareFlags(request, env);
  if (url.pathname === "/api/care-flags" && request.method === "POST") return createCareFlag(request, env);
  if (url.pathname === "/api/profile" && request.method === "PATCH") return updateProfile(request, env);
  if (url.pathname === "/api/reports" && request.method === "POST") return createReport(request, env);
  if (url.pathname === "/api/blocks" && request.method === "POST") return createBlock(request, env);
  if (url.pathname === "/api/export" && request.method === "POST") return exportUser(request, env);
  if (url.pathname === "/api/account" && request.method === "DELETE") return deleteUser(request, env);
  if (url.pathname === "/api/jobs/expire" && request.method === "POST") return expireSightings(request, env);
  return json({ error: "NOT_FOUND" }, 404);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      if (url.pathname.startsWith("/api/")) return await api(request, env, url);
      if (request.method === "GET" && url.pathname === "/manifest.webmanifest") return new Response(PWA_MANIFEST, { headers: { "content-type": "application/manifest+json", "cache-control": "public, max-age=3600" } });
      if (request.method === "GET" && url.pathname === "/sw.js") return new Response(PWA_SERVICE_WORKER, { headers: { "content-type": "application/javascript", "cache-control": "public, max-age=3600" } });
      if (request.method === "GET" && url.pathname === "/assets/pawprint-sneak-peek.gif") {
        const binary = atob(SNEAK_PEEK_GIF);
        const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
        return new Response(bytes, { headers: { "content-type": "image/gif", "cache-control": "public, max-age=86400" } });
      }
      if (request.method === "GET" && url.pathname === "/assets/pawprint-sneakpeek.svg") {
        return new Response(SNEAK_PEEK_SVG, { headers: { "content-type": "image/svg+xml", "cache-control": "public, max-age=86400" } });
      }
      if (request.method === "GET" && url.pathname === "/assets/pawprint-icon.svg") {
        return new Response(PAWPRINT_ICON_SVG, { headers: { "content-type": "image/svg+xml", "cache-control": "public, max-age=86400" } });
      }
      if (request.method === "GET" && url.pathname === "/assets/cat-paw.svg") {
        return new Response(CAT_PAW_SVG, { headers: { "content-type": "image/svg+xml", "cache-control": "public, max-age=86400" } });
      }
      if (request.method === "GET" && (url.pathname === "/" || url.pathname === "/index.html")) return new Response(APP_HTML, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
      return new Response("Not found", { status: 404 });
    } catch (error) {
      if (error instanceof Response) return error;
      console.error(error);
      return json({ error: error?.message || "INTERNAL_ERROR" }, 500);
    }
  },
};
