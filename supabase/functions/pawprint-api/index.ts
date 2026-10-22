import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { sendPushNotification } from "npm:@mmmike/web-push@1.0.1/send";
import jpeg from "npm:jpeg-js@0.4.4";
import { pawprintEmailTemplate } from "./email-templates.ts";
import { dHashFromRgba, hammingDistance } from "./dhash.ts";
import { stagingValidationFixture } from "./staging-fixture.ts";

const headers = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
  "access-control-allow-methods": "GET,POST,PATCH,DELETE,OPTIONS",
  "cache-control": "no-store",
};
const jsonHeaders = { ...headers, "content-type": "application/json; charset=utf-8" };
const now = () => new Date().toISOString();
const id = () => crypto.randomUUID();
const clamp = (value: unknown, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.min(1, number)) : fallback;
};
const response = (body: unknown, status = 200, extra: HeadersInit = {}) => new Response(JSON.stringify(body), { status, headers: { ...jsonHeaders, ...extra } });
const errorResponse = (error: string, status = 400, extra: Record<string, unknown> = {}) => response({ error, ...extra }, status);
const bearer = (request: Request) => request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";

function adminIds() {
  return new Set(String(Deno.env.get("ADMIN_USER_IDS") || "").split(",").map((item) => item.trim()).filter(Boolean));
}

function isAdmin(user: { id: string; app_metadata?: Record<string, unknown> | null }) {
  return adminIds().has(user.id) || user.app_metadata?.role === "admin";
}

function createServiceClient() {
  return createClient(Deno.env.get("SUPABASE_URL") || "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "", { auth: { persistSession: false, autoRefreshToken: false } });
}

async function currentUser(request: Request, supabase: SupabaseClient) {
  const token = bearer(request);
  if (!token) throw new Error("AUTH_REQUIRED");
  const result = await supabase.auth.getUser(token);
  if (result.error || !result.data.user) throw new Error("AUTH_REQUIRED");
  return result.data.user;
}

async function ensureProfile(supabase: SupabaseClient, user: { id: string; email?: string }) {
  const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
  if (data) return data;
  const insert = await supabase.from("profiles").insert({ id: user.id, nickname: "Pawprint spotter", avatar: "cat-ink", age_group: "prefer_not_to_say" }).select("*").single();
  if (insert.error) throw insert.error;
  return insert.data;
}

function normalizedCat(value: unknown) {
  const text = String(value || "").trim().slice(0, 80);
  return text || "Unclassified cat";
}

const MOBILE_AREAS = ["Muntinlupa", "Makati", "Manila", "Quezon City", "Pasig", "Taguig", "Cebu City", "Davao City", "Iloilo City", "Baguio", "Antipolo", "Cagayan de Oro", "Bacolod", "Other city or area"];
const NICKNAME_WORDS = ["asshole", "bitch", "fuck", "gago", "pota", "putang", "shit", "tanga", "ulol"];
function nicknameInvalid(value: string) {
  return !/^[A-Za-z0-9_]{3,20}$/.test(value) || /^\S+@\S+\.\S+$/.test(value) || /(?:\+?\d[\d\s().-]{6,}\d)/.test(value) || NICKNAME_WORDS.some((word) => value.toLowerCase().includes(word));
}

function geohash(latitude: number, longitude: number, precision = 6) {
  const alphabet = "0123456789bcdefghjkmnpqrstuvwxyz";
  let lat = [-90, 90], lon = [-180, 180], even = true, bits = 0, character = 0, output = "";
  while (output.length < precision) {
    const range = even ? lon : lat;
    const value = even ? longitude : latitude;
    const middle = (range[0] + range[1]) / 2;
    if (value >= middle) { character = character * 2 + 1; range[0] = middle; } else { character *= 2; range[1] = middle; }
    even = !even; bits++;
    if (bits === 5) { output += alphabet[character]; bits = 0; character = 0; }
  }
  return output;
}

function geohashCenter(value: unknown) {
  const text = String(value || '').toLowerCase();
  const alphabet = "0123456789bcdefghjkmnpqrstuvwxyz";
  if (!text) return null;
  let lat = [-90, 90], lon = [-180, 180], even = true;
  for (const character of text) {
    const index = alphabet.indexOf(character);
    if (index < 0) return null;
    for (let bit = 4; bit >= 0; bit -= 1) {
      const range = even ? lon : lat;
      const middle = (range[0] + range[1]) / 2;
      if ((index & (1 << bit)) !== 0) range[0] = middle;
      else range[1] = middle;
      even = !even;
    }
  }
  return { latitude: (lat[0] + lat[1]) / 2, longitude: (lon[0] + lon[1]) / 2 };
}

function rarity(catType: string) {
  const value = catType.toLowerCase();
  if (/(sphynx|norwegian|angora|ragdoll|maine coon)/.test(value)) return "Rare";
  if (/(bengal|siamese|persian|tortoiseshell|tortie)/.test(value)) return "Uncommon";
  return "Common";
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  return btoa(binary);
}

async function hash(bytes: Uint8Array) {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
}

// A 64-bit dHash catches visually identical or lightly recompressed photos
// even when their exact SHA-256 bytes differ. It is only used as an abuse
// signal; the original photo is still retained for the user's own Journal.
function perceptualHash(bytes: Uint8Array) {
  try {
    const decoded = jpeg.decode(bytes, { useTArray: true });
    return decoded?.data && decoded.width && decoded.height ? dHashFromRgba(decoded.data, decoded.width, decoded.height) : null;
  } catch {
    return null;
  }
}

const validationPrompt = "Inspect this camera capture for Pawprint. Return JSON only with catDetected, personDetected, screenshotDetected, unsafe, aiGenerated, catConfidence, breedConfidence, aiGeneratedConfidence, suggestedBreed, suggestedCoatType, reason. Accept only a clearly visible real cat photographed by a camera. Reject people, screenshots, collages, cartoons, drawings, logos, illustrations, rendered mockups, and images without a clearly visible real cat. Do not call a normal cat AI-generated. Suggest a breed only when supported.";

function normalizeValidation(result: Record<string, unknown>) {
  const catDetected = result.catDetected === true;
  const personDetected = result.personDetected === true;
  const screenshotDetected = result.screenshotDetected === true;
  const unsafe = result.unsafe === true;
  const aiGenerated = result.aiGenerated === true;
  const catConfidence = clamp(result.catConfidence ?? result.confidence, catDetected ? 0.8 : 0);
  const aiConfidence = clamp(result.aiGeneratedConfidence, aiGenerated ? 1 : 0);
  const threshold = clamp(Deno.env.get("AI_CAT_CONFIDENCE_THRESHOLD"), 0.78);
  const aiThreshold = clamp(Deno.env.get("AI_GENERATED_CONFIDENCE_THRESHOLD"), 0.85);
  let status = "accepted", reason = "AI_VALIDATED";
  if (unsafe) { status = "rejected"; reason = "UNSAFE_IMAGE"; }
  else if (personDetected) { status = "rejected"; reason = "PERSON_DETECTED"; }
  else if (screenshotDetected) { status = "rejected"; reason = "SCREENSHOT_DETECTED"; }
  else if (!catDetected || catConfidence < threshold) { status = "rejected"; reason = "IMAGE_NOT_A_CAT"; }
  else if (aiGenerated && aiConfidence >= aiThreshold) { status = "rejected"; reason = "AI_GENERATED_IMAGE"; }
  // Respect the configured cat threshold directly. The old implicit +0.10
  // review band caused clear real-cat photos around 0.80–0.89 to be stored
  // as needs_review even though they passed AI_CAT_CONFIDENCE_THRESHOLD.
  else if (aiConfidence >= 0.35) { status = "needs_review"; reason = "VALIDATION_PENDING"; }
  const breed = typeof result.suggestedBreed === "string" ? String(result.suggestedBreed).slice(0, 80) : "";
  const coat = typeof result.suggestedCoatType === "string" ? String(result.suggestedCoatType).slice(0, 80) : "";
  return { status, reason, catDetected, personDetected, screenshotDetected, unsafe, aiGenerated, catConfidence, aiConfidence, catType: normalizedCat(breed || coat), catBreed: breed || null, coatType: coat || null, detail: String(result.reason || "").slice(0, 500) };
}

function parseModelJson(value: string) {
  const cleaned = value.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  try { return JSON.parse(cleaned); } catch { return JSON.parse(cleaned.match(/\{[\s\S]*\}/)?.[0] || "{}"); }
}

async function validatePhoto(bytes: Uint8Array, contentType: string) {
  const fixture = stagingValidationFixture();
  if (fixture) return normalizeValidation(fixture);
  const provider = String(Deno.env.get("AI_PROVIDER") || "gemini").toLowerCase();
  const encoded = bytesToBase64(bytes);
  const unavailable = (detail: string) => ({ status: "needs_review", reason: "AI_PROVIDER_UNAVAILABLE", catDetected: false, personDetected: false, screenshotDetected: false, unsafe: false, aiGenerated: false, catConfidence: 0, aiConfidence: 0, catType: "Unclassified cat", catBreed: null, coatType: null, detail: detail.slice(0, 500) });
  const runOllama = async () => {
    const base = Deno.env.get("OLLAMA_BASE_URL");
    if (!base) throw new Error("OLLAMA_NOT_CONFIGURED");
    const result = await fetch(`${base.replace(/\/$/, "")}/api/chat`, { method: "POST", headers: { "content-type": "application/json" }, signal: AbortSignal.timeout(25000), body: JSON.stringify({ model: Deno.env.get("OLLAMA_MODEL") || "qwen2.5vl:7b", stream: false, options: { temperature: 0 }, messages: [{ role: "system", content: validationPrompt }, { role: "user", content: "Analyze this image and return JSON only.", images: [encoded] }] }) });
    if (!result.ok) throw new Error(`OLLAMA_${result.status}`);
    const payload = await result.json();
    return normalizeValidation(parseModelJson(payload.message?.content || payload.response || "{}"));
  };
  const runGemini = async () => {
    const key = Deno.env.get("GEMINI_API_KEY");
    if (!key) throw new Error("GEMINI_NOT_CONFIGURED");
    const model = Deno.env.get("GEMINI_MODEL") || "gemini-3.5-flash-lite";
    const result = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, { method: "POST", headers: { "content-type": "application/json", "x-goog-api-key": key }, signal: AbortSignal.timeout(30000), body: JSON.stringify({ contents: [{ parts: [{ text: validationPrompt }, { inlineData: { mimeType: contentType || "image/jpeg", data: encoded } }] }], generationConfig: { temperature: 0, responseMimeType: "application/json" } }) });
    if (!result.ok) throw new Error(`GEMINI_${result.status}`);
    const payload = await result.json();
    const text = payload.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text || "").join("") || "{}";
    return normalizeValidation(parseModelJson(text));
  };
  const order = provider === "ollama" ? ["ollama", "gemini"] : ["gemini", "ollama"];
  const errors: string[] = [];
  for (const name of order) {
    try { return name === "ollama" ? await runOllama() : await runGemini(); }
    catch (error) { errors.push(`${name}:${String(error instanceof Error ? error.message : error)}`); }
  }
  return unavailable(errors.join(" | ") || "Configure Gemini or Ollama in Supabase Edge Function secrets.");
}

async function sendBrevoConfirmation(email: string, platform: string) {
  const key = Deno.env.get("BREVO_API_KEY");
  const sender = Deno.env.get("BREVO_SENDER_EMAIL");
  if (!key || !sender) return { sent: false, reason: "BREVO_NOT_CONFIGURED" };
  const appUrl = Deno.env.get("PAWPRINT_PUBLIC_URL");
  const logoUrl = appUrl ? `${appUrl.replace(/\/$/, "")}/assets/pawprint-logo.png` : undefined;
  const platformLabel = platform === "ios_android" ? "iOS and Android" : platform === "ios" ? "iOS" : platform === "android" ? "Android" : platform;
  const payload: Record<string, unknown> = {
    sender: { email: sender, name: Deno.env.get("BREVO_SENDER_NAME") || "Pawprint" },
    to: [{ email }],
    subject: "You're on the Pawprint early-access list",
    textContent: `You're on the Pawprint early-access list. We'll send launch updates for ${platformLabel}. Public pins stay approximate and delayed for safety.`,
    htmlContent: pawprintEmailTemplate({
      logoUrl,
      eyebrow: "Early access",
      title: "Your pawprint is saved.",
      intro: "You're on the Pawprint early-access list.",
      body: `We'll send launch updates for ${platformLabel}.`,
      ctaLabel: "Open Pawprint",
      ctaUrl: appUrl,
      footerNote: "Public pins stay approximate and delayed for safety.",
    }),
  };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  let result: Response;
  try {
    result = await fetch("https://api.brevo.com/v3/smtp/email", { method: "POST", headers: { "content-type": "application/json", "api-key": key }, body: JSON.stringify(payload), signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
  if (!result.ok) throw new Error(`BREVO_${result.status}`);
  return { sent: true };
}

async function sendBrevoAuthCode(email: string, code: string) {
  const key = Deno.env.get("BREVO_API_KEY");
  const sender = Deno.env.get("BREVO_SENDER_EMAIL");
  if (!key || !sender) throw new Error("BREVO_NOT_CONFIGURED");
  const appUrl = Deno.env.get("PAWPRINT_PUBLIC_URL");
  const logoUrl = appUrl ? `${appUrl.replace(/\/$/, "")}/assets/pawprint-logo.png` : undefined;
  const payload: Record<string, unknown> = {
    sender: { email: sender, name: Deno.env.get("BREVO_SENDER_NAME") || "Pawprint" },
    to: [{ email }],
    subject: "Your Pawprint sign-in code",
    textContent: `Your Pawprint sign-in code is ${code}. It expires shortly. If you did not request this, you can ignore this email.`,
    htmlContent: pawprintEmailTemplate({
      logoUrl,
      eyebrow: "Secure sign-in",
      title: "Your pawprint code.",
      intro: "Use this one-time code to load your live Pawprint data.",
      body: `Your sign-in code is ${code}. It expires shortly. If you did not request this code, you can safely ignore this email.`,
      footerNote: "Pawprint keeps your account private. Public pins remain approximate and delayed for safety.",
    }),
  };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  let result: Response;
  try {
    result = await fetch("https://api.brevo.com/v3/smtp/email", { method: "POST", headers: { "content-type": "application/json", "api-key": key }, body: JSON.stringify(payload), signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
  if (!result.ok) throw new Error(`BREVO_${result.status}`);
  return { sent: true };
}

async function removeBrevoContact(email: string) {
  const key = Deno.env.get("BREVO_API_KEY");
  if (!key || !email) return;
  const result = await fetch(`https://api.brevo.com/v3/contacts/${encodeURIComponent(email)}`, { method: "DELETE", headers: { "api-key": key } });
  // Brevo returns 404 when the address was never on the list. Deletion must
  // remain retryable, so that state is treated as already complete.
  if (!result.ok && result.status !== 404) throw new Error(`BREVO_DELETE_${result.status}`);
}

function createPublicAuthClient() {
  return createClient(Deno.env.get("SUPABASE_URL") || "", Deno.env.get("SUPABASE_ANON_KEY") || "", { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
}

function pushVapid() {
  const publicKey = Deno.env.get("PUSH_PUBLIC_KEY");
  const privateKey = Deno.env.get("PUSH_PRIVATE_KEY");
  if (!publicKey || !privateKey) return null;
  return {
    subject: Deno.env.get("PUSH_SUBJECT") || "https://pawprint-omega.vercel.app",
    publicKey,
    privateKey,
  };
}

async function sendPushToUser(supabase: SupabaseClient, userId: string, payload: { title: string; body: string; url?: string; tag?: string }) {
  const vapid = pushVapid();
  if (!vapid) return { delivered: 0, removed: 0 };
  const subscriptions = await supabase.from("push_subscriptions").select("id,endpoint,p256dh,auth").eq("user_id", userId);
  if (subscriptions.error) { console.error("PUSH_SUBSCRIPTIONS_READ_FAILED", subscriptions.error); return { delivered: 0, removed: 0 }; }
  let delivered = 0;
  const expired: string[] = [];
  for (const item of subscriptions.data || []) {
    if (!String(item.endpoint || "").startsWith("https://") || !item.p256dh || !item.auth) { expired.push(item.endpoint); continue; }
    try {
      const sent = await sendPushNotification(
        { endpoint: item.endpoint, keys: { p256dh: item.p256dh, auth: item.auth } },
        { title: payload.title, body: payload.body, url: payload.url || "/#app", tag: payload.tag || "pawprint" },
        vapid,
        { ttl: 3600, urgency: "normal" },
      );
      if (sent) delivered += 1;
      else expired.push(item.endpoint);
    } catch (error) {
      const status = Number((error as { statusCode?: number })?.statusCode || 0);
      if (status === 404 || status === 410) expired.push(item.endpoint);
      else console.error("PUSH_DELIVERY_FAILED", status || "unknown");
    }
  }
  if (expired.length) await supabase.from("push_subscriptions").delete().eq("user_id", userId).in("endpoint", expired);
  return { delivered, removed: expired.length };
}

async function createNotification(supabase: SupabaseClient, userId: string, type: string, title: string, body: string, url = "/#app") {
  const result = await supabase.from("notifications").insert({ user_id: userId, type, title, body });
  if (result.error) throw result.error;
  await sendPushToUser(supabase, userId, { title, body, url, tag: type });
}

async function requireUser(request: Request, supabase: SupabaseClient) {
  try { return await currentUser(request, supabase); } catch { throw new Error("AUTH_REQUIRED"); }
}

async function resolveTargetUserId(supabase: SupabaseClient, body: Record<string, unknown>) {
  if (body.blockedUserId) return String(body.blockedUserId);
  const targetType = String(body.targetType || "");
  const targetId = String(body.targetId || "");
  if (!targetId) return null;
  if (targetType === "sighting" || targetType === "pin") {
    const result = await supabase.from("sightings").select("user_id").eq("id", targetId).maybeSingle();
    return result.data?.user_id || null;
  }
  if (targetType === "care_flag") {
    const result = await supabase.from("care_flags").select("user_id").eq("id", targetId).maybeSingle();
    return result.data?.user_id || null;
  }
  return targetType === "profile" ? targetId : null;
}

async function profile(supabase: SupabaseClient, user: { id: string; email?: string }) {
  const userProfile = await ensureProfile(supabase, user);
  const settings = await supabase.from("user_settings").select("*").eq("user_id", user.id).maybeSingle();
  return { id: user.id, email: user.email || null, display_name: userProfile.nickname, avatar_url: userProfile.avatar, age_group: userProfile.age_group, gender: userProfile.gender || null, location_area: userProfile.location_area || null, onboarding_completed: Boolean(userProfile.onboarding_completed), time_zone: userProfile.time_zone || "Asia/Manila", language: userProfile.language || "en", privacy_notice_version: userProfile.privacy_notice_version || null, privacy_consent_at: userProfile.privacy_consent_at || null, cat_spotter_type: userProfile.cat_spotter_type || "casual", streak_reminders: Boolean(userProfile.streak_reminders), care_flag_reminders: Boolean(userProfile.care_flag_reminders), safety_pledge_accepted: Boolean(userProfile.safety_pledge_accepted), safety_pledge_at: userProfile.safety_pledge_at || null, terms_accepted_at: userProfile.terms_accepted_at || null, guardian_consent_at: userProfile.guardian_consent_at || null, visibility: settings.data?.default_visibility === "private" ? "private" : "public", ...(settings.data || {}) };
}

async function dashboard(supabase: SupabaseClient, user: { id: string }) {
  const [journal, streak, rewards, sightings] = await Promise.all([
    supabase.from("journal_entries").select("*").eq("user_id", user.id).order("spotted_at", { ascending: false }),
    supabase.from("streaks").select("*").eq("user_id", user.id).maybeSingle(),
    supabase.from("reward_ledger").select("amount").eq("user_id", user.id),
    supabase.from("sightings").select("id,cat_type,description,visibility,captured_at,published_at,expires_at,latitude,longitude,public_geohash,validation_status").eq("user_id", user.id).order("captured_at", { ascending: false }).limit(60),
  ]);
  const accepted = (sightings.data || []).filter((item) => item.validation_status === "accepted");
  return { streak: { current: streak.data?.current_count || 0, best: streak.data?.best_count || 0, freezes: streak.data?.freeze_count || 0, state: (streak.data?.current_count || 0) > 0 ? "active" : "broken", label: (streak.data?.current_count || 0) > 0 ? "Orange cat streak" : "Black cat reset" }, journal: { unique: (journal.data || []).filter((item) => item.first_spotted).length }, xp: (rewards.data || []).reduce((sum, item) => sum + Number(item.amount || 0), 0), sightings: accepted.map(toSighting), today: { count: accepted.filter((item) => String(item.captured_at).slice(0, 10) === new Date().toISOString().slice(0, 10)).length, target: 1 } };
}

function toSighting(item: Record<string, unknown>) {
  // Never return the capture-time coordinates. Public map coordinates are the
  // stable centre of the stored public geohash, which prevents trilateration
  // across repeated sightings.
  const publicPoint = geohashCenter(item.public_geohash);
  const seen = Array.isArray(item.sighting_seen) ? Number((item.sighting_seen[0] as Record<string, unknown>)?.count || 0) : Number(item.seen_count || 0);
  return { id: item.id, catType: item.cat_type, description: item.description, capturedAt: item.captured_at, publishedAt: item.published_at, expiresAt: item.expires_at, visibility: item.visibility, area: publicPoint, seenCount: seen, validationStatus: item.validation_status };
}

async function progress(supabase: SupabaseClient, user: { id: string }) {
  const [rewards, journal, streak, care] = await Promise.all([
    supabase.from("reward_ledger").select("amount").eq("user_id", user.id),
    supabase.from("journal_entries").select("cat_type,first_spotted").eq("user_id", user.id),
    supabase.from("streaks").select("current_count,best_count,freeze_count").eq("user_id", user.id).maybeSingle(),
    supabase.from("care_flags").select("id").eq("user_id", user.id).neq("status", "rejected"),
  ]);
  const xp = (rewards.data || []).reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const medals = [["xp-paw-seed", "Paw Seed", 0], ["xp-first-paw", "First Paw", 24], ["xp-alley-scout", "Alley Scout", 100], ["xp-night-watcher", "Night Watcher", 250], ["xp-street-naturalist", "Street Naturalist", 500], ["xp-pawprint-legend", "Pawprint Legend", 1000]].map(([id, title, xpRequired]) => ({ id, title, xpRequired, earned: xp >= Number(xpRequired) }));
  return { xp, level: Math.max(1, Math.floor(Math.sqrt(Math.max(0, xp) / 100)) + 1), streak: { current: streak.data?.current_count || 0, best: streak.data?.best_count || 0, freezes: streak.data?.freeze_count || 0 }, medals, badges: medals.filter((item) => item.earned).map((item) => item.id), easterRewards: [{ id: "easter-twenty-in-a-day", title: "Cat Marathon", earned: false }, { id: "easter-rare-find", title: "Rare Find", earned: false }, { id: "easter-gentle-helper", title: "Gentle Helper", earned: Boolean(care.data?.length) }], journal: { total: journal.data?.length || 0, unique: journal.data?.filter((item) => item.first_spotted).length || 0 } };
}

async function createSighting(request: Request, supabase: SupabaseClient, user: { id: string }) {
  const form = await request.formData();
  const photo = form.get("photo");
  const sessionId = String(form.get("captureSessionId") || "");
  const requestKey = String(form.get("idempotencyKey") || "");
  const description = String(form.get("description") || "").trim().slice(0, 280);
  const captureSource = String(form.get("captureSource") || "camera") === "gallery" ? "gallery" : "camera";
  const latitudeValue = form.get("latitude"), longitudeValue = form.get("longitude");
  const latitude = latitudeValue === null ? null : Number(latitudeValue), longitude = longitudeValue === null ? null : Number(longitudeValue);
  if (!(photo instanceof File) || !photo.type.startsWith("image/") || photo.size > 10 * 1024 * 1024 || !sessionId || !requestKey || description.length < 8 || (captureSource === "camera" && (!Number.isFinite(latitude) || !Number.isFinite(longitude)))) return errorResponse("INVALID_SIGHTING", 400);
  const previous = await supabase.from("request_keys").select("response_json").eq("user_id", user.id).eq("request_key", requestKey).maybeSingle();
  if (previous.data?.response_json) return response(previous.data.response_json, 201);
  const session = await supabase.from("capture_sessions").select("*").eq("id", sessionId).eq("user_id", user.id).maybeSingle();
  if (!session.data || session.data.used_at || new Date(session.data.expires_at) <= new Date()) return errorResponse("CAPTURE_SESSION_INVALID", 409);
  const reservation = await supabase.rpc("reserve_sighting_attempt", { target_user: user.id, target_request_key: requestKey });
  if (reservation.error) throw reservation.error;
  if (!reservation.data?.allowed) {
    return reservation.data?.reason === "daily_limit"
      ? errorResponse("DAILY_VALIDATION_LIMIT", 429, { message: "Daily photo validation limit reached. Please try again tomorrow." })
      : errorResponse("RATE_LIMITED", 429, { message: "You have reached the hourly photo limit. Please try again later." });
  }
  const capturedAt = Date.parse(String(form.get("capturedAt") || ""));
  if (!Number.isFinite(capturedAt) || Date.now() - capturedAt > 10 * 60 * 1000 || capturedAt > Date.now() + 120000) return errorResponse("CAPTURE_TIME_INVALID", 409);
  const bytes = new Uint8Array(await photo.arrayBuffer()), photoHash = await hash(bytes), photoDhash = perceptualHash(bytes);
  const duplicate = await supabase.from("sightings").select("id").eq("photo_hash", photoHash).maybeSingle();
  if (duplicate.data) return errorResponse("DUPLICATE_IMAGE", 409, { duplicateOf: duplicate.data.id });
  if (photoDhash) {
    const recent = await supabase.from("sightings").select("id,photo_dhash").eq("user_id", user.id).not("photo_dhash", "is", null).gte("uploaded_at", new Date(Date.now() - 7 * 86400000).toISOString()).limit(500);
    if (recent.error) throw recent.error;
    const similar = (recent.data || []).find((item) => hammingDistance(photoDhash, String(item.photo_dhash)) <= 6);
    if (similar) return errorResponse("SIMILAR_IMAGE", 409, { duplicateOf: similar.id, message: "That photo looks too similar to one you uploaded recently." });
  }
  const validation = await validatePhoto(bytes, photo.type);
  const sightingId = id(), storagePath = `${user.id}/${sightingId}.jpg`, uploaded = await supabase.storage.from("pawprint-sightings").upload(storagePath, bytes, { contentType: photo.type || "image/jpeg", upsert: false });
  if (uploaded.error) throw uploaded.error;
  const uploadedAt = new Date(), publishedAt = new Date(uploadedAt.getTime() + 5 * 60 * 1000), expiresAt = new Date(uploadedAt.getTime() + 24 * 60 * 60 * 1000), catType = normalizedCat(validation.catType);
  const settings = await supabase.from("user_settings").select("default_visibility").eq("user_id", user.id).maybeSingle();
  const requestedVisibility = String(form.get("visibility") || "public");
  const visibility = requestedVisibility === "private" || settings.data?.default_visibility === "private" ? "private" : "public";
  const row = await supabase.from("sightings").insert({ id: sightingId, user_id: user.id, storage_path: storagePath, photo_hash: photoHash, photo_dhash: photoDhash, cat_type: catType, cat_breed: validation.catBreed, coat_type: validation.coatType, cat_confidence: validation.catConfidence, ai_confidence: validation.catConfidence, ai_generated: validation.aiGenerated, ai_generated_confidence: validation.aiConfidence, validation_json: validation, description, capture_source: captureSource, validation_status: validation.status, validation_reason: validation.reason, visibility: captureSource === "gallery" ? "private" : visibility, latitude: captureSource === "camera" ? latitude : null, longitude: captureSource === "camera" ? longitude : null, public_geohash: captureSource === "camera" ? geohash(Number(latitude), Number(longitude), 7) : null, captured_at: new Date(capturedAt).toISOString(), uploaded_at: uploadedAt.toISOString(), published_at: publishedAt.toISOString(), expires_at: expiresAt.toISOString() }).select("*").single();
  if (row.error) throw row.error;
  await supabase.from("capture_sessions").update({ used_at: now() }).eq("id", sessionId).eq("user_id", user.id);
  let streak = null;
  if (validation.status === "accepted") {
    const previousCat = await supabase.from("journal_entries").select("id").eq("user_id", user.id).eq("cat_type", catType).maybeSingle();
    await supabase.from("journal_entries").insert({ user_id: user.id, sighting_id: sightingId, cat_type: catType, spotted_at: new Date(capturedAt).toISOString(), first_spotted: !previousCat.data });
    if (captureSource === "camera") {
      const localDay = new Intl.DateTimeFormat("en-CA", { timeZone: session.data.device_time_zone || "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).format(uploadedAt);
      const old = await supabase.from("streaks").select("*").eq("user_id", user.id).maybeSingle();
      const previousDay = old.data?.last_local_day ? new Date(`${old.data.last_local_day}T00:00:00Z`) : null;
      const gap = previousDay ? Math.round((Date.parse(`${localDay}T00:00:00Z`) - previousDay.getTime()) / 86400000) : null;
      const sameDay = old.data?.last_local_day === localDay;
      const canFreeze = gap === 2 && Number(old.data?.freeze_count || 0) > 0;
      const current = sameDay ? Number(old.data?.current_count || 0) : gap === 1 || canFreeze ? Number(old.data?.current_count || 0) + 1 : 1;
      streak = { current, best: Math.max(current, Number(old.data?.best_count || 0)), freezes: Math.max(0, Number(old.data?.freeze_count || 1) - (canFreeze ? 1 : 0)) };
      await supabase.from("streaks").upsert({ user_id: user.id, current_count: streak.current, best_count: streak.best, freeze_count: streak.freezes, last_local_day: localDay, updated_at: now() });
      await supabase.from("reward_ledger").upsert({ user_id: user.id, sighting_id: sightingId, kind: "sighting_xp", amount: 24 });
      await createNotification(supabase, user.id, "sighting", "Pawprint saved", `Your ${catType} sighting earned XP.`, "/#app");
    }
  }
  if (validation.status !== "accepted") await supabase.from("moderation_queue").insert({ target_type: "sighting", target_id: sightingId, reason: validation.reason });
  const body = { sightingId, status: validation.status, reason: validation.reason, catType, rarity: rarity(catType), description, publishedAt: publishedAt.toISOString(), expiresAt: expiresAt.toISOString(), validation: { ...validation }, rewardEligible: captureSource === "camera", rewards: validation.status === "accepted" && captureSource === "camera" ? { xp: 24, streak } : null };
  await supabase.from("request_keys").insert({ user_id: user.id, request_key: requestKey, response_json: body });
  return response(body, 201);
}

async function callRoute(request: Request, path: string, supabase: SupabaseClient) {
  const method = request.method;
  if (path === "/api/health") return response({ ok: true, service: "pawprint-supabase", persistence: "supabase", storage: "supabase-storage", aiValidationConfigured: Boolean(Deno.env.get("GEMINI_API_KEY") || Deno.env.get("OLLAMA_BASE_URL")), brevoConfigured: Boolean(Deno.env.get("BREVO_API_KEY")), pushConfigured: Boolean(Deno.env.get("PUSH_PUBLIC_KEY") && Deno.env.get("PUSH_PRIVATE_KEY")) });
  if (path === "/api/auth/config") return response({ enabled: Boolean(Deno.env.get("SUPABASE_URL") && Deno.env.get("SUPABASE_ANON_KEY")), url: Deno.env.get("SUPABASE_URL") || "", anonKey: Deno.env.get("SUPABASE_ANON_KEY") || "", providers: { google: Deno.env.get("SUPABASE_GOOGLE_AUTH_ENABLED") === "true", apple: Deno.env.get("SUPABASE_APPLE_AUTH_ENABLED") === "true" } });
  if (path === "/api/auth/send-code" && method === "POST") {
    const body = await request.json().catch(() => ({}));
    const email = String(body.email || "").trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email)) return errorResponse("INVALID_EMAIL", 400);
    const generated = await supabase.auth.admin.generateLink({ type: "magiclink", email });
    if (generated.error || !generated.data?.properties?.email_otp) throw generated.error || new Error("AUTH_CODE_NOT_CREATED");
    await sendBrevoAuthCode(email, generated.data.properties.email_otp);
    return response({ status: "sent", provider: "brevo" });
  }
  if (path === "/api/auth/verify-code" && method === "POST") {
    const body = await request.json().catch(() => ({}));
    const email = String(body.email || "").trim().toLowerCase();
    const token = String(body.token || "").trim();
    if (!/^\S+@\S+\.\S+$/.test(email) || !/^\d{6,8}$/.test(token)) return errorResponse("INVALID_CODE", 400);
    const authClient = createPublicAuthClient();
    const verified = await authClient.auth.verifyOtp({ email, token, type: "email" });
    if (verified.error || !verified.data.session) return errorResponse("INVALID_OR_EXPIRED_CODE", 400);
    return response({ session: verified.data.session, user: verified.data.user });
  }
  if (path === "/api/waitlist" && method === "POST") {
    const body = await request.json().catch(() => ({}));
    const email = String(body.email || "").trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email)) return errorResponse("INVALID_EMAIL", 400);
    const platform = String(body.platformInterest || "ios_android");
    // The database unique constraint is the final duplicate guard. Use INSERT
    // instead of upsert so a repeat signup cannot trigger another email.
    const result = await supabase.from("waitlist_signups").insert({ id: crypto.randomUUID(), email, platform_interest: platform, source: String(body.source || "landing"), created_at: new Date().toISOString() });
    if (result.error) {
      if (result.error.code === "23505") return response({ status: "already_subscribed", confirmationEmail: "not_sent" });
      throw result.error;
    }
    let confirmationEmail = "queued";
    try { confirmationEmail = (await sendBrevoConfirmation(email, platform)).sent ? "sent" : "queued"; } catch (error) { console.error(error); }
    return response({ status: "subscribed", confirmationEmail }, 201);
  }
  let user;
  try { user = await requireUser(request, supabase); } catch { return errorResponse("AUTH_REQUIRED", 401); }
  if (path === "/api/me" || path === "/api/profile" && method === "GET") return response({ user: await profile(supabase, user) });
  if (path === "/api/profile" && method === "PATCH") {
    const body = await request.json().catch(() => ({}));
    await ensureProfile(supabase, user);
    const fields: Record<string, unknown> = {};
    const onboardingCompleted = body.onboardingCompleted === true;
    const nickname = body.displayName === undefined ? "" : String(body.displayName).trim();
    if (onboardingCompleted && (!nickname || nicknameInvalid(nickname))) return errorResponse("INVALID_NICKNAME", 400, { message: "Choose a nickname with 3–20 letters, numbers, or underscores only. Do not use an email, phone number, or offensive word." });
    if (body.displayName !== undefined && nicknameInvalid(nickname)) return errorResponse("INVALID_NICKNAME", 400, { message: "Choose a nickname with 3–20 letters, numbers, or underscores only." });
    if (nickname) {
      // Use an exact lookup here; the database index below is the final
      // case-insensitive guard and avoids treating underscores as wildcards.
      const existing = await supabase.from("profiles").select("id").eq("nickname", nickname).neq("id", user.id).limit(1).maybeSingle();
      if (existing.error) throw existing.error;
      if (existing.data) return errorResponse("NICKNAME_TAKEN", 409, { message: "That nickname is already taken. Try the dice for another one." });
      fields.nickname = nickname;
    }
    if (body.avatarUrl !== undefined) fields.avatar = String(body.avatarUrl).slice(0, 80);
    const validAgeGroups = ["under_13", "13_17", "18_24", "25_34", "35_44", "45_plus", "prefer_not_to_say"];
    if (body.ageGroup !== undefined && !validAgeGroups.includes(String(body.ageGroup))) return errorResponse("INVALID_AGE_GROUP", 400, { message: "Choose one of the available age groups." });
    if (onboardingCompleted && body.ageGroup === undefined) return errorResponse("AGE_REQUIRED", 400, { message: "Choose an age group to continue." });
    if (body.ageGroup !== undefined) fields.age_group = String(body.ageGroup);
    if (body.ageGroup === "under_13") return errorResponse("AGE_RESTRICTED", 400, { message: "Pawprint is for people aged 13 and above." });
    if (onboardingCompleted && body.ageGroup === "13_17" && body.guardianConsent !== true) return errorResponse("GUARDIAN_CONSENT_REQUIRED", 400, { message: "Parent or legal guardian permission is required for ages 13–17." });
    if (body.gender !== undefined) fields.gender = String(body.gender).slice(0, 40);
    if (body.locationArea !== undefined) {
      const area = String(body.locationArea).trim();
      if (onboardingCompleted && !MOBILE_AREAS.some((item) => item.toLowerCase() === area.toLowerCase())) return errorResponse("INVALID_AREA", 400, { message: "Choose a city or area from the suggestions. Exact addresses are not accepted." });
      fields.location_area = area.slice(0, 80);
    }
    if (body.onboardingCompleted !== undefined) fields.onboarding_completed = Boolean(body.onboardingCompleted);
    if (body.privacyConsentVersion !== undefined) fields.privacy_notice_version = String(body.privacyConsentVersion).slice(0, 40);
    if (body.privacyConsentAt !== undefined) fields.privacy_consent_at = String(body.privacyConsentAt);
    if (body.catSpotterType !== undefined) fields.cat_spotter_type = ["casual", "daily", "rescuer"].includes(String(body.catSpotterType)) ? String(body.catSpotterType) : "casual";
    if (body.streakReminders !== undefined) fields.streak_reminders = Boolean(body.streakReminders);
    if (body.careFlagReminders !== undefined) fields.care_flag_reminders = Boolean(body.careFlagReminders);
    if (body.safetyPledgeAccepted !== undefined) fields.safety_pledge_accepted = Boolean(body.safetyPledgeAccepted);
    if (body.safetyPledgeAccepted === true) fields.safety_pledge_at = now();
    if (body.termsAcceptedAt !== undefined) fields.terms_accepted_at = String(body.termsAcceptedAt);
    if (body.guardianConsent === true) fields.guardian_consent_at = now();
    if (onboardingCompleted && (body.safetyPledgeAccepted !== true || !body.privacyConsentAt || !body.termsAcceptedAt)) return errorResponse("CONSENT_REQUIRED", 400, { message: "Accept the safety pledge, Terms, and Privacy Policy to continue." });
    if (body.timeZone !== undefined) fields.time_zone = String(body.timeZone).slice(0, 80);
    if (body.language !== undefined) fields.language = String(body.language).slice(0, 20);
    if (Object.keys(fields).length) {
      const updated = await supabase.from("profiles").update(fields).eq("id", user.id);
      if (updated.error?.code === "23505") return errorResponse("NICKNAME_TAKEN", 409, { message: "That nickname is already taken. Try the dice for another one." });
      if (updated.error) throw updated.error;
    }
    if (body.allowFriendRequests !== undefined || body.notificationPreference !== undefined) {
      const settings = await supabase.from("user_settings").upsert({ user_id: user.id, ...(body.allowFriendRequests === undefined ? {} : { allow_friend_requests: Boolean(body.allowFriendRequests) }), ...(body.notificationPreference === undefined ? {} : { notification_preference: String(body.notificationPreference) }), updated_at: now() });
      if (settings.error) throw settings.error;
    }
    if (body.visibility !== undefined) {
      const visibility = String(body.visibility);
      if (!['public', 'private'].includes(visibility)) return errorResponse("INVALID_VISIBILITY", 400, { message: "Choose Everyone or Only me." });
      const settings = await supabase.from("user_settings").upsert({ user_id: user.id, default_visibility: visibility, updated_at: now() });
      if (settings.error) throw settings.error;
    }
    return response({ user: await profile(supabase, user) });
  }
  if (path === "/api/dashboard" && method === "GET") return response(await dashboard(supabase, user));
  if (path === "/api/progress" && method === "GET") return response(await progress(supabase, user));
  if (path === "/api/journal" && method === "GET") { const result = await supabase.from("journal_entries").select("*, sightings(*)").eq("user_id", user.id).order("spotted_at", { ascending: false }); return response({ entries: result.data || [], summary: { total: result.data?.length || 0, unique: result.data?.filter((item) => item.first_spotted).length || 0 } }); }
  if (path === "/api/sightings" && method === "GET") {
    const blocked = await supabase.from("blocks").select("user_id,blocked_user_id").or(`user_id.eq.${user.id},blocked_user_id.eq.${user.id}`);
    const blockedIds = new Set((blocked.data || []).map((item) => item.user_id === user.id ? item.blocked_user_id : item.user_id));
    const result = await supabase.from("sightings").select("*,sighting_seen(count)").or(`user_id.eq.${user.id},and(visibility.eq.public,validation_status.eq.accepted)`).gt("expires_at", now()).order("captured_at", { ascending: false }).limit(100);
    return response({ sightings: (result.data || []).filter((item) => item.public_geohash && (item.user_id === user.id || !blockedIds.has(item.user_id))).map(toSighting) });
  }
  if (path === "/api/sightings" && method === "POST") return createSighting(request, supabase, user);
  if (path === "/api/capture-sessions" && method === "POST") { const body = await request.json().catch(() => ({})); const result = await supabase.from("capture_sessions").insert({ id: crypto.randomUUID(), user_id: user.id, device_time_zone: String(body.deviceTimeZone || "Asia/Manila"), camera_permission: String(body.cameraPermission || "denied"), location_permission: String(body.locationPermission || "denied"), expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(), created_at: now() }).select("id").single(); if (result.error) throw result.error; return response({ sessionId: result.data.id }, 201); }
  if (path === "/api/map" && method === "GET") { const blocked = await supabase.from("blocks").select("user_id,blocked_user_id").or(`user_id.eq.${user.id},blocked_user_id.eq.${user.id}`); const blockedIds = new Set((blocked.data || []).map((item) => item.user_id === user.id ? item.blocked_user_id : item.user_id)); const result = await supabase.from("sightings").select("*,sighting_seen(count)").eq("visibility", "public").eq("validation_status", "accepted").lt("published_at", now()).gt("expires_at", now()).limit(100); return response({ sightings: (result.data || []).filter((item) => !blockedIds.has(item.user_id)).map(toSighting) }); }
  if (path === "/api/care-flags" && method === "GET") { const blocked = await supabase.from("blocks").select("user_id,blocked_user_id").or(`user_id.eq.${user.id},blocked_user_id.eq.${user.id}`); const blockedIds = new Set((blocked.data || []).map((item) => item.user_id === user.id ? item.blocked_user_id : item.user_id)); const result = await supabase.from("care_flags").select("id,sighting_id,kind,note,status,created_at,user_id,sightings(cat_type)").order("created_at", { ascending: false }).limit(100); return response({ flags: (result.data || []).filter((item) => !blockedIds.has(item.user_id)).map(({ user_id: _userId, ...item }) => item) }); }
  if (path === "/api/care-flags" && method === "POST") { const body = await request.json().catch(() => ({})); const result = await supabase.from("care_flags").insert({ user_id: user.id, sighting_id: body.sightingId, kind: String(body.kind || "other"), note: String(body.note || "").slice(0, 500) }).select("*").single(); if (result.error) throw result.error; return response({ flag: result.data }, 201); }
  if (path === "/api/notifications" && method === "GET") { const result = await supabase.from("notifications").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(50); return response({ notifications: result.data || [] }); }
  if (path.startsWith("/api/notifications/") && method === "PATCH") { const notificationId = path.split("/").pop(); await supabase.from("notifications").update({ read_at: now() }).eq("id", notificationId).eq("user_id", user.id); return response({ status: "read" }); }
  if (path === "/api/leaderboards" && method === "GET") {
    const [sightings, rewards, profiles] = await Promise.all([
      supabase.from("sightings").select("user_id").eq("validation_status", "accepted"),
      supabase.from("reward_ledger").select("user_id,amount"),
      supabase.from("profiles").select("id,nickname,avatar"),
    ]);
    const counts = new Map<string, { sightings: number; xp: number }>();
    for (const item of sightings.data || []) counts.set(item.user_id, { sightings: (counts.get(item.user_id)?.sightings || 0) + 1, xp: counts.get(item.user_id)?.xp || 0 });
    for (const item of rewards.data || []) counts.set(item.user_id, { sightings: counts.get(item.user_id)?.sightings || 0, xp: (counts.get(item.user_id)?.xp || 0) + Number(item.amount || 0) });
    const names = new Map((profiles.data || []).map((item) => [item.id, item]));
    const leaders = [...counts.entries()].sort((a, b) => b[1].xp - a[1].xp).slice(0, 20).map(([userId, value], index) => ({ rank: index + 1, name: names.get(userId)?.nickname || "Pawprint spotter", avatar: names.get(userId)?.avatar || "cat-ink", ...value, level: Math.max(1, Math.floor(Math.sqrt(Math.max(0, value.xp) / 100)) + 1) }));
    return response({ leaders, scope: new URL(request.url).searchParams.get("scope") || "country" });
  }
  if (path === "/api/calendar" && method === "GET") {
    const result = await supabase.from("sightings").select("captured_at").eq("user_id", user.id).eq("validation_status", "accepted").gte("captured_at", new Date(Date.now() - 14 * 86400000).toISOString());
    const active = new Set((result.data || []).map((item) => String(item.captured_at).slice(0, 10)));
    const days = Array.from({ length: 7 }, (_, index) => { const date = new Date(Date.now() - (6 - index) * 86400000); const key = date.toISOString().slice(0, 10); return { key, status: active.has(key) ? "complete" : key === new Date().toISOString().slice(0, 10) ? "today" : "empty", label: new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(date), number: date.getUTCDate() }; });
    return response({ days });
  }
  if (path === "/api/push/config" && method === "GET") return response({ configured: Boolean(pushVapid()), publicKey: Deno.env.get("PUSH_PUBLIC_KEY") || null });
  if (path === "/api/push/subscriptions" && method === "POST") {
    const body = await request.json();
    const endpoint = String(body.endpoint || "");
    if (!endpoint.startsWith("https://") || !body.keys?.p256dh || !body.keys?.auth) return errorResponse("INVALID_PUSH_SUBSCRIPTION", 400);
    const result = await supabase.from("push_subscriptions").upsert({ user_id: user.id, endpoint, p256dh: body.keys.p256dh, auth: body.keys.auth, updated_at: now() }, { onConflict: "endpoint" });
    if (result.error) throw result.error;
    return response({ status: "saved" }, 201);
  }
  if (path === "/api/push/subscriptions" && method === "DELETE") { const body = await request.json().catch(() => ({})); await supabase.from("push_subscriptions").delete().eq("user_id", user.id).eq("endpoint", body.endpoint); return response({ status: "deleted" }); }
  if (path === "/api/community" && method === "GET") { const kind = new URL(request.url).searchParams.get("kind"); let query = supabase.from("community_assets").select("*").order("created_at", { ascending: false }).limit(100); if (kind) query = query.eq("kind", kind); const result = await query; return response({ assets: result.data || [] }); }
  if (path === "/api/community-assets" && method === "GET") { const result = await supabase.from("community_assets").select("*").order("created_at", { ascending: false }).limit(100); return response({ assets: result.data || [] }); }
  if (path === "/api/community-assets" && method === "POST") { const body = await request.json(); const result = await supabase.from("community_assets").insert({ kind: body.kind, title: body.title, description: body.description, area_name: body.areaName, contact: body.contact, created_by: user.id }).select("*").single(); if (result.error) throw result.error; return response({ asset: result.data }, 201); }
  if (path === "/api/rescue-requests" && method === "POST") { const body = await request.json(); const result = await supabase.from("rescue_requests").insert({ user_id: user.id, sighting_id: body.sightingId || null, need: String(body.need || "").slice(0, 200), note: String(body.note || "").slice(0, 500) }).select("*").single(); if (result.error) throw result.error; return response({ request: result.data }, 201); }
  if (path === "/api/wrapped" && method === "GET") { const stats = await progress(supabase, user); return response({ shareText: `I have found ${stats.journal.total} cats and earned ${stats.xp} XP on Pawprint.` }); }
  if (path === "/api/share-card" && method === "GET") { const stats = await progress(supabase, user); return response({ card: { stats: { catsSpotted: stats.journal.unique, xp: stats.xp, bestStreak: stats.streak.best }, shareText: `Pawprint · ${stats.journal.unique} cats spotted · ${stats.xp} XP` } }); }
  if (path.startsWith("/api/admin/")) {
    if (!isAdmin(user)) return errorResponse("ADMIN_REQUIRED", 403);
    if (path === "/api/admin/analytics" && method === "GET") {
      const [users, sightings, accepted] = await Promise.all([supabase.from("profiles").select("id", { count: "exact", head: true }), supabase.from("sightings").select("id", { count: "exact", head: true }), supabase.from("sightings").select("id", { count: "exact", head: true }).eq("validation_status", "accepted")]);
      return response({ metrics: { users: users.count || 0, sightings: sightings.count || 0, acceptedPhotos: accepted.count || 0 } });
    }
    if (path === "/api/admin/moderation" && method === "GET") { const result = await supabase.from("moderation_queue").select("*").eq("status", "open").order("created_at", { ascending: false }); return response({ items: result.data || [] }); }
    if (path === "/api/admin/care-flags" && method === "GET") { const result = await supabase.from("care_flags").select("*, sightings(cat_type)").eq("status", "open").order("created_at", { ascending: false }); return response({ items: result.data || [], flags: result.data || [] }); }
    if (path.startsWith("/api/admin/moderation/") && method === "POST") { const itemId = path.split("/").pop(); const body = await request.json().catch(() => ({})); await supabase.from("moderation_queue").update({ status: "resolved", action: body.action, assigned_to: user.id, resolved_at: now() }).eq("id", itemId); return response({ status: "resolved" }); }
    if (path.startsWith("/api/admin/care-flags/") && method === "PATCH") { const itemId = path.split("/").pop(); const body = await request.json().catch(() => ({})); await supabase.from("care_flags").update({ status: body.status || "helped" }).eq("id", itemId); return response({ status: "updated" }); }
  }
  if (path === "/api/account" && method === "DELETE") {
    const listed = await supabase.storage.from("pawprint-sightings").list(user.id, { limit: 1000 });
    if (listed.error) throw listed.error;
    const paths = (listed.data || []).map((item) => `${user.id}/${item.name}`).filter(Boolean);
    if (paths.length) {
      const removed = await supabase.storage.from("pawprint-sightings").remove(paths);
      if (removed.error) throw removed.error;
    }
    await removeBrevoContact(String(user.email || "").trim().toLowerCase());
    const cleared = await supabase.rpc("delete_pawprint_user_data", { target_user: user.id });
    if (cleared.error) throw cleared.error;
    const deleted = await supabase.auth.admin.deleteUser(user.id);
    if (deleted.error) throw deleted.error;
    return response({ status: "deleted" });
  }
  if (path.startsWith("/api/sightings/") && path.endsWith("/photo") && method === "GET") { const sightingId = path.split("/").slice(-2, -1)[0]; const item = await supabase.from("sightings").select("storage_path,user_id,visibility").eq("id", sightingId).maybeSingle(); if (!item.data || (item.data.user_id !== user.id && item.data.visibility !== "public")) return errorResponse("NOT_FOUND", 404); const signed = await supabase.storage.from("pawprint-sightings").createSignedUrl(item.data.storage_path, 300); if (signed.error) throw signed.error; return Response.redirect(signed.data.signedUrl, 302); }
  if (path.startsWith("/api/sightings/") && method === "DELETE") { const sightingId = path.split("/").pop(); const item = await supabase.from("sightings").select("storage_path").eq("id", sightingId).eq("user_id", user.id).maybeSingle(); if (!item.data) return errorResponse("SIGHTING_NOT_FOUND", 404); if (item.data.storage_path) await supabase.storage.from("pawprint-sightings").remove([item.data.storage_path]); await supabase.from("sightings").delete().eq("id", sightingId).eq("user_id", user.id); return response({ status: "deleted", sightingId }); }
  if (path === "/api/sightings/seen" && method === "POST") {
    const body = await request.json().catch(() => ({}));
    const sightingId = String(body.sightingId || "");
    if (!sightingId) return errorResponse("SIGHTING_REQUIRED", 400);
    const sighting = await supabase.from("sightings").select("id,user_id").eq("id", sightingId).eq("validation_status", "accepted").maybeSingle();
    if (!sighting.data) return errorResponse("SIGHTING_NOT_FOUND", 404);
    const blocked = await supabase.from("blocks").select("user_id,blocked_user_id").or(`user_id.eq.${user.id},blocked_user_id.eq.${user.id}`);
    if ((blocked.data || []).some((item) => (item.user_id === user.id ? item.blocked_user_id : item.user_id) === sighting.data.user_id)) return errorResponse("SIGHTING_BLOCKED", 403);
    const marked = await supabase.rpc("mark_sighting_seen", { target_user: user.id, target_sighting: sightingId });
    if (marked.error) throw marked.error;
    return response({ status: marked.data ? "marked" : "already_marked" });
  }
  if (path === "/api/reports" && method === "POST") {
    const body = await request.json().catch(() => ({}));
    const targetType = String(body.targetType || "");
    const targetId = String(body.targetId || "");
    const reason = String(body.reason || "other").slice(0, 80);
    if (!['sighting', 'care_flag', 'profile'].includes(targetType) || !targetId) return errorResponse("INVALID_REPORT", 400);
    const result = await supabase.from("reports").insert({ user_id: user.id, target_type: targetType, target_id: targetId, reason, note: String(body.note || "").slice(0, 500) });
    if (result.error) throw result.error;
    await supabase.from("moderation_queue").insert({ target_type: targetType, target_id: targetId, reason: `USER_REPORT:${reason}` });
    return response({ status: "reported" }, 201);
  }
  if (path === "/api/blocks" && method === "POST") {
    const body = await request.json().catch(() => ({}));
    const blockedUserId = await resolveTargetUserId(supabase, body);
    if (!blockedUserId || blockedUserId === user.id) return errorResponse("INVALID_BLOCK", 400);
    const result = await supabase.from("blocks").upsert({ user_id: user.id, blocked_user_id: blockedUserId });
    if (result.error) throw result.error;
    return response({ status: "blocked" }, 201);
  }
  if (path === "/api/export" && method === "POST") { const [p, j, s, r, c] = await Promise.all([profile(supabase, user), supabase.from("journal_entries").select("*").eq("user_id", user.id), supabase.from("sightings").select("*").eq("user_id", user.id), supabase.from("reward_ledger").select("*").eq("user_id", user.id), supabase.from("care_flags").select("*").eq("user_id", user.id)]); return new Response(JSON.stringify({ exportedAt: now(), profile: p, journal: j.data || [], sightings: s.data || [], rewards: r.data || [], careFlags: c.data || [] }), { headers: { ...headers, "content-type": "application/json", "content-disposition": "attachment; filename=pawprint-export.json" } }); }
  return errorResponse("NOT_FOUND", 404);
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers });
  const supabase = createServiceClient();
  const pathname = new URL(request.url).pathname;
  const apiIndex = pathname.indexOf("/api");
  const path = apiIndex >= 0 ? pathname.slice(apiIndex) : pathname;
  try { return await callRoute(request, path, supabase); }
  catch (error) { console.error(error); return errorResponse(error instanceof Error ? error.message : "INTERNAL_ERROR", error instanceof Error && error.message === "AUTH_REQUIRED" ? 401 : 500); }
});
