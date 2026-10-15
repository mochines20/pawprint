import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const nativeFetch = window.fetch.bind(window);
const authReady = Promise.resolve().then(async () => {
  const response = await nativeFetch("/api/auth/config", { headers: { accept: "application/json" } });
  if (!response.ok) throw new Error("AUTH_CONFIG_UNAVAILABLE");
  const config = await response.json();
  if (!config.enabled || !config.url || !config.anonKey) return { client: null, config };
  return { client: createClient(config.url, config.anonKey, { auth: { flowType: "pkce", detectSessionInUrl: false } }), config };
});

window.pawprintAuthReady = authReady;
window.pawprintSession = null;

const styles = `
.auth-backdrop{position:fixed;inset:0;z-index:1000;display:grid;place-items:center;padding:18px;background:rgba(23,23,23,.58);backdrop-filter:blur(8px);opacity:0;visibility:hidden;transition:opacity .22s ease,visibility .22s ease}
.auth-backdrop.is-open{opacity:1;visibility:visible}
.auth-panel{position:relative;width:min(100%,470px);max-height:min(720px,calc(100vh - 36px));overflow:auto;padding:30px;border:1px solid #e0e1e3;border-radius:28px;background:#fff;box-shadow:0 22px 70px rgba(0,0,0,.28);transform:translateY(12px) scale(.98);transition:transform .24s ease}
.auth-backdrop.is-open .auth-panel{transform:none}.auth-close{position:absolute;top:15px;right:15px;width:38px;height:38px;border:1px solid #e1e2e4;border-radius:50%;background:#fff;color:#171717;font-size:1.35rem;cursor:pointer}.auth-kicker{margin:0 0 10px;color:#9a6700;font-size:.72rem;font-weight:900;letter-spacing:.12em;text-transform:uppercase}.auth-panel h2{margin:0;letter-spacing:-.055em;font-size:clamp(1.8rem,5vw,2.55rem);line-height:1}.auth-panel p{color:#7b7e84;line-height:1.55}.auth-form{display:grid;gap:12px;margin-top:20px}.auth-form label{display:grid;gap:7px;color:#272727;font-size:.78rem;font-weight:850}.auth-form input,.auth-form select{width:100%;min-height:48px;padding:0 14px;border:1px solid #d9dade;border-radius:13px;background:#fff;color:#171717;font:inherit}.auth-form textarea{min-height:90px;padding:12px 14px;resize:vertical}.auth-form input:focus,.auth-form select:focus,.auth-form textarea:focus{outline:3px solid rgba(255,184,21,.38);border-color:#ffb815}.auth-submit{min-height:48px;border:0;border-radius:14px;background:#ffb815;color:#171717;font:inherit;font-weight:950;cursor:pointer;box-shadow:0 4px 0 #d18b00}.auth-submit:disabled{cursor:wait;opacity:.6}.auth-divider{display:flex;align-items:center;gap:10px;margin:20px 0;color:#a4a6aa;font-size:.74rem}.auth-divider:before,.auth-divider:after{content:"";height:1px;flex:1;background:#e7e8e9}.auth-socials{display:grid;grid-template-columns:1fr 1fr;gap:10px}.auth-social{min-height:46px;border:1px solid #d9dade;border-radius:13px;background:#fff;color:#171717;font:inherit;font-weight:850;cursor:pointer}.auth-social:hover{background:#f5f5f6}.auth-status{min-height:22px;margin:12px 0 0!important;font-size:.8rem}.auth-status[data-kind=error]{color:#a0281e}.auth-status[data-kind=success]{color:#3f6d27}.auth-note{margin-top:18px;font-size:.72rem;color:#999ca2!important}.auth-legal{display:flex;align-items:flex-start;gap:8px;margin-top:4px;color:#666a70;font-size:.77rem;font-weight:600}.auth-legal input{width:18px;height:18px;min-height:18px;margin-top:1px;accent-color:#ffb815}.auth-trigger{min-height:40px!important}.auth-user-badge{max-width:170px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}@media(max-width:600px){.auth-backdrop{padding:10px}.auth-panel{padding:24px 20px;border-radius:24px}.auth-socials{grid-template-columns:1fr}.auth-user-badge{max-width:110px}}
`;

function addStyles() {
  if (document.getElementById("pawprint-auth-styles")) return;
  const style = document.createElement("style");
  style.id = "pawprint-auth-styles";
  style.textContent = styles;
  document.head.appendChild(style);
}

let client = null;
let authConfig = null;
let modal = null;
let statusNode = null;

function setStatus(message, kind = "") {
  if (!statusNode) return;
  statusNode.textContent = message || "";
  statusNode.dataset.kind = kind;
}

function authMarkup() {
  const configured = Boolean(client);
  return `<button class="auth-close" type="button" data-close-auth aria-label="Close sign in">×</button>
    <p class="auth-kicker">Private by default</p><h2>Sign in to Pawprint.</h2>
    <p>Use a magic link. No password to remember, and your provider profile is not copied into your Pawprint profile.</p>
    <form class="auth-form" id="pawprintMagicLinkForm">
      <label for="pawprintAuthEmail">Email address<input id="pawprintAuthEmail" name="email" type="email" autocomplete="email" placeholder="you@example.com" required></label>
      <button class="auth-submit" type="submit" ${configured ? "" : "disabled"}>Send magic link</button>
    </form>
    <div class="auth-divider"><span>or continue with</span></div>
    <div class="auth-socials"><button class="auth-social" type="button" data-auth-provider="google" ${configured ? "" : "disabled"}>Google</button><button class="auth-social" type="button" data-auth-provider="apple" ${configured ? "" : "disabled"}>Apple</button></div>
    <p class="auth-status" id="pawprintAuthStatus" role="status" aria-live="polite">${configured ? "" : "Supabase Auth is not configured for this preview yet."}</p>
    <p class="auth-note">Pawprint stores only your chosen nickname, avatar, and age group in your public profile. Email stays with Supabase Auth.</p>`;
}

function onboardingMarkup() {
  return `<button class="auth-close" type="button" data-close-auth aria-label="Close onboarding">×</button>
    <p class="auth-kicker">One small setup</p><h2>Make your Pawprint yours.</h2>
    <p>Choose what the community sees. We will not import your Google or Apple name or photo automatically.</p>
    <form class="auth-form" id="pawprintOnboardingForm">
      <label for="pawprintNickname">Nickname<input id="pawprintNickname" name="nickname" maxlength="40" autocomplete="nickname" required placeholder="e.g. Alley Scout"></label>
      <label for="pawprintAvatar">Avatar URL <span style="font-weight:500;color:#999ca2">optional</span><input id="pawprintAvatar" name="avatar" type="url" placeholder="https://…"></label>
      <label for="pawprintAgeGroup">Age group<select id="pawprintAgeGroup" name="ageGroup" required><option value="" selected disabled>Select one</option><option value="13_17">13–17</option><option value="18_24">18–24</option><option value="25_34">25–34</option><option value="35_44">35–44</option><option value="45_plus">45+</option><option value="prefer_not_to_say">Prefer not to say</option></select></label>
      <label class="auth-legal"><input id="pawprintAgeConfirm" type="checkbox" required><span>I confirm that I meet Pawprint's minimum age requirement and will use the app safely.</span></label>
      <button class="auth-submit" type="submit">Save my profile</button>
    </form><p class="auth-status" id="pawprintAuthStatus" role="status" aria-live="polite"></p>`;
}

function openAuth(mode = "auth") {
  if (!modal) return;
  modal.innerHTML = `<div class="auth-panel" role="dialog" aria-modal="true" aria-labelledby="pawprintAuthTitle">${mode === "onboarding" ? onboardingMarkup() : authMarkup()}</div>`;
  modal.classList.add("is-open");
  modal.dataset.mode = mode;
  statusNode = modal.querySelector("#pawprintAuthStatus");
  if (mode === "onboarding") modal.querySelector("#pawprintNickname")?.focus();
  else modal.querySelector("#pawprintAuthEmail")?.focus();
}

function closeAuth() { modal?.classList.remove("is-open"); }

function addTriggers() {
  const buttons = document.querySelectorAll(".app-header-actions, .nav-actions");
  buttons.forEach((actions) => {
    if (actions.querySelector("[data-pawprint-auth-trigger]")) return;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "btn btn-light btn-small auth-trigger";
    button.dataset.pawprintAuthTrigger = "1";
    button.dataset.openAuth = "1";
    button.textContent = "Sign in";
    actions.prepend(button);
  });
}

function updateTriggers() {
  const user = window.pawprintSession?.user;
  document.querySelectorAll("[data-pawprint-auth-trigger]").forEach((button) => {
    button.textContent = user ? "Sign out" : "Sign in";
    button.classList.toggle("auth-user-badge", Boolean(user));
    button.dataset.openAuth = user ? "" : "1";
    button.title = user ? "Sign out" : "Sign in";
  });
}

async function loadProfile() {
  if (!client || !window.pawprintSession?.user) return null;
  const result = await client.from("profiles").select("id,nickname,avatar,age_group").eq("id", window.pawprintSession.user.id).maybeSingle();
  if (result.error) {
    if (/relation .*profiles.* does not exist/i.test(result.error.message || "")) return { missingTable: true };
    return { error: result.error.message };
  }
  return result.data;
}

async function finishOnboarding() {
  const profile = await loadProfile();
  if (!profile || profile.missingTable || profile.error || !profile.nickname) openAuth("onboarding");
}

async function handleMagicLink(event) {
  event.preventDefault();
  if (!client) return setStatus("Supabase Auth is not configured for this preview yet.", "error");
  const email = new FormData(event.currentTarget).get("email");
  const redirectTo = `${location.origin}/auth/callback`;
  const result = await client.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo } });
  if (result.error) return setStatus(result.error.message, "error");
  setStatus("Magic link sent. Check your inbox, then return here to continue.", "success");
  event.currentTarget.reset();
}

async function handleProvider(provider) {
  if (!client) return setStatus("Supabase Auth is not configured for this preview yet.", "error");
  const result = await client.auth.signInWithOAuth({ provider, options: { redirectTo: `${location.origin}/auth/callback` } });
  if (result.error) setStatus(result.error.message, "error");
}

async function handleOnboarding(event) {
  event.preventDefault();
  if (!client || !window.pawprintSession?.user) return setStatus("Your session is not ready yet. Please sign in again.", "error");
  const form = event.currentTarget;
  const values = new FormData(form);
  const nickname = String(values.get("nickname") || "").trim();
  const ageGroup = String(values.get("ageGroup") || "");
  const avatar = String(values.get("avatar") || "").trim() || null;
  const result = await client.from("profiles").upsert({ id: window.pawprintSession.user.id, nickname, avatar, age_group: ageGroup }, { onConflict: "id" });
  if (result.error) return setStatus("Profile setup is not ready yet. Apply docs/supabase-auth.sql in Supabase, then try again.", "error");
  closeAuth();
  window.notify?.("Profile ready. Welcome to Pawprint.");
  updateTriggers();
}

async function handleSignOut() {
  if (!client) return;
  await client.auth.signOut();
  window.pawprintSession = null;
  updateTriggers();
  window.notify?.("Signed out.");
}

function bindModal() {
  modal.addEventListener("click", async (event) => {
    if (event.target === modal || event.target.closest("[data-close-auth]")) return closeAuth();
    const provider = event.target.closest("[data-auth-provider]")?.dataset.authProvider;
    if (provider) return handleProvider(provider);
    if (event.target.closest("[data-open-auth]") && window.pawprintSession) return handleSignOut();
  });
  modal.addEventListener("submit", (event) => {
    if (event.target.id === "pawprintMagicLinkForm") handleMagicLink(event);
    if (event.target.id === "pawprintOnboardingForm") handleOnboarding(event);
  });
}

function bindDocumentTriggers() {
  document.addEventListener("click", (event) => {
    const trigger = event.target.closest("[data-open-auth]");
    if (!trigger) return;
    event.preventDefault();
    if (window.pawprintSession) return handleSignOut();
    openAuth("auth");
  });
}

async function init() {
  addStyles();
  modal = document.createElement("div");
  modal.className = "auth-backdrop";
  modal.setAttribute("aria-hidden", "true");
  document.body.appendChild(modal);
  bindModal();
  bindDocumentTriggers();
  addTriggers();
  const result = await authReady.catch(() => ({ client: null, config: { enabled: false } }));
  client = result.client;
  authConfig = result.config;
  window.pawprintSupabase = client;
  window.pawprintAuthConfig = authConfig;
  const originalFetch = window.fetch;
  window.fetch = (input, init = {}) => {
    const requestUrl = typeof input === "string" ? input : input?.url || "";
    const sameOriginApi = requestUrl.startsWith("/api/") || requestUrl.startsWith(location.origin + "/api/");
    if (!sameOriginApi || !window.pawprintSession?.access_token) return originalFetch(input, init);
    const headers = new Headers(init.headers || (input instanceof Request ? input.headers : undefined));
    headers.set("Authorization", `Bearer ${window.pawprintSession.access_token}`);
    return originalFetch(input, { ...init, headers });
  };
  if (!client) return updateTriggers();
  const callbackCode = new URLSearchParams(location.search).get("code");
  if (location.pathname === "/auth/callback" && callbackCode) {
    const exchange = await client.auth.exchangeCodeForSession(callbackCode);
    if (exchange.error) openAuth("auth");
    history.replaceState({}, "", "/#app");
  }
  const sessionResult = await client.auth.getSession();
  window.pawprintSession = sessionResult.data.session;
  updateTriggers();
  if (window.pawprintSession) finishOnboarding();
  client.auth.onAuthStateChange((_event, session) => {
    window.pawprintSession = session;
    updateTriggers();
    if (session) finishOnboarding();
  });
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
else init();
