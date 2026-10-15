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
  const id = request.headers.get("oai-authenticated-user-id");
  if (!id) return null;
  return {
    id,
    email: request.headers.get("oai-authenticated-user-email") || null,
    name: request.headers.get("oai-authenticated-user-full-name") || null,
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
  return user;
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
    const response = await fetch(env.AI_VALIDATION_URL, {
      method: "POST",
      headers: { "content-type": contentType || "image/jpeg", "authorization": env.AI_VALIDATION_TOKEN ? `Bearer ${env.AI_VALIDATION_TOKEN}` : "" },
      body: bytes,
    });
    if (!response.ok) return { status: "needs_review", reason: "AI_PROVIDER_UNAVAILABLE" };
    const result = await response.json();
    return {
      status: result.catDetected && !result.personDetected && !result.screenshotDetected && !result.duplicate ? "accepted" : "rejected",
      reason: result.reason || null,
      catType: result.suggestedCoatType || null,
    };
  }
  return { status: "needs_review", reason: "AI_VALIDATION_NOT_CONFIGURED", catType: null };
}

async function writeAudit(env, userId, action, entityType, entityId, metadata = {}) {
  await env.DB.prepare(
    `INSERT INTO audit_events (id, user_id, action, entity_type, entity_id, metadata_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).bind(id(), userId, action, entityType, entityId, JSON.stringify(metadata), now()).run();
}

async function getSightings(request, env) {
  const user = userFrom(request);
  const current = now();
  const rows = user
    ? await env.DB.prepare(
      `SELECT id, user_id, cat_type, public_geohash, captured_at, expires_at, visibility,
              EXISTS(SELECT 1 FROM care_flags WHERE care_flags.sighting_id=sightings.id AND care_flags.status='open') AS emergency
       FROM sightings
       WHERE validation_status='accepted' AND published_at <= ? AND expires_at > ? AND (visibility='public' OR user_id=?)
       ORDER BY captured_at DESC LIMIT 200`,
    ).bind(current, current, user.id).all()
    : await env.DB.prepare(
      `SELECT id, user_id, cat_type, public_geohash, captured_at, expires_at, visibility,
              EXISTS(SELECT 1 FROM care_flags WHERE care_flags.sighting_id=sightings.id AND care_flags.status='open') AS emergency
       FROM sightings WHERE validation_status='accepted' AND visibility='public' AND published_at <= ? AND expires_at > ?
       ORDER BY captured_at DESC LIMIT 200`,
    ).bind(current, current).all();
  return rows.results.map((row) => ({
    id: row.id,
    catType: row.cat_type,
    area: geohashCenter(row.public_geohash),
    capturedAt: row.captured_at,
    expiresAt: row.expires_at,
    emergency: Boolean(row.emergency),
  }));
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
  await env.DB.prepare(
    `UPDATE users SET display_name=COALESCE(?, display_name), time_zone=?, language=?, updated_at=? WHERE id=?`,
  ).bind(displayName, timeZone, language, now(), user.id).run();
  await writeAudit(env, user.id, "profile.updated", "user", user.id, { timeZone, language });
  const profile = await env.DB.prepare("SELECT id,email,display_name,time_zone,language FROM users WHERE id=?").bind(user.id).first();
  return json({ user: profile });
}

async function createSighting(request, env) {
  const user = await requireUser(request, env);
  const form = await request.formData();
  const photo = form.get("photo");
  const latitude = Number(form.get("latitude"));
  const longitude = Number(form.get("longitude"));
  const capturedAtDate = new Date(String(form.get("capturedAt")));
  const visibility = ["public", "friends", "private"].includes(String(form.get("visibility"))) ? String(form.get("visibility")) : "friends";
  if (!(photo instanceof File) || !Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180 || Number.isNaN(capturedAtDate.getTime())) {
    return json({ error: "INVALID_SIGHTING" }, 400);
  }
  const capturedAt = capturedAtDate.toISOString();
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
    `INSERT INTO sightings (id,user_id,photo_key,photo_hash,cat_type,validation_status,validation_reason,visibility,latitude,longitude,public_geohash,captured_at,uploaded_at,published_at,expires_at,created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
  ).bind(sightingId, user.id, photoKey, photoHash, validation.catType, validation.status, validation.reason, visibility, latitude, longitude, encodeGeohash(latitude, longitude, 6), capturedAt, uploadedAt.toISOString(), publishedAt.toISOString(), expiresAt.toISOString(), uploadedAt.toISOString()).run();
  if (validation.status === "accepted") {
    await env.DB.prepare(
      `INSERT INTO journal_entries (id,user_id,sighting_id,cat_type,spotted_at,first_spotted,created_at) VALUES (?,?,?,?,?,?,?)`,
    ).bind(id(), user.id, sightingId, validation.catType, capturedAt, 1, now()).run();
  }
  await writeAudit(env, user.id, "sighting.created", "sighting", sightingId, { validationStatus: validation.status, visibility });
  return json({ sightingId, status: validation.status, reason: validation.reason, expiresAt: expiresAt.toISOString(), rewards: validation.status === "accepted" ? { xp: 24 } : null }, 201);
}

async function createCareFlag(request, env) {
  const user = await requireUser(request, env);
  const body = await request.json();
  if (!body.sightingId || !["thin", "injured", "pregnant", "lone_kitten", "other"].includes(body.kind)) return json({ error: "INVALID_CARE_FLAG" }, 400);
  const careId = id();
  await env.DB.prepare("INSERT INTO care_flags (id,user_id,sighting_id,kind,note,created_at) VALUES (?,?,?,?,?,?)").bind(careId, user.id, body.sightingId, body.kind, body.note || null, now()).run();
  await writeAudit(env, user.id, "care_flag.created", "care_flag", careId);
  return json({ careFlagId: careId, status: "open" }, 201);
}

async function createReport(request, env) {
  const user = await requireUser(request, env);
  const body = await request.json();
  const reportId = id();
  await env.DB.prepare("INSERT INTO reports (id,user_id,target_type,target_id,reason,note,created_at) VALUES (?,?,?,?,?,?,?)").bind(reportId, user.id, body.targetType, body.targetId, body.reason, body.note || null, now()).run();
  await writeAudit(env, user.id, "report.created", body.targetType, body.targetId, { reportId });
  return json({ reportId, status: "open" }, 201);
}

async function exportUser(request, env) {
  const user = await requireUser(request, env);
  const [profile, sightings, journal, streaks, careFlags, reports] = await Promise.all([
    env.DB.prepare("SELECT id,email,display_name,time_zone,language,created_at FROM users WHERE id=?").bind(user.id).first(),
    env.DB.prepare("SELECT id,cat_type,validation_status,visibility,captured_at,uploaded_at,expires_at FROM sightings WHERE user_id=? ORDER BY captured_at DESC").bind(user.id).all(),
    env.DB.prepare("SELECT id,sighting_id,cat_type,spotted_at,first_spotted,created_at FROM journal_entries WHERE user_id=? ORDER BY spotted_at DESC").bind(user.id).all(),
    env.DB.prepare("SELECT current_count,best_count,last_local_day,freeze_count,updated_at FROM streaks WHERE user_id=?").bind(user.id).first(),
    env.DB.prepare("SELECT id,sighting_id,kind,note,status,created_at FROM care_flags WHERE user_id=? ORDER BY created_at DESC").bind(user.id).all(),
    env.DB.prepare("SELECT id,target_type,target_id,reason,note,status,created_at FROM reports WHERE user_id=? ORDER BY created_at DESC").bind(user.id).all(),
  ]);
  await writeAudit(env, user.id, "user.exported", "user", user.id);
  return new Response(JSON.stringify({ exportedAt: now(), profile, sightings: sightings.results, journal: journal.results, streaks, careFlags: careFlags.results, reports: reports.results }), { headers: { "content-type": "application/json; charset=utf-8", "content-disposition": `attachment; filename= pawprint-export-${user.id}.json` } });
}

async function deleteUser(request, env) {
  const user = await requireUser(request, env);
  const rows = await env.DB.prepare("SELECT photo_key FROM sightings WHERE user_id=?").bind(user.id).all();
  if (env.BUCKET) await Promise.all(rows.results.filter((row) => row.photo_key).map((row) => env.BUCKET.delete(row.photo_key)));
  await env.DB.batch([
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
  if (url.pathname === "/api/me" && request.method === "GET") {
    const user = await requireUser(request, env);
    const profile = await env.DB.prepare("SELECT id,email,display_name,time_zone,language FROM users WHERE id=?").bind(user.id).first();
    return json({ user: profile });
  }
  if (url.pathname === "/api/sightings" && request.method === "GET") return json({ sightings: await getSightings(request, env) });
  if (url.pathname === "/api/sightings" && request.method === "POST") return createSighting(request, env);
  if (url.pathname === "/api/journal" && request.method === "GET") return getJournal(request, env);
  if (url.pathname === "/api/care-flags" && request.method === "GET") return getCareFlags(request, env);
  if (url.pathname === "/api/care-flags" && request.method === "POST") return createCareFlag(request, env);
  if (url.pathname === "/api/profile" && request.method === "PATCH") return updateProfile(request, env);
  if (url.pathname === "/api/reports" && request.method === "POST") return createReport(request, env);
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
