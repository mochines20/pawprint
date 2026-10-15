const APP_HTML = __PAWPRINT_HTML__;

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

async function validatePhoto(env, bytes, contentType) {
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
    description: row.description || "",
    area: geohashCenter(row.public_geohash),
    capturedAt: row.captured_at,
    publishedAt: row.published_at,
    expiresAt: row.expires_at,
    isOwner: Boolean(user && row.user_id === user.id),
    emergency: Boolean(row.emergency),
  }));
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
  const timeZone = typeof body.timeZone === "string" && body.timeZone.length <= 80 ? body.timeZone : "Asia/Manila";
  const language = ["en", "fil", "es", "ja"].includes(body.language) ? body.language : "en";
  const defaultVisibility = ["public", "friends", "private"].includes(body.defaultVisibility) ? body.defaultVisibility : "friends";
  const notificationPreference = ["included", "important", "off"].includes(body.notificationPreference) ? body.notificationPreference : "included";
  await env.DB.prepare(
    `UPDATE users SET display_name=COALESCE(?, display_name), time_zone=?, language=?, updated_at=? WHERE id=?`,
  ).bind(displayName, timeZone, language, now(), user.id).run();
  await env.DB.prepare(
    `INSERT INTO user_settings (user_id,default_visibility,show_age_group,allow_friend_requests,notification_preference,updated_at)
     VALUES (?,?,?,?,?,?)
     ON CONFLICT(user_id) DO UPDATE SET default_visibility=excluded.default_visibility,notification_preference=excluded.notification_preference,updated_at=excluded.updated_at`,
  ).bind(user.id, defaultVisibility, body.showAgeGroup ? 1 : 0, body.allowFriendRequests === false ? 0 : 1, notificationPreference, now()).run();
  await writeAudit(env, user.id, "profile.updated", "user", user.id, { timeZone, language });
  const profile = await env.DB.prepare(`SELECT users.id,users.email,users.display_name,users.time_zone,users.language,
      user_settings.default_visibility,user_settings.show_age_group,user_settings.allow_friend_requests,user_settings.notification_preference
      FROM users LEFT JOIN user_settings ON user_settings.user_id=users.id WHERE users.id=?`).bind(user.id).first();
  return json({ user: profile });
}

async function getProfile(request, env) {
  const user = await requireUser(request, env);
  const profile = await env.DB.prepare(`SELECT users.id,users.email,users.display_name,users.time_zone,users.language,
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
  }
  await env.DB.prepare("UPDATE capture_sessions SET used_at=? WHERE id=? AND user_id=?").bind(now(), captureSessionId, user.id).run();
  await writeAudit(env, user.id, "sighting.created", "sighting", sightingId, { validationStatus: validation.status, visibility });
  const responseBody = { sightingId, status: validation.status, reason: validation.reason, description, publishedAt: publishedAt.toISOString(), expiresAt: expiresAt.toISOString(), rewards: validation.status === "accepted" ? { xp: 24, streak } : null };
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
  if (url.pathname === "/api/me" && request.method === "GET") {
    return getProfile(request, env);
  }
  if (url.pathname === "/api/sightings" && request.method === "GET") return json({ sightings: await getSightings(request, env) });
  if (url.pathname === "/api/sightings" && request.method === "POST") return createSighting(request, env);
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
      if (request.method === "GET" && (url.pathname === "/" || url.pathname === "/index.html")) return new Response(APP_HTML, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
      return new Response("Not found", { status: 404 });
    } catch (error) {
      if (error instanceof Response) return error;
      console.error(error);
      return json({ error: error?.message || "INTERNAL_ERROR" }, 500);
    }
  },
};
