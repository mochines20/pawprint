const APP_HTML = __PAWPRINT_HTML__;
const ADMIN_HTML = __PAWPRINT_ADMIN_HTML__;
const SNEAK_PEEK_GIF = "__PAWPRINT_SNEAK_PEEK_GIF__";
const SNEAK_PEEK_SVG = __PAWPRINT_SNEAK_PEEK_SVG__;
const PAWPRINT_ICON_SVG = __PAWPRINT_ICON_SVG__;
const CAT_PAW_SVG = __PAWPRINT_CAT_PAW_SVG__;
const PAWPRINT_CAT_JS = __PAWPRINT_CAT_JS__;
const SUPABASE_AUTH_JS = __PAWPRINT_SUPABASE_AUTH_JS__;
const PAW_LOADER_JS = __PAWPRINT_PAW_LOADER_JS__;
const PAWLOADER_ACTUAL_JS = __PAWPRINT_PAWLOADER_ACTUAL_JS__;
const PAWLOADER_CSS = __PAWPRINT_PAWLOADER_CSS__;
const PAWLOADER_BRIDGE = __PAWPRINT_PAWLOADER_BRIDGE__;
const PAWLAUNCH_JS = __PAWPRINT_PAWLAUNCH_JS__;
const PAWLAUNCH_CSS = __PAWPRINT_PAWLAUNCH_CSS__;
const PAWONBOARD_JS = __PAWPRINT_PAWONBOARD_JS__;
const PAWONBOARD_CSS = __PAWPRINT_PAWONBOARD_CSS__;
const PAWONBOARD_CAT = __PAWPRINT_PAWONBOARD_CAT__;
const PAWTRAIL_JS = __PAWPRINT_PAWTRAIL_JS__;
const OFFLINE_QUEUE_JS = __PAWPRINT_OFFLINE_QUEUE_JS__;
const ADMIN_CONSOLE_JS = __PAWPRINT_ADMIN_CONSOLE_JS__;
const ADMIN_APP_JS = __PAWPRINT_ADMIN_APP_JS__;
const ADMIN_APP_CSS = __PAWPRINT_ADMIN_APP_CSS__;
const MOBILE_UI_JS = __PAWPRINT_MOBILE_UI_JS__;
const MOBILE_UI_CSS = __PAWPRINT_MOBILE_UI_CSS__;
const MOBILE_FONT = __PAWPRINT_MOBILE_FONT__;
const MOBILE_FONT_LICENSE = __PAWPRINT_MOBILE_FONT_LICENSE__;
const PWA_MANIFEST = JSON.stringify({ name: "Pawprint", short_name: "Pawprint", start_url: "/#app", display: "standalone", background_color: "#f1f2f4", theme_color: "#ffb815", description: "Gotta spot ’em all—safely.", icons: [{ src: "/assets/pawprint-icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any maskable" }] });
const PWA_SERVICE_WORKER = `const CACHE='pawprint-shell-v10-live-preview'; self.addEventListener('install',event=>{self.skipWaiting();event.waitUntil(caches.open(CACHE))}); self.addEventListener('activate',event=>event.waitUntil(Promise.all([self.clients.claim(),caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key))))]))); self.addEventListener('fetch',event=>{if(event.request.method!=='GET')return;const requestUrl=new URL(event.request.url);const isNavigation=event.request.mode==='navigate'||requestUrl.pathname==='/';const networkFirst=fetch(event.request).then(response=>{if(requestUrl.origin===location.origin){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy));}return response;});event.respondWith(networkFirst.catch(()=>caches.match(event.request).then(cached=>cached||(isNavigation?caches.match('/'):Response.error()))));});`;
const PWA_SERVICE_WORKER_WITH_PUSH = `${PWA_SERVICE_WORKER} self.addEventListener('push',event=>{const data=event.data?event.data.json():{};event.waitUntil(self.registration.showNotification(data.title||'Pawprint',{body:data.body||'Your Pawprint has an update.',icon:'/assets/pawprint-icon.svg',badge:'/assets/pawprint-icon.svg',data:{url:data.url||'/#app'}}));}); self.addEventListener('notificationclick',event=>{event.notification.close();event.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(list=>{const target=event.notification.data&&event.notification.data.url||'/#app';const existing=list.find(client=>client.url.includes(location.origin));return existing?(existing.focus(),existing.navigate(target)):clients.openWindow(target);}));});`;

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

async function supabaseUserFrom(request, env) {
  const authorization = request.headers.get("authorization") || "";
  const token = authorization.replace(/^Bearer\s+/i, "").trim();
  const supabaseUrl = String(env.SUPABASE_URL || "").replace(/\/$/, "");
  const anonKey = String(env.SUPABASE_ANON_KEY || "");
  if (!token || !supabaseUrl || !anonKey) return null;
  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { apikey: anonKey, Authorization: `Bearer ${token}` },
  });
  if (!response.ok) return null;
  const data = await response.json().catch(() => null);
  if (!data?.id) return null;
  return { id: data.id, email: data.email || null, name: null, provider: data.app_metadata?.provider || null };
}

async function authenticatedUser(request, env) {
  const user = await supabaseUserFrom(request, env);
  if (user) return user;
  // Legacy identity is opt-in only, so production cannot silently fall back to a second login system.
  if (String(env.AUTH_MODE || "").toLowerCase() === "legacy") return userFrom(request);
  return null;
}

async function requireUser(request, env) {
  const user = await authenticatedUser(request, env);
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
  // D1 schema is provisioned by drizzle migrations before the Worker is
  // deployed. Never run CREATE/ALTER TABLE on an authenticated request:
  // dashboard, map, journal, and profile requests arrive concurrently and
  // D1 can reject those competing schema writes with a 500. Keep this hook
  // for call-site compatibility; schema changes belong in drizzle migrations.
  return env;
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
const XP_MEDAL_CATALOG = [
  { id: "xp-paw-seed", title: "Paw Seed", description: "Your first little mark on the Pawprint trail.", xpRequired: 0, tone: "mist" },
  { id: "xp-first-paw", title: "First Paw", description: "A safe first step for the community.", xpRequired: 24, tone: "amber" },
  { id: "xp-alley-scout", title: "Alley Scout", description: "You are learning the streets with care.", xpRequired: 100, tone: "sage" },
  { id: "xp-night-watcher", title: "Night Watcher", description: "A steady eye for cats who need a little space.", xpRequired: 250, tone: "ink" },
  { id: "xp-street-naturalist", title: "Street Naturalist", description: "A thoughtful record of neighborhood life.", xpRequired: 500, tone: "coral" },
  { id: "xp-pawprint-legend", title: "Pawprint Legend", description: "A long, gentle trail of verified care.", xpRequired: 1000, tone: "gold" },
];
const EASTER_REWARD_CATALOG = [
  { id: "easter-twenty-in-a-day", title: "Cat Marathon", description: "Photograph 20 accepted cat sightings in one local day.", requirement: "20 cats in one day", tone: "amber" },
  { id: "easter-rare-find", title: "Rare Find", description: "Find an accepted rare or super-rare cat pattern.", requirement: "Rare cat found", tone: "coral" },
  { id: "easter-gentle-helper", title: "Gentle Helper", description: "Send a care signal for a cat that needs help.", requirement: "Cat helped", tone: "sage" },
];
function medalsFor(totalXp, badgeRows = [], earnedIds = []) {
  const earnedMap = new Map((badgeRows || []).map((row) => [row.badge_id, row.earned_at]));
  for (const id of earnedIds || []) if (!earnedMap.has(id)) earnedMap.set(id, null);
  return XP_MEDAL_CATALOG.map((medal) => {
    const earned = Number(totalXp || 0) >= medal.xpRequired || earnedMap.has(medal.id);
    return { ...medal, earned, earnedAt: earnedMap.get(medal.id) || null, remainingXp: Math.max(0, medal.xpRequired - Number(totalXp || 0)) };
  });
}
function easterRewardsFor(criteria = {}, badgeRows = [], earnedIds = []) {
  const earnedMap = new Map((badgeRows || []).map((row) => [row.badge_id, row.earned_at]));
  for (const id of earnedIds || []) if (!earnedMap.has(id)) earnedMap.set(id, null);
  return EASTER_REWARD_CATALOG.map((reward) => {
    const triggered = reward.id === "easter-twenty-in-a-day" ? Boolean(criteria.twentyInDay)
      : reward.id === "easter-rare-find" ? Boolean(criteria.rareFind)
        : reward.id === "easter-gentle-helper" ? Boolean(criteria.careHelp) : false;
    const earned = triggered || earnedMap.has(reward.id);
    return { ...reward, earned, earnedAt: earnedMap.get(reward.id) || null };
  });
}
async function isAdmin(request, env) {
  const user = await authenticatedUser(request, env);
  const configured = String(env.ADMIN_USER_IDS || "").split(",").map((value) => value.trim()).filter(Boolean);
  return Boolean(user && configured.includes(user.id));
}
async function createNotification(env, userId, type, title, body) {
  await env.DB.prepare("INSERT INTO notifications (id,user_id,type,title,body,created_at) VALUES (?,?,?,?,?,?)")
    .bind(id(), userId, type, title, body, now()).run();
}

async function sendBrevoWaitlistEmail(env, email, platformInterest) {
  const apiKey = String(env.BREVO_API_KEY || "").trim();
  const senderEmail = String(env.BREVO_SENDER_EMAIL || "").trim();
  if (!apiKey || !senderEmail) return { sent: false, reason: "BREVO_NOT_CONFIGURED" };
  const platform = platformInterest === "ios" ? "iOS" : platformInterest === "android" ? "Android" : "iOS & Android";
  const publicUrl = String(env.PAWPRINT_PUBLIC_URL || "").replace(/\/$/, "");
  const logoUrl = publicUrl ? `${publicUrl}/assets/pawprint-logo.png` : "";
  const logoMarkup = logoUrl
    ? `<img src="${logoUrl}" alt="Pawprint logo" width="44" height="44" style="display:inline-block;vertical-align:middle;border:2px solid #151515;border-radius:14px;background:#fff;object-fit:cover">`
    : `<span style="display:inline-block;vertical-align:middle;width:44px;height:44px;border:2px solid #151515;border-radius:14px;background:#ffb400;color:#151515;font-size:22px;font-weight:800;line-height:40px;text-align:center">P</span>`;
  const payload = {
    sender: { email: senderEmail, name: String(env.BREVO_SENDER_NAME || "Pawprint") },
    to: [{ email }],
    subject: "You’re on the Pawprint early-access list",
  };
  payload.htmlContent = `<div style="margin:0;background:#faf8f4;color:#151515;font-family:Arial,Helvetica,sans-serif;padding:24px 12px 40px"><div style="max-width:620px;margin:0 auto"><div style="padding:8px 8px 18px">${logoMarkup}<span style="display:inline-block;vertical-align:middle;margin-left:10px;font-size:22px;font-weight:800">Pawprint</span></div><div style="background:#151515;border:2px solid #151515;border-radius:26px 26px 0 0;padding:28px;color:#fff"><div style="color:#ffb400;font-size:12px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase">Early access</div><h1 style="margin:14px 0 12px;font-size:34px;line-height:1.08">Your pawprint is saved.</h1><p style="margin:0;font-size:18px;font-weight:700;line-height:1.45">You’re on the Pawprint early-access list.</p></div><div style="background:#fff;border:2px solid #151515;border-top:0;border-radius:0 0 26px 26px;box-shadow:0 7px 0 #151515;padding:28px"><p style="margin:0 0 24px;color:#77736c;font-size:16px;line-height:1.6">We’ll send launch updates for ${platform}.</p><div style="background:#fff1c9;border:1px solid #f0d88a;border-radius:16px;padding:14px 16px;font-size:14px;line-height:1.5"><strong>🐾 A safer trace starts small.</strong><br>Your updates help us build a kinder, more careful way to spot street cats.</div><p style="margin:24px 0 0;padding-top:18px;border-top:1px solid #e3dfd6;color:#77736c;font-size:13px;line-height:1.55">Public pins stay approximate and delayed for safety.</p></div><p style="margin:28px 10px 0;color:#77736c;font-size:12px;line-height:1.6;text-align:center"><strong style="color:#151515">Pawprint</strong> · Gotta spot ’em all.<br>You’re receiving this because you joined Pawprint updates.</p></div></div>`;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "content-type": "application/json", "api-key": apiKey },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!response.ok) return { sent: false, reason: `BREVO_${response.status}` };
    return { sent: true };
  } catch (error) {
    return { sent: false, reason: String(error?.message || "BREVO_UNAVAILABLE") };
  }
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

const AI_VALIDATION_PROMPT = "Inspect this camera capture for Pawprint and return JSON only. Confirm that a clearly visible real cat is present, while rejecting obvious screenshots, photos of screens, collages, or images with no cat. Use high precision for safety flags: do not mark aiGenerated or unsafe because of a cat's body shape, breed appearance, fur pattern, lighting, background blur, compression, low resolution, or unusual pose. A real cat photo can look stylized. Set aiGenerated=true only when there are multiple unmistakable synthetic artifacts such as impossible anatomy, warped/repeated features, broken text, inconsistent shadows, or obvious digital compositing, and only when confidence is at least 0.85; otherwise keep aiGenerated=false and aiGeneratedConfidence at or below 0.30. Set unsafe=true only for graphic injury, cruelty, severe distress, sexual/nudity content, or dangerous human content; unusual weight or appearance is not unsafe. If uncertain, keep these flags false and explain the uncertainty instead of guessing. Use booleans for catDetected, personDetected, screenshotDetected, unsafe, duplicate, and aiGenerated. Include numeric confidence values from 0 to 1 for catConfidence, breedConfidence, and aiGeneratedConfidence. Do not guess a breed when visual evidence is weak. Suggest one breed only when supported (for example domestic shorthair, Siamese, Persian, Maine Coon, Bengal, Ragdoll, Sphynx, Scottish Fold, British Shorthair, or mixed breed), plus one coat/pattern label from: orange tabby, tuxedo, black, white, calico, tortoiseshell, gray tabby, ginger-white, mixed, unclassified. Explain the decision briefly in reason.";

function providerHeaders(env, contentType = "application/json") {
  const headers = { "content-type": contentType };
  if (env.OLLAMA_API_TOKEN) headers.authorization = `Bearer ${env.OLLAMA_API_TOKEN}`;
  else if (env.OLLAMA_USERNAME && env.OLLAMA_PASSWORD) headers.authorization = `Basic ${btoa(`${env.OLLAMA_USERNAME}:${env.OLLAMA_PASSWORD}`)}`;
  return headers;
}

function ollamaEndpoint(base, path) {
  const normalizedBase = String(base || "").replace(/\/+$/, "");
  const normalizedPath = String(path || "").startsWith("/") ? path : `/${path}`;
  return `${normalizedBase}${normalizedPath}`;
}

async function validateWithOllama(env, bytes, contentType) {
  const base = env.OLLAMA_BASE_URL || env.OLLAMA_API_URL;
  if (!base) throw new Error("OLLAMA_URL_MISSING");
  const mode = String(env.OLLAMA_API_MODE || "native").toLowerCase();
  const configuredPath = env.OLLAMA_API_PATH;
  const paths = configuredPath ? [configuredPath] : mode === "openai" ? ["/v1/chat/completions"] : ["/api/chat"];
  const model = env.OLLAMA_MODEL || "qwen2.5vl:7b";
  const encoded = bytesToBase64(bytes);
  let lastError = null;
  for (const path of paths) {
    const isOpenAI = mode === "openai" || /\/v1\/chat\/completions$/.test(path);
    const body = isOpenAI ? {
      model,
      stream: false,
      temperature: 0,
      messages: [
        { role: "system", content: AI_VALIDATION_PROMPT },
        { role: "user", content: [
          { type: "text", text: "Analyze this image and return the requested JSON only." },
          { type: "image_url", image_url: { url: `data:${contentType || "image/jpeg"};base64,${encoded}` } },
        ] },
      ],
    } : {
      model,
      stream: false,
      options: { temperature: 0 },
      messages: [
        { role: "system", content: AI_VALIDATION_PROMPT },
        { role: "user", content: "Analyze this image and return the requested JSON only.", images: [encoded] },
      ],
    };
    try {
      const response = await fetch(ollamaEndpoint(base, path), { method: "POST", headers: providerHeaders(env), body: JSON.stringify(body) });
      if (!response.ok) { lastError = new Error(`OLLAMA_${response.status}`); continue; }
      const payload = await response.json();
      const text = isOpenAI ? payload.choices?.[0]?.message?.content || "" : payload.message?.content || payload.response || "";
      return normalizeValidation(parseModelJson(text), env);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error("OLLAMA_PROVIDER_UNAVAILABLE");
}

async function validateWithGemini(env, bytes, contentType) {
  const model = env.GEMINI_MODEL || "gemini-2.5-flash";
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY },
    body: JSON.stringify({
      contents: [{ parts: [
        { text: AI_VALIDATION_PROMPT },
        { inlineData: { mimeType: contentType || "image/jpeg", data: bytesToBase64(bytes) } },
      ] }],
      generationConfig: {
        temperature: 0,
        responseFormat: { text: { mimeType: "application/json", schema: {
          type: "OBJECT",
          properties: {
            catDetected: { type: "BOOLEAN" }, personDetected: { type: "BOOLEAN" }, screenshotDetected: { type: "BOOLEAN" },
            unsafe: { type: "BOOLEAN" }, duplicate: { type: "BOOLEAN" }, aiGenerated: { type: "BOOLEAN" },
            catConfidence: { type: "NUMBER" }, breedConfidence: { type: "NUMBER" }, aiGeneratedConfidence: { type: "NUMBER" },
            reason: { type: "STRING" }, suggestedBreed: { type: "STRING" }, suggestedCoatType: { type: "STRING" },
          },
          required: ["catDetected", "personDetected", "screenshotDetected", "unsafe", "duplicate", "aiGenerated", "catConfidence", "breedConfidence", "aiGeneratedConfidence", "reason", "suggestedBreed", "suggestedCoatType"],
        } } },
      },
    }),
  });
  if (!response.ok) throw new Error(`GEMINI_${response.status}`);
  const payload = await response.json();
  const text = payload.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("") || "";
  return normalizeValidation(parseModelJson(text), env);
}

function boundedConfidence(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.min(1, number)) : fallback;
}

function normalizeValidation(result = {}, env = {}) {
  const catDetected = result.catDetected === true;
  const personDetected = result.personDetected === true;
  const screenshotDetected = result.screenshotDetected === true;
  const unsafe = result.unsafe === true;
  const duplicate = result.duplicate === true;
  const aiGenerated = result.aiGenerated === true;
  const catConfidence = boundedConfidence(result.catConfidence ?? result.confidence, catDetected ? 0.8 : 0);
  const breedConfidence = boundedConfidence(result.breedConfidence, 0);
  const aiGeneratedConfidence = boundedConfidence(result.aiGeneratedConfidence, aiGenerated ? 1 : 0);
  const catThreshold = boundedConfidence(env.AI_CAT_CONFIDENCE_THRESHOLD, 0.78);
  const aiThreshold = boundedConfidence(env.AI_GENERATED_CONFIDENCE_THRESHOLD, 0.85);
  let status = "accepted";
  let reason = "AI_VALIDATED";
  if (unsafe) { status = "rejected"; reason = "UNSAFE_IMAGE"; }
  else if (personDetected) { status = "rejected"; reason = "PERSON_DETECTED"; }
  else if (screenshotDetected) { status = "rejected"; reason = "SCREENSHOT_DETECTED"; }
  else if (duplicate) { status = "rejected"; reason = "DUPLICATE_IMAGE"; }
  else if (!catDetected || catConfidence < catThreshold) { status = "rejected"; reason = "IMAGE_NOT_A_CAT"; }
  else if ((aiGenerated && aiGeneratedConfidence >= aiThreshold) || aiGeneratedConfidence >= aiThreshold) { status = "rejected"; reason = "AI_GENERATED_IMAGE"; }
  else if (catConfidence < Math.min(0.9, catThreshold + 0.1) || aiGeneratedConfidence >= 0.35) { status = "needs_review"; reason = "VALIDATION_PENDING"; }
  const breed = typeof result.suggestedBreed === "string" && result.suggestedBreed.trim() ? result.suggestedBreed.trim().slice(0, 80) : null;
  const coat = typeof result.suggestedCoatType === "string" && result.suggestedCoatType.trim() ? result.suggestedCoatType.trim().slice(0, 80) : null;
  const catType = breed || coat || "Unclassified cat";
  return {
    status,
    reason,
    catDetected,
    personDetected,
    screenshotDetected,
    unsafe,
    duplicate,
    catType,
    catBreed: breed,
    coatType: coat,
    catConfidence,
    breedConfidence,
    aiGenerated,
    aiGeneratedConfidence,
    detail: typeof result.reason === "string" ? result.reason.slice(0, 500) : null,
  };
}

async function validatePhoto(env, bytes, contentType) {
  if (env.OLLAMA_BASE_URL || env.OLLAMA_API_URL || String(env.AI_PROVIDER || "").toLowerCase() === "ollama") {
    try { return await validateWithOllama(env, bytes, contentType); }
    catch { return { status: "needs_review", reason: "AI_PROVIDER_UNAVAILABLE", catType: null, catBreed: null, coatType: null, catConfidence: null, aiGenerated: false, aiGeneratedConfidence: null, detail: null }; }
  }
  if (env.GEMINI_API_KEY) {
    try { return await validateWithGemini(env, bytes, contentType); }
    catch { return { status: "needs_review", reason: "AI_PROVIDER_UNAVAILABLE", catType: null, catBreed: null, coatType: null, catConfidence: null, aiGenerated: false, aiGeneratedConfidence: null, detail: null }; }
  }
  if (env.AI_VALIDATION_URL) {
    try {
      const response = await fetch(env.AI_VALIDATION_URL, {
        method: "POST",
        headers: { "content-type": contentType || "image/jpeg", "authorization": env.AI_VALIDATION_TOKEN ? `Bearer ${env.AI_VALIDATION_TOKEN}` : "" },
        body: bytes,
      });
      if (!response.ok) return { status: "needs_review", reason: "AI_PROVIDER_UNAVAILABLE", catType: null, catBreed: null, coatType: null, catConfidence: null, aiGenerated: false, aiGeneratedConfidence: null, detail: null };
      const result = await response.json();
      return normalizeValidation(result, env);
    } catch {
      return { status: "needs_review", reason: "AI_PROVIDER_UNAVAILABLE", catType: null, catBreed: null, coatType: null, catConfidence: null, aiGenerated: false, aiGeneratedConfidence: null, detail: null };
    }
  }
  return { status: "needs_review", reason: "AI_VALIDATION_NOT_CONFIGURED", catType: null, catBreed: null, coatType: null, catConfidence: null, aiGenerated: false, aiGeneratedConfidence: null, detail: null };
}

async function writeAudit(env, userId, action, entityType, entityId, metadata = {}) {
  await env.DB.prepare(
    `INSERT INTO audit_events (id, user_id, action, entity_type, entity_id, metadata_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).bind(id(), userId, action, entityType, entityId, JSON.stringify(metadata), now()).run();
}

async function getSightings(request, env) {
  await ensureRuntimeTables(env);
  const user = await authenticatedUser(request, env);
  const current = now();
  const rows = user
    ? await env.DB.prepare(
      `SELECT id, user_id, cat_type, cat_breed, coat_type, cat_confidence, description, public_geohash, captured_at, published_at, expires_at, visibility,
              EXISTS(SELECT 1 FROM care_flags WHERE care_flags.sighting_id=sightings.id AND care_flags.status='open') AS emergency
       FROM sightings
       WHERE validation_status='accepted' AND published_at <= ? AND expires_at > ?
         AND (visibility='public' OR user_id=?)
         AND NOT EXISTS (SELECT 1 FROM blocks WHERE blocks.user_id=? AND blocks.blocked_user_id=sightings.user_id)
       ORDER BY captured_at DESC LIMIT 200`,
    ).bind(current, current, user.id, user.id).all()
    : await env.DB.prepare(
      `SELECT id, user_id, cat_type, cat_breed, coat_type, cat_confidence, description, public_geohash, captured_at, published_at, expires_at, visibility,
              EXISTS(SELECT 1 FROM care_flags WHERE care_flags.sighting_id=sightings.id AND care_flags.status='open') AS emergency
       FROM sightings WHERE validation_status='accepted' AND visibility='public' AND published_at <= ? AND expires_at > ?
       ORDER BY captured_at DESC LIMIT 200`,
    ).bind(current, current).all();
  return rows.results.map((row) => ({
    id: row.id,
    catType: row.cat_type,
    catBreed: row.cat_breed || null,
    coatType: row.coat_type || null,
    catConfidence: row.cat_confidence == null ? null : Number(row.cat_confidence),
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
    `SELECT user_id, photo_key, visibility, validation_status, published_at, expires_at
     FROM sightings WHERE id=? LIMIT 1`,
  ).bind(sightingId).first();
  const current = now();
  const user = await authenticatedUser(request, env);
  const isOwner = Boolean(user && user.id === sighting?.user_id);
  const isPublic = Boolean(sighting && sighting.visibility === "public" && sighting.published_at <= current && sighting.expires_at > current);
  if (!sighting || sighting.validation_status !== "accepted" || (!isOwner && !isPublic)) {
    return new Response("Not found", { status: 404 });
  }
  if (!env.BUCKET || !sighting.photo_key) return new Response("Not found", { status: 404 });
  const object = await env.BUCKET.get(sighting.photo_key);
  if (!object) return new Response("Not found", { status: 404 });
  const headers = new Headers();
  headers.set("content-type", object.httpMetadata?.contentType || "image/jpeg");
  headers.set("cache-control", isPublic ? "public, max-age=300, must-revalidate" : "private, no-store");
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

function streakDecision(timeZone, streak, activeDays) {
  const today = localDay(timeZone);
  const todayDate = new Date(`${today}T00:00:00Z`);
  const lastDay = String(streak?.last_local_day || "");
  const freezeCount = Number(streak?.freeze_count ?? 0);
  let dayGap = null;
  if (lastDay) {
    const lastDate = new Date(`${lastDay}T00:00:00Z`);
    if (Number.isFinite(lastDate.getTime())) dayGap = Math.round((todayDate - lastDate) / 86400000);
  }
  const protectedGap = dayGap === 1 || (dayGap === 2 && freezeCount > 0);
  const active = Boolean(lastDay && (lastDay === today || protectedGap));
  const days = [];
  for (let offset = -3; offset <= 3; offset += 1) {
    const date = new Date(todayDate);
    date.setUTCDate(date.getUTCDate() + offset);
    const key = date.toISOString().slice(0, 10);
    let status = activeDays.has(key) ? "complete" : "empty";
    if (key === today) status = activeDays.has(key) ? "complete" : "today";
    if (!activeDays.has(key) && dayGap === 2 && freezeCount > 0 && key === lastDay) status = "freeze";
    days.push({
      key,
      label: new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short" }).format(date),
      number: date.getUTCDate(),
      status,
      isToday: key === today,
    });
  }
  return {
    today,
    active,
    broken: !active,
    state: active ? "active" : "broken",
    dayGap,
    label: active ? "Orange cat streak" : "Black cat reset",
    helper: active ? "Validated pawprints keep it glowing." : "Validate a cat photo to restart your streak.",
    days,
  };
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
            sightings.visibility, sightings.validation_status, sightings.expires_at,
            sightings.description, sightings.cat_breed, sightings.coat_type,
            sightings.city_name, sightings.barangay_name, sightings.photo_key
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
      rarity: row.cat_type ? rarityFor(row.cat_type) : null,
      spottedAt: row.spotted_at,
      firstSpotted: Boolean(row.first_spotted),
      visibility: row.visibility,
      validationStatus: row.validation_status,
      expiresAt: row.expires_at,
      description: row.description || "",
      catBreed: row.cat_breed || "",
      coatType: row.coat_type || "",
      photoUrl: row.photo_key ? `/api/sightings/${encodeURIComponent(row.sighting_id)}/photo` : null,
      locationLabel: row.visibility === "private"
        ? "Private Journal area · exact location hidden"
        : (row.barangay_name || row.city_name || "Approximate public area · exact location hidden"),
    })),
    summary: { total: Number(summary?.total || 0), unique: Number(summary?.unique_count || 0) },
  });
}

async function getDashboard(request, env) {
  const user = await requireUser(request, env);
  const [sightings, journal, streak, rewards, profile, recentAccepted] = await Promise.all([
    getSightings(request, env),
    env.DB.prepare("SELECT COUNT(*) AS total, SUM(CASE WHEN first_spotted=1 THEN 1 ELSE 0 END) AS unique_count FROM journal_entries WHERE user_id=?").bind(user.id).first(),
    env.DB.prepare("SELECT current_count,best_count,last_local_day,freeze_count FROM streaks WHERE user_id=?").bind(user.id).first(),
    env.DB.prepare("SELECT COALESCE(SUM(amount),0) AS total FROM reward_ledger WHERE user_id=?").bind(user.id).first(),
    env.DB.prepare("SELECT time_zone FROM users WHERE id=?").bind(user.id).first(),
    env.DB.prepare("SELECT captured_at FROM sightings WHERE user_id=? AND validation_status='accepted' AND captured_at>=? ORDER BY captured_at DESC LIMIT 400").bind(user.id, new Date(Date.now() - 14 * 86400000).toISOString()).all(),
  ]);
  const timeZone = String(profile?.time_zone || "Asia/Manila");
  const activeDays = new Set((recentAccepted.results || []).map((row) => localDay(timeZone, new Date(row.captured_at))));
  const decision = streakDecision(timeZone, streak, activeDays);
  return json({
    sightings,
    journal: { total: Number(journal?.total || 0), unique: Number(journal?.unique_count || 0) },
    streak: { current: Number(streak?.current_count || 0), best: Number(streak?.best_count || 0), freezes: Number(streak?.freeze_count || 1), lastDay: streak?.last_local_day || null, timeZone, ...decision },
    streakCalendar: decision.days,
    today: { key: decision.today, validated: activeDays.has(decision.today) },
    xp: Number(rewards?.total || 0),
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
  const recent = await env.DB.prepare("SELECT COUNT(*) AS total FROM sightings WHERE user_id=? AND uploaded_at>? ").bind(user.id, new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()).first();
  if (Number(recent?.total || 0) >= 20) return json({ error: "RATE_LIMITED" }, 429);
  const clientCapturedAt = String(form.get("capturedAt") || "");
  const clientCapturedMs = Date.parse(clientCapturedAt);
  const uploadStartedMs = Date.now();
  if (!Number.isFinite(clientCapturedMs) || clientCapturedMs > uploadStartedMs + 120000 || uploadStartedMs - clientCapturedMs > 10 * 60 * 1000) {
    return json({ error: "CAPTURE_TIME_INVALID" }, 409);
  }
  const capturedAt = new Date(clientCapturedMs).toISOString();
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
    `INSERT INTO sightings (id,user_id,photo_key,photo_hash,cat_type,cat_breed,coat_type,cat_confidence,ai_confidence,ai_generated,ai_generated_confidence,validation_json,description,validation_status,validation_reason,visibility,latitude,longitude,public_geohash,captured_at,uploaded_at,published_at,expires_at,created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
  ).bind(
    sightingId, user.id, photoKey, photoHash, validation.catType, validation.catBreed, validation.coatType,
    validation.catConfidence ?? null, validation.catConfidence ?? null, validation.aiGenerated ? 1 : 0,
    validation.aiGeneratedConfidence ?? null, JSON.stringify(validation), description, validation.status, validation.reason,
    visibility, latitude, longitude, ["Rare", "Super Rare"].includes(rarityFor(validation.catType)) ? encodeGeohash(latitude, longitude, 4) : encodeGeohash(latitude, longitude, 6), capturedAt, uploadedAt.toISOString(),
    publishedAt.toISOString(), expiresAt.toISOString(), uploadedAt.toISOString(),
  ).run();
  if (validation.status !== "accepted" || validation.personDetected || validation.screenshotDetected || validation.aiGenerated || validation.unsafe) {
    await env.DB.prepare("INSERT INTO moderation_queue (id,target_type,target_id,reason,created_at) VALUES (?,?,?,?,?)")
      .bind(id(), "sighting", sightingId, validation.reason || "VALIDATION_REVIEW", now()).run();
  }
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
  const responseBody = {
    sightingId,
    status: validation.status,
    reason: validation.reason,
    validation: {
      catDetected: Boolean(validation.catDetected),
      personDetected: Boolean(validation.personDetected),
      screenshotDetected: Boolean(validation.screenshotDetected),
      unsafe: Boolean(validation.unsafe),
      duplicate: Boolean(validation.duplicate),
      catType: validation.catType,
      catBreed: validation.catBreed,
      coatType: validation.coatType,
      catConfidence: validation.catConfidence,
      aiGenerated: validation.aiGenerated,
      aiGeneratedConfidence: validation.aiGeneratedConfidence,
      detail: validation.detail,
    },
    catType: validation.catType,
    rarity: rarityFor(validation.catType),
    description,
    publishedAt: publishedAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
    rewards: validation.status === "accepted" ? { xp: 24, streak } : null,
  };
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

async function resolveCareFlag(request, env, careFlagId) {
  if (!(await isAdmin(request, env))) return json({ error: "ADMIN_REQUIRED" }, 403);
  const user = await requireUser(request, env);
  const body = await request.json().catch(() => ({}));
  const status = ["open", "helped", "dismissed"].includes(body.status) ? body.status : "helped";
  const flag = await env.DB.prepare("SELECT id,user_id,sighting_id FROM care_flags WHERE id=? LIMIT 1").bind(careFlagId).first();
  if (!flag) return json({ error: "CARE_FLAG_NOT_FOUND" }, 404);
  await env.DB.prepare("UPDATE care_flags SET status=? WHERE id=?").bind(status, careFlagId).run();
  await createNotification(env, flag.user_id, "care_update", status === "helped" ? "Cat care update" : "Care Flag updated", status === "helped" ? "A reviewer marked this Care Flag as helped. Thank you for looking out for a cat." : "A reviewer updated your Care Flag.");
  await writeAudit(env, user.id, "care_flag.resolved", "care_flag", careFlagId, { status });
  return json({ careFlagId, status });
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
    env.DB.prepare("SELECT id,cat_type,cat_breed,coat_type,cat_confidence,ai_generated,ai_generated_confidence,validation_reason,validation_status,visibility,captured_at,uploaded_at,expires_at FROM sightings WHERE user_id=? ORDER BY captured_at DESC").bind(user.id).all(),
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
  for (const medal of XP_MEDAL_CATALOG) if (Number(stats.xp || 0) >= medal.xpRequired) badges.push(medal.id);
  if (stats.twentyInDay) badges.push("easter-twenty-in-a-day");
  if (stats.rareFind) badges.push("easter-rare-find");
  if (stats.careHelp) badges.push("easter-gentle-helper");
  for (const badgeId of badges) await env.DB.prepare("INSERT OR IGNORE INTO user_badges (user_id,badge_id,earned_at) VALUES (?,?,?)").bind(userId, badgeId, now()).run();
  return badges;
}

async function getProgress(request, env) {
  const user = await requireUser(request, env);
  const [xp, journal, streak, flags, badges, quests, sightings, profile] = await Promise.all([
    env.DB.prepare("SELECT COALESCE(SUM(amount),0) AS total FROM reward_ledger WHERE user_id=?").bind(user.id).first(),
    env.DB.prepare("SELECT COUNT(*) AS total, SUM(first_spotted) AS unique_count FROM journal_entries WHERE user_id=?").bind(user.id).first(),
    env.DB.prepare("SELECT current_count,best_count,freeze_count FROM streaks WHERE user_id=?").bind(user.id).first(),
    env.DB.prepare("SELECT COUNT(*) AS total FROM care_flags WHERE user_id=? AND status!='rejected'").bind(user.id).first(),
    env.DB.prepare("SELECT badge_id,earned_at FROM user_badges WHERE user_id=? ORDER BY earned_at DESC").bind(user.id).all(),
    env.DB.prepare(`SELECT quests.slug,quests.title,quests.description,quests.target,COALESCE(quest_progress.count,0) AS count,quest_progress.completed_at
      FROM quests LEFT JOIN quest_progress ON quest_progress.quest_id=quests.id AND quest_progress.user_id=?
      WHERE quests.ends_at>? ORDER BY quests.ends_at ASC`).bind(user.id, now()).all(),
    env.DB.prepare("SELECT captured_at,cat_type FROM sightings WHERE user_id=? AND validation_status='accepted' ORDER BY captured_at DESC LIMIT 2000").bind(user.id).all(),
    env.DB.prepare("SELECT time_zone FROM users WHERE id=?").bind(user.id).first(),
  ]);
  const totalXp = Number(xp?.total || 0);
  const stats = { xp: totalXp, journalTotal: Number(journal?.total || 0), journalUnique: Number(journal?.unique_count || 0), bestStreak: Number(streak?.best_count || 0), careFlags: Number(flags?.total || 0) };
  const timeZone = String(profile?.time_zone || "Asia/Manila");
  const dailyCounts = new Map();
  for (const row of sightings.results || []) {
    const day = localDay(timeZone, new Date(row.captured_at));
    dailyCounts.set(day, Number(dailyCounts.get(day) || 0) + 1);
  }
  const maxDailyCats = Math.max(0, ...dailyCounts.values());
  stats.twentyInDay = maxDailyCats >= 20;
  stats.rareFind = (sightings.results || []).some((row) => ["Rare", "Super Rare"].includes(rarityFor(row.cat_type)));
  stats.careHelp = Number(flags?.total || 0) >= 1;
  const earned = await awardBadges(env, user.id, stats);
  const badgeIds = [...new Set([...(badges.results || []).map((row) => row.badge_id), ...earned])];
  const medals = medalsFor(totalXp, badges.results || [], earned);
  const nextMedal = medals.find((medal) => !medal.earned) || null;
  const easterRewards = easterRewardsFor(stats, badges.results || [], earned);
  return json({ xp: totalXp, level: levelFor(totalXp), nextLevelXp: Math.pow(levelFor(totalXp), 2) * 100, streak: { current: Number(streak?.current_count || 0), best: Number(streak?.best_count || 0), freezes: Number(streak?.freeze_count || 1) }, badges: badgeIds, medals, nextMedal, easterRewards, quests: quests.results.map((row) => ({ slug: row.slug, title: row.title, description: row.description, target: Number(row.target), count: Number(row.count), completed: Boolean(row.completed_at) })), rarity: { common: "Common", uncommon: "Uncommon", rare: "Rare", superRare: "Super Rare" } });
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
  const [journal, xp, streak, care, badges] = await Promise.all([
    env.DB.prepare("SELECT COUNT(*) AS total,COUNT(DISTINCT cat_type) AS types FROM journal_entries WHERE user_id=?").bind(user.id).first(),
    env.DB.prepare("SELECT COALESCE(SUM(amount),0) AS total FROM reward_ledger WHERE user_id=?").bind(user.id).first(),
    env.DB.prepare("SELECT best_count FROM streaks WHERE user_id=?").bind(user.id).first(),
    env.DB.prepare("SELECT COUNT(*) AS total FROM care_flags WHERE user_id=? AND status!='rejected'").bind(user.id).first(),
    env.DB.prepare("SELECT badge_id,earned_at FROM user_badges WHERE user_id=? ORDER BY earned_at ASC").bind(user.id).all(),
  ]);
  const totalXp = Number(xp?.total || 0);
  const earnedMedals = medalsFor(totalXp, badges.results || []).filter((medal) => medal.earned);
  const currentMedal = earnedMedals[earnedMedals.length - 1] || XP_MEDAL_CATALOG[0];
  return json({ year: new Date().getUTCFullYear(), stats: { catsSpotted: Number(journal?.total || 0), typesCollected: Number(journal?.types || 0), xp: totalXp, bestStreak: Number(streak?.best_count || 0), careFlags: Number(care?.total || 0), medal: { id: currentMedal.id, title: currentMedal.title, xpRequired: currentMedal.xpRequired } }, shareText: `My Pawprint Wrapped: ${Number(journal?.total || 0)} cats spotted, ${totalXp} XP earned, and ${currentMedal.title} medal unlocked.` });
}

async function getShareCard(request, env) {
  const wrapped = await getWrapped(request, env);
  const payload = await wrapped.json();
  return json({ card: { ...payload, brand: "Pawprint", tagline: "Gotta spot ’em all.", shareTagline: "Spotted today. Gone tomorrow." } });
}

async function getAdminAnalytics(request, env) {
  if (!(await isAdmin(request, env))) return json({ error: "ADMIN_REQUIRED" }, 403);
  const [users, sightings, accepted, retention] = await Promise.all([
    env.DB.prepare("SELECT COUNT(*) AS total FROM users").first(),
    env.DB.prepare("SELECT COUNT(*) AS total FROM sightings").first(),
    env.DB.prepare("SELECT COUNT(*) AS total FROM sightings WHERE validation_status='accepted'").first(),
    env.DB.prepare("SELECT COUNT(DISTINCT user_id) AS active_users FROM sightings WHERE uploaded_at>=datetime('now','-30 day')").first(),
  ]);
  return json({ metrics: { users: Number(users?.total || 0), sightings: Number(sightings?.total || 0), acceptedPhotos: Number(accepted?.total || 0), activeUsers30d: Number(retention?.active_users || 0) }, generatedAt: now() });
}

async function getAdminCareFlags(request, env) {
  if (!(await isAdmin(request, env))) return json({ error: "ADMIN_REQUIRED" }, 403);
  const rows = await env.DB.prepare(`SELECT care_flags.id,care_flags.kind,care_flags.note,care_flags.status,care_flags.created_at,
      care_flags.sighting_id,sightings.cat_type,sightings.public_geohash
      FROM care_flags LEFT JOIN sightings ON sightings.id=care_flags.sighting_id
      WHERE care_flags.status='open' ORDER BY care_flags.created_at ASC LIMIT 200`).all();
  return json({ items: rows.results });
}

async function getModerationQueue(request, env) {
  if (!(await isAdmin(request, env))) return json({ error: "ADMIN_REQUIRED" }, 403);
  const rows = await env.DB.prepare("SELECT id,target_type,target_id,reason,status,action,created_at,resolved_at FROM moderation_queue WHERE status='open' ORDER BY created_at ASC LIMIT 200").all();
  return json({ items: rows.results });
}

async function resolveModeration(request, env, moderationId) {
  if (!(await isAdmin(request, env))) return json({ error: "ADMIN_REQUIRED" }, 403);
  const user = await requireUser(request, env);
  const body = await request.json().catch(() => ({}));
  const action = ["dismiss", "remove", "needs_review"].includes(body.action) ? body.action : "needs_review";
  await env.DB.prepare("UPDATE moderation_queue SET status=?,action=?,assigned_to=?,resolved_at=? WHERE id=?").bind(action === "needs_review" ? "open" : "resolved", action, user.id, action === "needs_review" ? null : now(), moderationId).run();
  await writeAudit(env, user.id, "moderation.resolved", "moderation", moderationId, { action });
  return json({ moderationId, status: action === "needs_review" ? "open" : "resolved", action });
}

async function getPartnerReports(request, env) {
  if (!(await isAdmin(request, env))) return json({ error: "ADMIN_REQUIRED" }, 403);
  const rows = await env.DB.prepare("SELECT id,partner_name,period_start,period_end,payload_json,created_at FROM partner_reports ORDER BY created_at DESC LIMIT 100").all();
  return json({ reports: rows.results.map((row) => ({ ...row, payload: JSON.parse(row.payload_json || "{}") })) });
}

async function createPartnerReport(request, env) {
  if (!(await isAdmin(request, env))) return json({ error: "ADMIN_REQUIRED" }, 403);
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
  const existing = await env.DB.prepare("SELECT email FROM waitlist_signups WHERE email=? LIMIT 1").bind(email).first();
  if (existing) return json({ status: "already_subscribed", platformInterest }, 200);
  await env.DB.prepare("INSERT OR IGNORE INTO waitlist_signups (id,email,platform_interest,source,created_at) VALUES (?,?,?,?,?)")
    .bind(id(), email, platformInterest, source, now()).run();
  const emailResult = await sendBrevoWaitlistEmail(env, email, platformInterest);
  return json({ status: "subscribed", platformInterest, confirmationEmail: emailResult.sent ? "sent" : "queued" }, 201);
}

async function expireSightingsInternal(env) {
  const expired = await env.DB.prepare("UPDATE sightings SET validation_reason=COALESCE(validation_reason,'expired') WHERE expires_at <= ? AND validation_status='accepted' RETURNING id").bind(now()).all();
  return { expiredCount: expired.results.length };
}

function regionalTier(sampleCount) {
  const count = Number(sampleCount || 0);
  if (count <= 1) return "Super Rare";
  if (count <= 5) return "Rare";
  if (count <= 20) return "Uncommon";
  return "Common";
}

async function recalculateRegionalRarity(env) {
  const rows = await env.DB.prepare(`SELECT COALESCE(public_geohash,'country') AS scope_key,COALESCE(cat_type,'Unclassified cat') AS cat_type,COUNT(*) AS sample_count
    FROM sightings WHERE validation_status='accepted' AND captured_at>=datetime('now','-30 day') GROUP BY scope_key,cat_type`).all();
  const calculatedAt = now();
  const statements = [env.DB.prepare("DELETE FROM regional_rarity")];
  for (const row of rows.results || []) statements.push(env.DB.prepare("INSERT INTO regional_rarity (scope_key,cat_type,sample_count,tier,calculated_at) VALUES (?,?,?,?,?)").bind(row.scope_key, row.cat_type, Number(row.sample_count || 0), regionalTier(row.sample_count), calculatedAt));
  await env.DB.batch(statements);
  return { updatedCount: rows.results?.length || 0, calculatedAt };
}

async function expireSightings(request, env) {
  const secret = env.EXPIRY_JOB_TOKEN;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) return json({ error: "FORBIDDEN" }, 403);
  return json(await expireSightingsInternal(env));
}

async function savePushSubscription(request, env) {
  const user = await requireUser(request, env);
  const body = await request.json().catch(() => ({}));
  const endpoint = String(body.endpoint || "").trim();
  const p256dh = String(body.keys?.p256dh || "").trim();
  const auth = String(body.keys?.auth || "").trim();
  if (!endpoint || !p256dh || !auth || endpoint.length > 2048) return json({ error: "INVALID_PUSH_SUBSCRIPTION" }, 400);
  const timestamp = now();
  await env.DB.prepare(`INSERT INTO push_subscriptions (id,user_id,endpoint,p256dh,auth,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?) ON CONFLICT(endpoint) DO UPDATE SET user_id=excluded.user_id,p256dh=excluded.p256dh,auth=excluded.auth,updated_at=excluded.updated_at`)
    .bind(id(), user.id, endpoint, p256dh, auth, timestamp, timestamp).run();
  return json({ status: "subscribed" }, 201);
}

async function removePushSubscription(request, env) {
  const user = await requireUser(request, env);
  const body = await request.json().catch(() => ({}));
  const endpoint = String(body.endpoint || "").trim();
  if (!endpoint) return json({ error: "INVALID_PUSH_SUBSCRIPTION" }, 400);
  await env.DB.prepare("DELETE FROM push_subscriptions WHERE user_id=? AND endpoint=?").bind(user.id, endpoint).run();
  return json({ status: "unsubscribed" });
}

async function api(request, env, url) {
  if (url.pathname === "/api/health") return json({
    ok: true,
    service: "pawprint",
    time: now(),
    authConfigured: Boolean(env.SUPABASE_URL && env.SUPABASE_ANON_KEY),
    aiValidationConfigured: Boolean(env.GEMINI_API_KEY || env.OLLAMA_BASE_URL || env.OLLAMA_API_URL || env.AI_VALIDATION_URL),
    storageConfigured: Boolean(env.DB && env.BUCKET),
    brevoConfigured: Boolean(env.BREVO_API_KEY && env.BREVO_SENDER_EMAIL),
    pushConfigured: Boolean(env.PUSH_PUBLIC_KEY && env.PUSH_PRIVATE_KEY),
  });
  if (url.pathname === "/api/auth/config" && request.method === "GET") return json({ enabled: Boolean(env.SUPABASE_URL && env.SUPABASE_ANON_KEY), url: env.SUPABASE_URL || "", anonKey: env.SUPABASE_ANON_KEY || "", providers: { google: env.SUPABASE_GOOGLE_AUTH_ENABLED === "true", apple: env.SUPABASE_APPLE_AUTH_ENABLED === "true" } });
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
  if (url.pathname === "/api/admin/care-flags" && request.method === "GET") return getAdminCareFlags(request, env);
  if (url.pathname === "/api/admin/moderation" && request.method === "GET") return getModerationQueue(request, env);
  if (url.pathname.startsWith("/api/admin/moderation/") && request.method === "POST") return resolveModeration(request, env, url.pathname.split("/").pop());
  if (url.pathname.startsWith("/api/admin/care-flags/") && request.method === "PATCH") return resolveCareFlag(request, env, url.pathname.split("/").pop());
  if (url.pathname === "/api/admin/partner-reports" && request.method === "GET") return getPartnerReports(request, env);
  if (url.pathname === "/api/admin/partner-reports" && request.method === "POST") return createPartnerReport(request, env);
  if (url.pathname === "/api/waitlist" && request.method === "POST") return createWaitlist(request, env);
  if (url.pathname === "/api/push/config" && request.method === "GET") return json({ configured: Boolean(env.PUSH_PUBLIC_KEY), publicKey: env.PUSH_PUBLIC_KEY || null });
  if (url.pathname === "/api/push/subscriptions" && request.method === "POST") return savePushSubscription(request, env);
  if (url.pathname === "/api/push/subscriptions" && request.method === "DELETE") return removePushSubscription(request, env);
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
  if (url.pathname === "/api/profile" && request.method === "GET") return getProfile(request, env);
  if (url.pathname === "/api/care-flags" && request.method === "POST") return createCareFlag(request, env);
  if (url.pathname === "/api/profile" && request.method === "PATCH") return updateProfile(request, env);
  if (url.pathname === "/api/reports" && request.method === "POST") return createReport(request, env);
  if (url.pathname === "/api/blocks" && request.method === "POST") return createBlock(request, env);
  if (url.pathname === "/api/export" && request.method === "POST") return exportUser(request, env);
  if (url.pathname === "/api/account" && request.method === "DELETE") return deleteUser(request, env);
  if (url.pathname === "/api/jobs/expire" && request.method === "POST") return expireSightings(request, env);
  if (url.pathname === "/api/jobs/rarity" && request.method === "POST") {
    const secret = env.EXPIRY_JOB_TOKEN;
    if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return json({ error: "FORBIDDEN" }, 403);
    return json(await recalculateRegionalRarity(env));
  }
  return json({ error: "NOT_FOUND" }, 404);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      if (url.pathname.startsWith("/api/")) return await api(request, env, url);
      if (request.method === "GET" && url.pathname === "/manifest.webmanifest") return new Response(PWA_MANIFEST, { headers: { "content-type": "application/manifest+json", "cache-control": "public, max-age=3600" } });
      if (request.method === "GET" && url.pathname === "/sw.js") return new Response(PWA_SERVICE_WORKER_WITH_PUSH, { headers: { "content-type": "application/javascript", "cache-control": "public, max-age=3600" } });
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
      if (request.method === "GET" && url.pathname === "/favicon.ico") {
        return new Response(PAWPRINT_ICON_SVG, { headers: { "content-type": "image/svg+xml", "cache-control": "public, max-age=86400" } });
      }
      if (request.method === "GET" && url.pathname === "/assets/cat-paw.svg") {
        return new Response(CAT_PAW_SVG, { headers: { "content-type": "image/svg+xml", "cache-control": "public, max-age=86400" } });
      }
      if (request.method === "GET" && url.pathname === "/assets/pawprint-cat.js") {
        return new Response(PAWPRINT_CAT_JS, { headers: { "content-type": "application/javascript; charset=utf-8", "cache-control": "public, max-age=86400" } });
      }
      if (request.method === "GET" && ["/assets/supabase-auth.js", "/assets/supabase-auth-gate.js"].includes(url.pathname)) {
        return new Response(SUPABASE_AUTH_JS, { headers: { "content-type": "application/javascript; charset=utf-8", "cache-control": "public, max-age=86400" } });
      }
      if (request.method === "GET" && url.pathname === "/assets/paw-loader.js") {
        return new Response(PAW_LOADER_JS, { headers: { "content-type": "application/javascript; charset=utf-8", "cache-control": "public, max-age=86400" } });
      }
      if (request.method === "GET" && url.pathname === "/assets/mobile-ui.js") {
        return new Response(MOBILE_UI_JS, { headers: { "content-type": "application/javascript; charset=utf-8", "cache-control": "no-cache" } });
      }
      if (request.method === "GET" && url.pathname === "/assets/pawtrail.js") {
        return new Response(PAWTRAIL_JS, { headers: { "content-type": "application/javascript; charset=utf-8", "cache-control": "no-cache" } });
      }
      if (request.method === "GET" && url.pathname === "/assets/offline-queue.js") {
        return new Response(OFFLINE_QUEUE_JS, { headers: { "content-type": "application/javascript; charset=utf-8", "cache-control": "no-cache" } });
      }
      if (request.method === "GET" && url.pathname === "/assets/admin-console.js") {
        return new Response(ADMIN_CONSOLE_JS, { headers: { "content-type": "application/javascript; charset=utf-8", "cache-control": "no-cache" } });
      }
      if (request.method === "GET" && url.pathname === "/assets/admin-app.js") {
        return new Response(ADMIN_APP_JS, { headers: { "content-type": "application/javascript; charset=utf-8", "cache-control": "no-cache" } });
      }
      if (request.method === "GET" && url.pathname === "/assets/admin-app.css") {
        return new Response(ADMIN_APP_CSS, { headers: { "content-type": "text/css; charset=utf-8", "cache-control": "no-cache" } });
      }
      if (request.method === "GET" && url.pathname === "/assets/fredoka-latin.woff2") {
        return new Response(Uint8Array.from(atob(MOBILE_FONT), c => c.charCodeAt(0)), { headers: { "content-type": "font/woff2", "cache-control": "public, max-age=86400" } });
      }
      if (request.method === "GET" && url.pathname === "/assets/Fredoka-OFL.txt") {
        return new Response(MOBILE_FONT_LICENSE, { headers: { "content-type": "text/plain; charset=utf-8" } });
      }
      if (request.method === "GET" && url.pathname === "/assets/mobile-ui.css") {
        return new Response(MOBILE_UI_CSS, { headers: { "content-type": "text/css; charset=utf-8", "cache-control": "no-cache" } });
      }
      if (request.method === "GET" && url.pathname === "/assets/pawloader.js") {
        return new Response(PAWLOADER_ACTUAL_JS, { headers: { "content-type": "application/javascript; charset=utf-8", "cache-control": "public, max-age=86400" } });
      }
      if (request.method === "GET" && url.pathname === "/assets/pawloader.css") {
        return new Response(PAWLOADER_CSS, { headers: { "content-type": "text/css; charset=utf-8", "cache-control": "public, max-age=86400" } });
      }
      if (request.method === "GET" && url.pathname === "/assets/pawloader-bridge.js") {
        return new Response(PAWLOADER_BRIDGE, { headers: { "content-type": "application/javascript; charset=utf-8", "cache-control": "public, max-age=86400" } });
      }
      if (request.method === "GET" && url.pathname === "/assets/pawlaunch.js") {
        return new Response(PAWLAUNCH_JS, { headers: { "content-type": "application/javascript; charset=utf-8", "cache-control": "public, max-age=86400" } });
      }
      if (request.method === "GET" && url.pathname === "/assets/pawlaunch.css") {
        return new Response(PAWLAUNCH_CSS, { headers: { "content-type": "text/css; charset=utf-8", "cache-control": "public, max-age=86400" } });
      }
      if (request.method === "GET" && url.pathname === "/assets/pawonboard.js") {
        return new Response(PAWONBOARD_JS, { headers: { "content-type": "application/javascript; charset=utf-8", "cache-control": "public, max-age=86400" } });
      }
      if (request.method === "GET" && url.pathname === "/assets/pawonboard.css") {
        return new Response(PAWONBOARD_CSS, { headers: { "content-type": "text/css; charset=utf-8", "cache-control": "public, max-age=86400" } });
      }
      if (request.method === "GET" && url.pathname === "/assets/pawprint-cat-onboard.js") {
        return new Response(PAWONBOARD_CAT, { headers: { "content-type": "application/javascript; charset=utf-8", "cache-control": "public, max-age=86400" } });
      }
      if (request.method === "GET" && (url.pathname === "/" || url.pathname === "/index.html" || url.pathname === "/auth/callback" || url.pathname === "/onboarding")) return new Response(APP_HTML, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
      if (request.method === "GET" && (url.pathname === "/admin" || url.pathname === "/admin.html")) return new Response(ADMIN_HTML, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
      return new Response("Not found", { status: 404 });
    } catch (error) {
      if (error instanceof Response) return error;
      console.error(error);
      return json({ error: error?.message || "INTERNAL_ERROR" }, 500);
    }
  },
  async scheduled(event, env, ctx) {
    const work = event.cron === "17 3 * * *" ? Promise.all([expireSightingsInternal(env), recalculateRegionalRarity(env)]) : expireSightingsInternal(env);
    ctx.waitUntil(work);
  },
};
