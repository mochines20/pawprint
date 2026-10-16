import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { extname, normalize, resolve, sep } from "node:path";

const root = resolve(process.cwd(), process.argv[2] || "dist");
const port = Number(process.env.PAWPRINT_PORT || 4173);
const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".webp": "image/webp",
};
let previewProfile = {
  display_name: "Pawprint spotter",
  email: "",
  time_zone: "Asia/Manila",
  language: "en",
  allow_friend_requests: 1,
  notification_preference: "included",
};
const previewState = {
  xp: 248,
  currentStreak: 4,
  bestStreak: 7,
  dailyCats: 8,
  rareFound: false,
  journal: Array.from({ length: 8 }, (_, index) => ({
    id: `preview-journal-${index + 1}`,
    sightingId: `preview-sighting-${index + 1}`,
    catType: ["Orange tabby", "Tuxedo", "Gray cat", "Calico", "Black cat", "White cat", "Bengal", "Siamese"][index],
    spottedAt: new Date(Date.now() - index * 86400000).toISOString(),
    firstSpotted: true,
    visibility: index % 2 ? "private" : "friends",
    validationStatus: "accepted",
    description: [
      "Calm orange cat resting near the shaded walkway.",
      "Quiet tuxedo cat watching the street from a safe distance.",
      "Gentle gray cat sitting beside the garden wall.",
      "Curious calico cat exploring the covered path.",
      "Black cat taking a quiet break near the neighborhood corner.",
      "White cat resting under a parked car, observed from afar.",
      "Spotted Bengal pattern near the community garden.",
      "Siamese cat waiting calmly beside the shaded gate.",
    ][index],
    catBreed: ["Domestic shorthair", "Domestic shorthair", "Domestic shorthair", "Domestic shorthair", "Domestic shorthair", "Domestic shorthair", "Bengal mix", "Siamese mix"][index],
    coatType: ["Orange tabby", "Black and white", "Solid gray", "Calico", "Solid black", "Solid white", "Spotted tabby", "Colorpoint"][index],
    photoUrl: `/assets/${index % 2 ? "cat-tabby-gravel.webp" : "cat-tabby-paving.webp"}`,
    locationLabel: index % 2 ? "Private Journal area · exact location hidden" : "Approximate Manila area · exact location hidden",
  })),
  sightings: [],
  careFlags: [],
  notifications: [],
  sessions: new Map(),
  waitlist: [],
  community: [],
};
function previewLevel(xp) { return Math.max(1, Math.floor(Math.sqrt(Math.max(0, Number(xp || 0)) / 100)) + 1); }
function previewStreakDecision(forceBroken = false) {
  const timeZone = "Asia/Manila";
  const today = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const todayDate = new Date(`${today}T00:00:00Z`);
  const activeDays = new Set(previewState.journal.map((entry) => new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(entry.spottedAt))));
  const days = [];
  for (let offset = -3; offset <= 3; offset += 1) {
    const date = new Date(todayDate);
    date.setUTCDate(date.getUTCDate() + offset);
    const key = date.toISOString().slice(0, 10);
    const complete = activeDays.has(key);
    days.push({ key, label: new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short" }).format(date), number: date.getUTCDate(), status: complete ? "complete" : key === today ? "today" : "empty", isToday: key === today });
  }
  return {
    today,
    active: !forceBroken && previewState.currentStreak > 0,
    broken: forceBroken || previewState.currentStreak <= 0,
    state: !forceBroken && previewState.currentStreak > 0 ? "active" : "broken",
    label: !forceBroken && previewState.currentStreak > 0 ? "Orange cat streak" : "Black cat reset",
    helper: !forceBroken && previewState.currentStreak > 0 ? "Validated pawprints keep it glowing." : "Validate a cat photo to restart your streak.",
    days,
  };
}
function previewProgress() {
  const medals = [
    ["xp-paw-seed", "Paw Seed", "Your first little mark on the Pawprint trail.", 0, "mist"],
    ["xp-first-paw", "First Paw", "A safe first step for the community.", 24, "amber"],
    ["xp-alley-scout", "Alley Scout", "You are learning the streets with care.", 100, "sage"],
    ["xp-night-watcher", "Night Watcher", "A steady eye for cats who need a little space.", 250, "ink"],
    ["xp-street-naturalist", "Street Naturalist", "A thoughtful record of neighborhood life.", 500, "coral"],
    ["xp-pawprint-legend", "Pawprint Legend", "A long, gentle trail of verified care.", 1000, "gold"],
  ].map(([id, title, description, xpRequired, tone]) => ({ id, title, description, xpRequired, tone, earned: previewState.xp >= xpRequired }));
  const easterRewards = [
    ["easter-twenty-in-a-day", "Cat Marathon", "Photograph 20 accepted cat sightings in one local day.", "20 cats in one day", "amber", previewState.dailyCats >= 20],
    ["easter-rare-find", "Rare Find", "Find an accepted rare or super-rare cat pattern.", "Rare cat found", "coral", previewState.rareFound],
    ["easter-gentle-helper", "Gentle Helper", "Send a care signal for a cat that needs help.", "Cat helped", "sage", previewState.careFlags.length > 0],
  ].map(([id, title, description, requirement, tone, earned]) => ({ id, title, description, requirement, tone, earned }));
  return {
    xp: previewState.xp,
    level: previewLevel(previewState.xp),
    nextLevelXp: Math.pow(previewLevel(previewState.xp), 2) * 100,
    streak: { current: previewState.currentStreak, best: previewState.bestStreak, freezes: 1 },
    badges: [...medals.filter((medal) => medal.earned).map((medal) => medal.id), ...easterRewards.filter((reward) => reward.earned).map((reward) => reward.id)],
    medals,
    nextMedal: medals.find((medal) => !medal.earned) || null,
    easterRewards,
    quests: [],
    rarity: { common: "Common", uncommon: "Uncommon", rare: "Rare", superRare: "Super Rare" },
    demo: true,
  };
}
function sendJson(response, data, status = 200) {
  response.writeHead(status, { "cache-control": "no-store", "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(data));
}

function safePath(requestPath) {
  const relative = requestPath === "/" ? "index.html" : requestPath.replace(/^\/+/, "");
  const target = resolve(root, normalize(relative));
  return target.startsWith(`${root}${sep}`) ? target : null;
}

async function loadLocalEnv() {
  const envPath = resolve(process.cwd(), ".env.local");
  if (!existsSync(envPath)) return;
  const contents = await readFile(envPath, "utf8");
  for (const line of contents.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!match || match[1].startsWith("#") || process.env[match[1]]) continue;
    process.env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, "$2");
  }
}

async function readJson(request) {
  let body = "";
  for await (const chunk of request) body += chunk;
  try { return JSON.parse(body || "{}"); } catch { return {}; }
}

async function readBody(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

async function proxyRemoteApi(request, url, response, origin) {
  const target = `${origin}${url.pathname}${url.search}`;
  const headers = new Headers();
  for (const [key, value] of Object.entries(request.headers)) {
    if (key === "host" || key === "content-length") continue;
    headers.set(key, value);
  }
  const body = request.method === "GET" || request.method === "HEAD" ? undefined : await readBody(request);
  const upstream = await fetch(target, { method: request.method, headers, body });
  const responseHeaders = {};
  upstream.headers.forEach((value, key) => {
    if (key !== "content-encoding" && key !== "transfer-encoding") responseHeaders[key] = value;
  });
  response.writeHead(upstream.status, responseHeaders);
  response.end(Buffer.from(await upstream.arrayBuffer()));
}

await loadLocalEnv();
const remoteApiOrigin = String(process.env.PAWPRINT_API_ORIGIN || "").replace(/\/$/, "");

const server = createServer(async (request, response) => {
  const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);
  if (url.pathname === "/api/auth/config") {
    const supabaseUrl = process.env.PAWPRINT_SUPABASE_URL || process.env.SUPABASE_URL || "";
    const supabaseAnonKey = process.env.PAWPRINT_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || "";
    response.writeHead(200, { "cache-control": "no-store", "content-type": "application/json; charset=utf-8" });
    response.end(JSON.stringify({
      enabled: Boolean(supabaseUrl && supabaseAnonKey),
      url: supabaseUrl,
      anonKey: supabaseAnonKey,
      providers: {
        google: process.env.PAWPRINT_GOOGLE_AUTH_ENABLED === "true",
        apple: process.env.PAWPRINT_APPLE_AUTH_ENABLED === "true",
      },
    }));
    return;
  }
  if (url.pathname === "/api/health" && request.method === "GET") {
    response.writeHead(200, { "cache-control": "no-store", "content-type": "application/json; charset=utf-8" });
    response.end(JSON.stringify({
      ok: true,
      service: "pawprint-local-preview",
      supabaseConfigured: Boolean(process.env.PAWPRINT_SUPABASE_URL && (process.env.PAWPRINT_SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY)),
      aiValidationConfigured: Boolean(process.env.GEMINI_API_KEY || process.env.OLLAMA_BASE_URL || process.env.OLLAMA_API_URL || process.env.AI_VALIDATION_URL),
      persistence: remoteApiOrigin ? "remote-worker" : "preview-only",
      backendOrigin: remoteApiOrigin || null,
    }));
    return;
  }
  if (remoteApiOrigin && url.pathname.startsWith("/api/") && url.pathname !== "/api/auth/config" && url.pathname !== "/api/health") {
    try {
      await proxyRemoteApi(request, url, response, remoteApiOrigin);
    } catch (error) {
      sendJson(response, { error: "REMOTE_API_UNAVAILABLE", detail: String(error?.message || error) }, 502);
    }
    return;
  }
  if (url.pathname === "/api/journal" && request.method === "GET") {
    sendJson(response, { entries: previewState.journal, summary: { total: previewState.journal.length, unique: previewState.journal.filter((entry) => entry.firstSpotted).length }, demo: true });
    return;
  }
  if (url.pathname === "/api/dashboard" && request.method === "GET") {
    const forceBroken = url.searchParams.get("streak") === "broken";
    const decision = previewStreakDecision(forceBroken);
    sendJson(response, { streak: { current: forceBroken ? 0 : previewState.currentStreak, best: previewState.bestStreak, freezes: 1, ...decision }, streakCalendar: decision.days, today: { key: decision.today, validated: !forceBroken && decision.days.some((day) => day.key === decision.today && day.status === "complete") }, journal: { unique: previewState.journal.filter((entry) => entry.firstSpotted).length }, xp: previewState.xp, sightings: previewState.sightings, demo: true });
    return;
  }
  if (url.pathname === "/api/progress" && request.method === "GET") {
    sendJson(response, previewProgress());
    return;
  }
  if (url.pathname === "/api/leaderboards" && request.method === "GET") {
    response.writeHead(200, { "cache-control": "no-store", "content-type": "application/json; charset=utf-8" });
    response.end(JSON.stringify({ scope: url.searchParams.get("scope") || "country", leaders: [], demo: true }));
    return;
  }
  if (url.pathname === "/api/community" && request.method === "GET") {
    sendJson(response, { assets: previewState.community, demo: true });
    return;
  }
  if (url.pathname === "/api/notifications" && request.method === "GET") {
    sendJson(response, { notifications: previewState.notifications, demo: true });
    return;
  }
  if (url.pathname.startsWith("/api/notifications/") && request.method === "PATCH") {
    const notification = previewState.notifications.find((item) => item.id === url.pathname.split("/").pop());
    if (notification) notification.read = true;
    sendJson(response, { status: "read", demo: true });
    return;
  }
  if (url.pathname === "/api/share-card" && request.method === "GET") {
    const progress = previewProgress();
    sendJson(response, {
      card: {
        year: new Date().getUTCFullYear(),
        stats: { catsSpotted: previewState.journal.length, typesCollected: new Set(previewState.journal.map((entry) => entry.catType)).size, xp: previewState.xp, bestStreak: previewState.bestStreak, careFlags: previewState.careFlags.length, medal: { id: progress.medals.filter((medal) => medal.earned).at(-1)?.id || "xp-paw-seed", title: progress.medals.filter((medal) => medal.earned).at(-1)?.title || "Paw Seed", xpRequired: progress.medals.filter((medal) => medal.earned).at(-1)?.xpRequired || 0 } },
        shareText: `My Pawprint Wrapped: ${previewState.journal.length} cats spotted, ${previewState.xp} XP earned, and ${progress.medals.filter((medal) => medal.earned).at(-1)?.title || "Paw Seed"} medal unlocked.`,
        brand: "Pawprint",
        tagline: "Spot cats. Leave a safer trace.",
      },
      demo: true,
    });
    return;
  }
  if (url.pathname === "/api/wrapped" && request.method === "GET") {
    const progress = previewProgress();
    const earnedMedals = progress.medals.filter((medal) => medal.earned);
    const currentMedal = earnedMedals.at(-1) || progress.medals[0];
    sendJson(response, {
      year: new Date().getUTCFullYear(),
      stats: {
        catsSpotted: previewState.journal.length,
        typesCollected: new Set(previewState.journal.map((entry) => entry.catType)).size,
        xp: previewState.xp,
        bestStreak: previewState.bestStreak,
        careFlags: previewState.careFlags.length,
        medal: { id: currentMedal.id, title: currentMedal.title, xpRequired: currentMedal.xpRequired },
      },
      shareText: `My Pawprint Wrapped: ${previewState.journal.length} cats spotted, ${previewState.xp} XP earned, and ${currentMedal.title} medal unlocked.`,
      demo: true,
    });
    return;
  }
  if (url.pathname === "/api/me" && request.method === "GET") {
    sendJson(response, { user: previewProfile, demo: true });
    return;
  }
  if (url.pathname === "/api/profile" && request.method === "GET") {
    sendJson(response, { user: previewProfile, demo: true });
    return;
  }
  if (url.pathname === "/api/capture-sessions" && request.method === "POST") {
    const body = await readJson(request);
    if (body.cameraPermission !== "granted") { sendJson(response, { error: "CAMERA_REQUIRED" }, 400); return; }
    if (body.locationPermission !== "granted") { sendJson(response, { error: "LOCATION_REQUIRED" }, 400); return; }
    const sessionId = `preview-capture-${Date.now()}`;
    previewState.sessions.set(sessionId, { createdAt: Date.now(), timeZone: String(body.deviceTimeZone || "Asia/Manila") });
    sendJson(response, { sessionId, expiresAt: new Date(Date.now() + 600000).toISOString(), demo: true }, 201);
    return;
  }
  if (url.pathname === "/api/profile" && request.method === "PATCH") {
    const body = await readJson(request);
    if (body.displayName !== undefined) previewProfile.display_name = String(body.displayName || "Pawprint spotter").slice(0, 80);
    if (body.nickname !== undefined) previewProfile.display_name = String(body.nickname || "Pawprint spotter").slice(0, 80);
    if (body.timeZone !== undefined) previewProfile.time_zone = String(body.timeZone || "Asia/Manila").slice(0, 80);
    if (body.language !== undefined) previewProfile.language = String(body.language || "en").slice(0, 20);
    if (body.ageGroup !== undefined) previewProfile.age_group = String(body.ageGroup || "prefer_not_to_say").slice(0, 30);
    if (body.avatarUrl !== undefined) previewProfile.avatar_url = String(body.avatarUrl || "").slice(0, 500);
    if (body.allowFriendRequests !== undefined) previewProfile.allow_friend_requests = body.allowFriendRequests ? 1 : 0;
    if (body.notificationPreference !== undefined) previewProfile.notification_preference = String(body.notificationPreference || "included").slice(0, 20);
    sendJson(response, { user: previewProfile, demo: true });
    return;
  }
  if (url.pathname === "/api/care-flags" && request.method === "GET") {
    sendJson(response, { flags: previewState.careFlags, demo: true });
    return;
  }
  if (url.pathname === "/api/care-flags" && request.method === "POST") {
    const body = await readJson(request);
    const kind = ["thin", "injured", "pregnant", "lone_kitten", "other"].includes(body.kind) ? body.kind : "other";
    const sightingId = String(body.sightingId || previewState.sightings[0]?.id || previewState.journal[0]?.sightingId || "");
    if (!sightingId) { sendJson(response, { error: "SIGHTING_NOT_ELIGIBLE" }, 400); return; }
    const flag = { id: `preview-care-${Date.now()}`, sightingId, kind, note: String(body.note || "Community member requested a care review."), status: "open", createdAt: new Date().toISOString(), catType: "Preview cat" };
    previewState.careFlags.unshift(flag);
    previewState.notifications.unshift({ id: `preview-note-${Date.now()}`, type: "care", title: "Care Flag sent", body: "Your care signal is in the community review queue.", read: false, createdAt: flag.createdAt });
    sendJson(response, { careFlagId: flag.id, status: "open", demo: true }, 201);
    return;
  }
  if (url.pathname === "/api/sightings" && request.method === "POST") {
    for await (const _chunk of request) { /* drain multipart preview request */ }
    const sightingId = `preview-sighting-${Date.now()}`;
    const catType = ["Orange tabby", "Tuxedo", "Gray cat", "Calico", "Black cat"][previewState.journal.length % 5];
    const capturedAt = new Date().toISOString();
    const sighting = { id: sightingId, catType, catBreed: "Preview classification", coatType: "Preview coat", catConfidence: 0.99, validationStatus: "accepted", visibility: "friends", description: "A live preview sighting saved from the local browser flow.", photoUrl: "/assets/cat-tabby-paving.webp", capturedAt, expiresAt: new Date(Date.now() + 86400000).toISOString(), area: { latitude: 14.5995, longitude: 120.9842, label: "Approximate Manila area" } };
    previewState.sightings.unshift(sighting);
    previewState.journal.unshift({ id: `preview-journal-${Date.now()}`, sightingId, catType, spottedAt: capturedAt, firstSpotted: !previewState.journal.some((entry) => entry.catType === catType), visibility: "friends", validationStatus: "accepted", description: "A live preview sighting saved from the local browser flow.", catBreed: "Preview classification", coatType: "Preview coat", photoUrl: "/assets/cat-tabby-paving.webp", locationLabel: "Approximate Manila area · exact location hidden" });
    previewState.xp += 24;
    previewState.dailyCats += 1;
    previewState.currentStreak = Math.max(1, previewState.currentStreak);
    previewState.bestStreak = Math.max(previewState.bestStreak, previewState.currentStreak);
    if (catType === "Calico" || catType === "Black cat") previewState.rareFound = true;
    sendJson(response, { sightingId, status: "accepted", reason: null, catType, rarity: previewState.rareFound ? "Rare" : "Common", validation: { catDetected: true, personDetected: false, screenshotDetected: false, unsafe: false, duplicate: false, catType, catBreed: sighting.catBreed, coatType: sighting.coatType, catConfidence: sighting.catConfidence, aiGenerated: false, aiGeneratedConfidence: 0.01 }, rewards: { xp: 24, streak: { currentCount: previewState.currentStreak, bestCount: previewState.bestStreak } }, demo: true }, 201);
    return;
  }
  if (url.pathname === "/api/sightings" && request.method === "GET") {
    sendJson(response, { sightings: previewState.sightings, demo: true });
    return;
  }
  if (url.pathname.startsWith("/api/sightings/") && request.method === "DELETE") {
    const sightingId = url.pathname.split("/").pop();
    previewState.sightings = previewState.sightings.filter((sighting) => sighting.id !== sightingId);
    previewState.journal = previewState.journal.filter((entry) => entry.sightingId !== sightingId);
    sendJson(response, { status: "deleted", sightingId, demo: true });
    return;
  }
  if (url.pathname === "/api/map" && request.method === "GET") {
    sendJson(response, { zoom: Number(url.searchParams.get("zoom") || 5), clusters: previewState.sightings.map((sighting) => ({ id: sighting.id, count: 1, emergency: previewState.careFlags.some((flag) => flag.sightingId === sighting.id), area: sighting.area, sample: sighting })), demo: true });
    return;
  }
  if (url.pathname === "/api/calendar" && request.method === "GET") {
    sendJson(response, { entries: previewState.journal.map((entry) => ({ ...entry, area: "Approximate Manila area" })), demo: true });
    return;
  }
  if (url.pathname === "/api/waitlist" && request.method === "POST") {
    const body = await readJson(request);
    const email = String(body.email || "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { sendJson(response, { error: "INVALID_EMAIL" }, 400); return; }
    const signup = { email, platformInterest: ["ios", "android", "ios_android"].includes(body.platformInterest) ? body.platformInterest : "ios_android", source: String(body.source || "landing"), createdAt: new Date().toISOString() };
    if (!previewState.waitlist.some((item) => item.email === email)) previewState.waitlist.push(signup);
    sendJson(response, { status: "subscribed", platformInterest: signup.platformInterest, demo: true }, 201);
    return;
  }
  if (url.pathname === "/api/rescue-requests" && request.method === "POST") {
    const body = await readJson(request);
    if (!String(body.need || "").trim()) { sendJson(response, { error: "INVALID_RESCUE_REQUEST" }, 400); return; }
    const requestId = `preview-rescue-${Date.now()}`;
    previewState.notifications.unshift({ id: `preview-note-${Date.now()}`, type: "rescue_request", title: "Rescue request received", body: "Your request is queued for the preview review flow.", read: false, createdAt: new Date().toISOString() });
    sendJson(response, { requestId, status: "open", demo: true }, 201);
    return;
  }
  if (url.pathname === "/api/community-assets" && request.method === "GET") {
    sendJson(response, { assets: previewState.community, demo: true });
    return;
  }
  if (url.pathname === "/api/community-assets" && request.method === "POST") {
    const body = await readJson(request);
    if (!body.title) { sendJson(response, { error: "INVALID_COMMUNITY_ASSET" }, 400); return; }
    const asset = { id: `preview-asset-${Date.now()}`, kind: String(body.kind || "other"), title: String(body.title).slice(0, 120), description: String(body.description || ""), areaName: String(body.areaName || "Approximate area"), verified: false, createdAt: new Date().toISOString() };
    previewState.community.unshift(asset);
    sendJson(response, { assetId: asset.id, status: "pending_review", demo: true }, 201);
    return;
  }
  if (url.pathname === "/api/export" && request.method === "POST") {
    sendJson(response, { exportedAt: new Date().toISOString(), user: previewProfile, journal: previewState.journal, sightings: previewState.sightings, careFlags: previewState.careFlags, rewards: previewProgress(), demo: true });
    return;
  }
  if (url.pathname === "/api/account" && request.method === "DELETE") {
    previewState.xp = 0;
    previewState.journal = [];
    previewState.sightings = [];
    previewState.careFlags = [];
    previewState.notifications = [];
    sendJson(response, { status: "completed", demo: true });
    return;
  }
  if (url.pathname === "/favicon.ico" && request.method === "GET") {
    const icon = await readFile(resolve(root, "assets", "pawprint-icon.svg"));
    response.writeHead(200, { "cache-control": "public, max-age=3600", "content-type": "image/svg+xml" });
    response.end(icon);
    return;
  }
  const target = safePath(url.pathname);
  if (!target || !existsSync(target)) {
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("Not found");
    return;
  }
  try {
    const body = await readFile(target);
    response.writeHead(200, {
      "cache-control": "no-store",
      "content-type": contentTypes[extname(target).toLowerCase()] || "application/octet-stream",
    });
    response.end(body);
  } catch {
    response.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
    response.end("Preview server error");
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Pawprint localhost preview: http://localhost:${port}`);
});
