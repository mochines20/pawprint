const nativeFetch = window.fetch.bind(window);
const publicDemoOnly = () => window.PAWPRINT_PUBLIC_DEMO_ONLY === true;
let authConfigPromise = null;
let authClientPromise = null;
let authStateSubscription = null;
let authSessionChecked = false;
let authenticatedFetchInstalled = false;

function loadAuthConfig() {
  if (!authConfigPromise) {
    authConfigPromise = withTimeout(nativeFetch("/api/auth/config", { headers: { accept: "application/json" } }), 4000, "AUTH_CONFIG_TIMEOUT")
      .then((response) => {
        if (!response.ok) throw new Error("AUTH_CONFIG_UNAVAILABLE");
        return response.json();
      })
      .then((config) => {
        authConfig = config;
        window.pawprintAuthConfig = config;
        return config;
      })
      .catch((error) => {
        authConfigPromise = null;
        throw error;
      });
  }
  return authConfigPromise;
}

async function ensureAuthClient() {
  if (publicDemoOnly()) return null;
  const config = authConfig || await loadAuthConfig();
  if (!config?.enabled || !config.url || !config.anonKey) return null;
  if (client) return client;
  if (!authClientPromise) {
    authClientPromise = withTimeout(import("https://esm.sh/@supabase/supabase-js@2.57.4"), 8000, "AUTH_CLIENT_TIMEOUT")
      .then(({ createClient }) => {
        client = createClient(config.url, config.anonKey, { auth: { flowType: "pkce", detectSessionInUrl: false } });
        window.pawprintSupabase = client;
        installAuthenticatedFetch();
        return client;
      })
      .catch((error) => {
        authClientPromise = null;
        throw error;
      });
  }
  return authClientPromise;
}

window.pawprintAuthReady = ensureAuthClient;
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
  style.textContent = styles + authEnhancements + authAvatarDropdownEnhancements;
  document.head.appendChild(style);
}

let client = null;
let authConfig = null;
let modal = null;
let statusNode = null;
window.pawprintAuthGate = window.pawprintAuthGate || { ready: false, queue: [] };
window.pawprintOpenAuth = (accountMode = "login") => {
  if (publicDemoOnly()) {
    window.notify?.("Sign-in is coming in a future release. Explore the demo for now.");
    return false;
  }
  return openAuth("auth", accountMode);
};

function releaseAuthGate() {
  if (window.pawprintAuthGate.ready) return;
  window.pawprintAuthGate.ready = true;
  const queued = window.pawprintAuthGate.queue.splice(0);
  queued.forEach((callback) => callback());
}

const authEnhancements = `
.auth-password-wrap{position:relative;display:flex;align-items:center}.auth-password-wrap input{padding-right:70px}.auth-password-toggle{position:absolute;right:8px;min-height:32px;padding:0 9px;border:1px solid #dedfe2;border-radius:9px;background:#f7f7f8;color:#555960;font:inherit;font-size:.7rem;font-weight:850;cursor:pointer}.auth-password-toggle:hover{background:#fff;color:#171717}.auth-mode-links{display:flex;justify-content:space-between;gap:12px;margin-top:14px;color:#85888e;font-size:.74rem}.auth-link{padding:0;border:0;background:transparent;color:#6e4b00;font:inherit;font-weight:850;text-decoration:underline;text-underline-offset:3px;cursor:pointer}.auth-link:hover{color:#171717}.auth-avatar-picker{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px;margin-top:2px}.auth-avatar-option{display:grid;place-items:center;gap:6px;min-height:92px;padding:9px 6px;border:1px solid #dedfe2;border-radius:16px;background:#fff;color:#777b82;font:inherit;font-size:.67rem;font-weight:850;cursor:pointer;transition:transform .18s ease,border-color .18s ease,background .18s ease,box-shadow .18s ease}.auth-avatar-option:hover{transform:translateY(-2px);border-color:#b9bbc0}.auth-avatar-option[aria-pressed=true]{border-color:#171717;background:#fff8e7;color:#171717;box-shadow:inset 0 0 0 2px #ffb815}.auth-avatar-option svg{width:54px;height:54px;display:block}.auth-privacy{margin-top:2px;padding:12px 14px;border:1px solid #e3e4e6;border-radius:14px;background:#fafafa;color:#6f7379;font-size:.72rem;line-height:1.45}.auth-privacy summary{cursor:pointer;color:#171717;font-weight:900}.auth-privacy ul{display:grid;gap:6px;margin:9px 0 0;padding-left:18px}.auth-privacy p{margin:10px 0 0;font-size:.7rem}.auth-privacy a{color:#6e4b00;font-weight:850}
`;

const authAvatarDropdownEnhancements = `
.auth-avatar-dropdown{margin-top:2px;border:1px solid #dedfe2;border-radius:16px;background:#fff;overflow:hidden}.auth-avatar-dropdown>summary{display:flex;align-items:center;justify-content:space-between;gap:10px;min-height:48px;padding:8px 12px;cursor:pointer;list-style:none;color:#555960;font-size:.76rem;font-weight:850}.auth-avatar-dropdown>summary::-webkit-details-marker{display:none}.auth-avatar-dropdown>summary:after{content:'⌄';font-size:1rem;color:#8c9096;transition:transform .2s ease}.auth-avatar-dropdown[open]>summary:after{transform:rotate(180deg)}.auth-avatar-dropdown>summary:focus-visible{outline:3px solid #ffb815;outline-offset:-3px}.auth-avatar-selected{display:flex;align-items:center;gap:9px;min-width:0}.auth-avatar-selected svg{width:34px;height:34px;flex:0 0 34px}.auth-avatar-selected span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.auth-avatar-dropdown .auth-avatar-picker{grid-template-columns:repeat(4,minmax(0,1fr));max-height:0;margin:0;padding:0 10px;overflow:hidden;opacity:0;transform:translateY(-6px);transition:max-height .32s ease,padding .32s ease,opacity .22s ease,transform .32s ease}.auth-avatar-dropdown[open] .auth-avatar-picker{max-height:min(560px,65vh);padding:10px;overflow-y:auto;opacity:1;transform:translateY(0);scrollbar-width:thin}.auth-avatar-dropdown .auth-avatar-option{min-height:82px;padding:7px 4px}.auth-avatar-dropdown .auth-avatar-option svg{width:46px;height:46px}.auth-avatar-dropdown .auth-avatar-option:active{transform:scale(.96)}
@media(max-width:420px){.auth-avatar-dropdown .auth-avatar-picker{grid-template-columns:repeat(3,minmax(0,1fr))}.auth-avatar-dropdown[open] .auth-avatar-picker{max-height:560px}}
`;

const catAvatars = [
  { id: "cat-ink", label: "Ink", svg: `<svg viewBox="0 0 80 80" role="img" aria-label="Ink cat"><path d="M17 31 16 11l18 12c4-2 8-3 12-3s8 1 12 3L76 11l-1 20c3 5 4 10 4 16 0 17-13 29-33 29S13 63 13 46c0-6 1-11 4-15Z" fill="#171717"/><circle cx="31" cy="45" r="5" fill="#fff"/><circle cx="57" cy="45" r="5" fill="#fff"/><path d="M34 57c4 5 8 5 12 0 4 5 8 5 12 0" fill="none" stroke="#ffb815" stroke-width="3.5" stroke-linecap="round"/><path d="M19 28 18 16l11 8M61 24l11-8-1 12" fill="none" stroke="#ffb815" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>` },
  { id: "cat-scribble", label: "Scribble", svg: `<svg viewBox="0 0 80 80" role="img" aria-label="Scribble cat"><path d="M17 34 16 13l18 12c4-2 8-3 12-3s8 1 12 3l18-12-1 22c3 4 4 8 4 13 0 15-14 25-33 25S13 63 13 48c0-5 1-10 4-14Z" fill="#fff" stroke="#171717" stroke-width="4" stroke-linejoin="round"/><circle cx="31" cy="45" r="4" fill="#ffb815"/><circle cx="57" cy="45" r="4" fill="#ffb815"/><path d="M36 57c3 3 5 3 8 0 3 3 5 3 8 0M9 50l10-2M9 58l10-1M71 48l10 2M71 57l10 1" fill="none" stroke="#171717" stroke-width="2.5" stroke-linecap="round"/></svg>` },
  { id: "cat-orange", label: "Tangerine", svg: `<svg viewBox="0 0 80 80" role="img" aria-label="Orange cat"><path d="M16 32 15 12l18 12c4-2 8-3 13-3s9 1 13 3l18-12-1 20c3 5 4 10 4 15 0 17-14 28-34 28S12 64 12 47c0-5 1-10 4-15Z" fill="#171717"/><path d="M18 29 17 16l12 9M62 25l12-9-1 13" fill="none" stroke="#ffb815" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><circle cx="31" cy="45" r="5" fill="#ffb815"/><circle cx="57" cy="45" r="5" fill="#ffb815"/><path d="M36 57c4 4 8 4 12 0 4 4 8 4 12 0" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"/></svg>` },
  { id: "cat-round", label: "Roundie", svg: `<svg viewBox="0 0 80 80" role="img" aria-label="Round cat"><path d="M18 34 17 15l17 10c4-2 8-3 13-3s9 1 13 3l17-10-1 20c3 4 4 9 4 14 0 15-14 25-33 25S14 63 14 48c0-5 1-10 4-14Z" fill="#171717"/><circle cx="31" cy="45" r="7" fill="#fff"/><circle cx="57" cy="45" r="7" fill="#fff"/><circle cx="31" cy="45" r="2.5" fill="#ffb815"/><circle cx="57" cy="45" r="2.5" fill="#ffb815"/><path d="M36 58c4 4 8 4 12 0 4 4 8 4 12 0M18 52l-9 2M18 59l-9 2M70 52l9 2M70 59l9 2" fill="none" stroke="#ffb815" stroke-width="2.5" stroke-linecap="round"/></svg>` },
  { id: "cat-siamese", label: "Siamese", svg: `<svg viewBox="0 0 80 80" role="img" aria-label="Siamese cat"><path d="M16 30 18 10l16 14c4-2 8-3 12-3s8 1 12 3L74 10l2 20c3 5 4 10 4 16 0 17-14 28-34 28S12 63 12 46c0-6 1-11 4-16Z" fill="#f3e5cc" stroke="#171717" stroke-width="3"/><path d="M18 29 20 14l12 11M62 25l12-11 2 15" fill="#6f594c" stroke="#171717" stroke-width="2"/><path d="M25 37c5-5 11-5 16-1v15c-6 4-12 3-17-2ZM55 36c5-4 11-4 16 1l1 13c-5 5-11 6-17 2Z" fill="#6f594c"/><circle cx="34" cy="45" r="3.5" fill="#7fc7d9"/><circle cx="58" cy="45" r="3.5" fill="#7fc7d9"/><path d="M36 58c4 3 8 3 12 0" fill="none" stroke="#171717" stroke-width="2.5" stroke-linecap="round"/></svg>` },
  { id: "cat-tuxedo", label: "Tuxedo", svg: `<svg viewBox="0 0 80 80" role="img" aria-label="Tuxedo cat"><path d="M17 31 16 11l18 12c4-2 8-3 12-3s8 1 12 3L76 11l-1 20c3 5 4 10 4 16 0 17-13 29-33 29S13 63 13 46c0-6 1-11 4-15Z" fill="#171717" stroke="#171717" stroke-width="3"/><path d="M29 51c5 1 7 6 11 11l-4 10H44l-4-10c4-5 6-10 11-11 5 1 7 6 11 11l-4 10h8l-4-16c-2-8-7-13-15-13s-13 5-15 13l-4 16h8l-4-10c4-5 6-10 11-11Z" fill="#fff"/><circle cx="31" cy="42" r="4" fill="#fff"/><circle cx="57" cy="42" r="4" fill="#fff"/><path d="M36 58c4 4 8 4 12 0" fill="none" stroke="#ffb815" stroke-width="3" stroke-linecap="round"/></svg>` },
  { id: "cat-tabby", label: "Tabby", svg: `<svg viewBox="0 0 80 80" role="img" aria-label="Tabby cat"><path d="M17 32 16 12l18 12c4-2 8-3 12-3s8 1 12 3l18-12-1 20c3 5 4 10 4 15 0 17-14 28-34 28S12 64 12 47c0-5 1-10 5-15Z" fill="#a9a6a0" stroke="#171717" stroke-width="3"/><path d="M36 23l4 14M44 23l-4 14M52 25l-5 13M22 34l8 4M58 34l-8 4" fill="none" stroke="#5a5551" stroke-width="3" stroke-linecap="round"/><circle cx="31" cy="46" r="4.5" fill="#ffb815"/><circle cx="57" cy="46" r="4.5" fill="#ffb815"/><path d="M36 58c4 3 8 3 12 0M17 54l-8 2M17 61l-8 2M71 54l8 2M71 61l8 2" fill="none" stroke="#171717" stroke-width="2.5" stroke-linecap="round"/></svg>` },
  { id: "cat-calico", label: "Calico", svg: `<svg viewBox="0 0 80 80" role="img" aria-label="Calico cat"><path d="M17 31 16 11l18 12c4-2 8-3 12-3s8 1 12 3L76 11l-1 20c3 5 4 10 4 16 0 17-13 29-33 29S13 63 13 46c0-6 1-11 4-15Z" fill="#fff" stroke="#171717" stroke-width="3"/><path d="M17 31 18 15l12 9-3 13Z" fill="#171717"/><path d="M59 27 74 14l-1 18-11 8Z" fill="#ff8b21"/><path d="M25 57c3-5 7-7 12-5l-3 13c-5-1-8-3-9-8Z" fill="#ff8b21"/><circle cx="31" cy="45" r="4.5" fill="#171717"/><circle cx="57" cy="45" r="4.5" fill="#171717"/><path d="M36 58c4 4 8 4 12 0 4 4 8 4 12 0" fill="none" stroke="#171717" stroke-width="2.8" stroke-linecap="round"/></svg>` },
  { id: "cat-maine", label: "Maine Coon", svg: `<svg viewBox="0 0 80 80" role="img" aria-label="Maine Coon cat"><path d="M15 34 12 6l20 18c4-2 8-3 13-3s9 1 13 3L78 6l-3 28c2 4 3 8 3 13 0 17-14 28-36 28S6 64 6 47c0-5 3-9 9-13Z" fill="#6e7478" stroke="#171717" stroke-width="3" stroke-linejoin="round"/><path d="M19 28 16 12l13 13M61 25l13-13-3 18" fill="none" stroke="#ffb815" stroke-width="3" stroke-linecap="round"/><circle cx="31" cy="45" r="4.5" fill="#ffb815"/><circle cx="57" cy="45" r="4.5" fill="#ffb815"/><path d="M36 58c4 4 8 4 12 0 4 4 8 4 12 0M18 52l-10 2M18 59l-10 2M70 52l10 2M70 59l10 2" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/></svg>` },
  { id: "cat-fold", label: "Fold", svg: `<svg viewBox="0 0 80 80" role="img" aria-label="Fold cat"><path d="M18 33 24 16l10 9c4-2 8-3 12-3s8 1 12 3l10-9 6 17c3 4 4 9 4 14 0 16-14 27-35 27S8 63 8 47c0-5 4-10 10-14Z" fill="#b8b4b0" stroke="#171717" stroke-width="3" stroke-linejoin="round"/><path d="M25 18l9 8M55 26l9-8" fill="none" stroke="#171717" stroke-width="3" stroke-linecap="round"/><circle cx="31" cy="46" r="4.5" fill="#171717"/><circle cx="57" cy="46" r="4.5" fill="#171717"/><path d="M36 58c4 4 8 4 12 0M20 53l-10 2M20 60l-10 2M68 53l10 2M68 60l10 2" fill="none" stroke="#ffb815" stroke-width="2.5" stroke-linecap="round"/></svg>` },
  { id: "cat-bengal", label: "Bengal", svg: `<svg viewBox="0 0 80 80" role="img" aria-label="Bengal cat"><path d="M17 31 16 11l18 12c4-2 8-3 12-3s8 1 12 3L76 11l-1 20c3 5 4 10 4 16 0 17-13 29-33 29S13 63 13 46c0-6 1-11 4-15Z" fill="#d9a447" stroke="#171717" stroke-width="3"/><path d="M23 34c2-3 5-3 7 0M50 35c2-3 5-3 7 0M25 57c2-3 5-3 7 0M51 57c2-3 5-3 7 0M42 29v7" fill="none" stroke="#171717" stroke-width="3" stroke-linecap="round"/><circle cx="31" cy="45" r="4.5" fill="#171717"/><circle cx="57" cy="45" r="4.5" fill="#171717"/><path d="M36 58c4 4 8 4 12 0" fill="none" stroke="#171717" stroke-width="2.8" stroke-linecap="round"/></svg>` },
  { id: "cat-sphynx", label: "Sphynx", svg: `<svg viewBox="0 0 80 80" role="img" aria-label="Sphynx cat"><path d="M15 33 16 8l17 18c4-2 8-3 12-3s8 1 12 3L74 8l1 25c3 4 4 9 4 14 0 16-14 27-34 27S11 63 11 47c0-5 1-10 4-14Z" fill="#dcae9d" stroke="#171717" stroke-width="3" stroke-linejoin="round"/><path d="M22 35c7-4 13-4 20 0M38 46c-5 3-5 8 0 11M58 35c-7-4-13-4-20 0M42 46c5 3 5 8 0 11" fill="none" stroke="#9b6b68" stroke-width="2" stroke-linecap="round"/><circle cx="31" cy="43" r="4" fill="#ffb815"/><circle cx="57" cy="43" r="4" fill="#ffb815"/><path d="M36 58c4 3 8 3 12 0M18 53l-9 2M18 60l-9 2M70 53l9 2M70 60l9 2" fill="none" stroke="#171717" stroke-width="2.5" stroke-linecap="round"/></svg>` },
  { id: "cat-blackwhite", label: "Moo", svg: `<svg viewBox="0 0 80 80" role="img" aria-label="Black and white cat"><path d="M17 32 16 12l18 12c4-2 8-3 12-3s8 1 12 3l18-12-1 20c3 5 4 10 4 15 0 17-14 28-34 28S12 64 12 47c0-5 1-10 5-15Z" fill="#fff" stroke="#171717" stroke-width="3"/><path d="M17 31 17 15l13 10-2 13ZM57 30l13-13 4 15-10 8Z" fill="#171717"/><path d="M30 55c4-3 8-3 12 1 4-4 8-4 12-1" fill="none" stroke="#171717" stroke-width="4" stroke-linecap="round"/><circle cx="31" cy="45" r="4" fill="#ffb815"/><circle cx="57" cy="45" r="4" fill="#ffb815"/></svg>` },
  { id: "cat-bobtail", label: "Bobtail", svg: `<svg viewBox="0 0 80 80" role="img" aria-label="Bobtail cat"><path d="M17 32 16 12l18 12c4-2 8-3 12-3s8 1 12 3l18-12-1 20c3 5 4 10 4 15 0 17-14 28-34 28S12 64 12 47c0-5 1-10 5-15Z" fill="#8b6d5c" stroke="#171717" stroke-width="3"/><path d="M21 32c4 3 7 6 8 10M59 30c-4 3-7 6-8 10" fill="none" stroke="#d6a77c" stroke-width="3" stroke-linecap="round"/><circle cx="31" cy="45" r="4.5" fill="#fff"/><circle cx="57" cy="45" r="4.5" fill="#fff"/><path d="M36 58c4 4 8 4 12 0 4 4 8 4 12 0M19 53l-9 2M19 60l-9 2M69 53l9 2M69 60l9 2" fill="none" stroke="#ffb815" stroke-width="2.5" stroke-linecap="round"/></svg>` },
  { id: "cat-persian", label: "Persian", svg: `<svg viewBox="0 0 80 80" role="img" aria-label="Persian cat"><path d="M18 32 17 13l17 11c4-2 8-3 12-3s8 1 12 3l17-11-1 19c4 5 5 10 5 16 0 18-14 29-34 29S12 64 12 47c0-6 2-11 6-15Z" fill="#efe5d5" stroke="#171717" stroke-width="3"/><path d="M19 29 19 18l12 8M61 26l12-8-1 12" fill="none" stroke="#c2a88a" stroke-width="3" stroke-linecap="round"/><path d="M23 50c4 8 10 12 17 12s13-4 17-12" fill="none" stroke="#c2a88a" stroke-width="3" stroke-linecap="round"/><circle cx="31" cy="44" r="4" fill="#709ab2"/><circle cx="57" cy="44" r="4" fill="#709ab2"/><path d="M36 57c4 3 8 3 12 0" fill="none" stroke="#171717" stroke-width="2.5" stroke-linecap="round"/></svg>` },
  { id: "cat-ragdoll", label: "Ragdoll", svg: `<svg viewBox="0 0 80 80" role="img" aria-label="Ragdoll cat"><path d="M16 31 17 11l17 14c4-2 8-3 12-3s8 1 12 3l17-14 1 20c3 5 4 10 4 15 0 17-14 28-34 28S12 63 12 46c0-5 1-10 4-15Z" fill="#f0dfc5" stroke="#171717" stroke-width="3"/><path d="M20 27 19 15l13 11M60 26l13-11-1 14" fill="#806554" stroke="#171717" stroke-width="2"/><path d="M24 37c5-5 11-5 16-1v14c-6 4-12 3-17-2ZM56 36c5-4 11-4 16 1l1 13c-5 5-11 6-17 2Z" fill="#806554"/><circle cx="34" cy="44" r="3.5" fill="#7dc9d9"/><circle cx="58" cy="44" r="3.5" fill="#7dc9d9"/><path d="M36 58c4 3 8 3 12 0" fill="none" stroke="#171717" stroke-width="2.5" stroke-linecap="round"/></svg>` },
  { id: "cat-british", label: "British Shorthair", svg: `<svg viewBox="0 0 80 80" role="img" aria-label="British Shorthair cat"><path d="M17 31 17 12l17 12c4-2 8-3 12-3s8 1 12 3l17-12-1 20c4 5 5 10 5 16 0 18-14 29-34 29S12 64 12 47c0-6 2-11 5-16Z" fill="#8c929a" stroke="#171717" stroke-width="3"/><path d="M23 31c4-3 9-4 13-3M57 28c4-1 9 0 13 3" fill="none" stroke="#6d737c" stroke-width="3" stroke-linecap="round"/><circle cx="31" cy="45" r="4.5" fill="#d9bd56"/><circle cx="57" cy="45" r="4.5" fill="#d9bd56"/><path d="M36 58c4 4 8 4 12 0M18 53l-9 2M18 60l-9 2M70 53l9 2M70 60l9 2" fill="none" stroke="#171717" stroke-width="2.5" stroke-linecap="round"/></svg>` },
  { id: "cat-tortoiseshell", label: "Tortie", svg: `<svg viewBox="0 0 80 80" role="img" aria-label="Tortoiseshell cat"><path d="M17 31 16 11l18 12c4-2 8-3 12-3s8 1 12 3L76 11l-1 20c3 5 4 10 4 16 0 17-13 29-33 29S13 63 13 46c0-6 1-11 4-15Z" fill="#342b2a" stroke="#171717" stroke-width="3"/><path d="M18 27 19 15l12 9-5 10ZM57 25l13-10-1 16-10 8ZM24 56l10-6 5 13-9 4Z" fill="#d48335"/><path d="M45 58l8-10 10 7-7 11Z" fill="#d6b24c"/><circle cx="31" cy="44" r="4.5" fill="#ffb815"/><circle cx="57" cy="44" r="4.5" fill="#ffb815"/><path d="M36 58c4 4 8 4 12 0 4 4 8 4 12 0" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/></svg>` },
  { id: "cat-russian-blue", label: "Russian Blue", svg: `<svg viewBox="0 0 80 80" role="img" aria-label="Russian Blue cat"><path d="M16 31 17 9l17 16c4-2 8-3 12-3s8 1 12 3L75 9l1 22c3 5 4 10 4 15 0 17-14 28-34 28S12 63 12 46c0-5 1-10 4-15Z" fill="#75838c" stroke="#171717" stroke-width="3"/><path d="M19 27 20 14l11 12M61 26l11-12 1 14" fill="none" stroke="#aebbc1" stroke-width="3" stroke-linecap="round"/><circle cx="31" cy="45" r="4.5" fill="#b2cf85"/><circle cx="57" cy="45" r="4.5" fill="#b2cf85"/><path d="M36 58c4 3 8 3 12 0M18 53l-9 2M18 60l-9 2M70 53l9 2M70 60l9 2" fill="none" stroke="#171717" stroke-width="2.5" stroke-linecap="round"/></svg>` },
  { id: "cat-angora", label: "Angora", svg: `<svg viewBox="0 0 80 80" role="img" aria-label="Turkish Angora cat"><path d="M16 31 17 7l17 19c4-2 8-3 12-3s8 1 12 3L75 7l1 24c3 5 4 10 4 15 0 17-14 28-34 28S12 63 12 46c0-5 1-10 4-15Z" fill="#fff" stroke="#171717" stroke-width="3"/><path d="M20 25 20 13l11 14M60 27l11-14v13" fill="none" stroke="#d4d6d8" stroke-width="3" stroke-linecap="round"/><circle cx="31" cy="44" r="4.5" fill="#6cb9d0"/><circle cx="57" cy="44" r="4.5" fill="#c88947"/><path d="M36 58c4 4 8 4 12 0M18 53l-10 2M18 60l-10 2M70 53l10 2M70 60l10 2" fill="none" stroke="#171717" stroke-width="2.5" stroke-linecap="round"/></svg>` },
  { id: "cat-norwegian", label: "Norwegian", svg: `<svg viewBox="0 0 80 80" role="img" aria-label="Norwegian Forest cat"><path d="M15 33 12 6l20 18c4-2 8-3 13-3s9 1 13 3L78 6l-3 27c3 4 5 9 5 15 0 18-14 29-36 29S8 65 8 48c0-6 2-11 7-15Z" fill="#b9b0a8" stroke="#171717" stroke-width="3" stroke-linejoin="round"/><path d="M19 29 16 12l13 14M61 26l13-14-3 18" fill="none" stroke="#81756f" stroke-width="3" stroke-linecap="round"/><path d="M25 53c3 8 8 13 15 13s12-5 15-13" fill="none" stroke="#81756f" stroke-width="4" stroke-linecap="round"/><circle cx="31" cy="44" r="4.5" fill="#ffb815"/><circle cx="57" cy="44" r="4.5" fill="#ffb815"/><path d="M36 58c4 4 8 4 12 0M18 52l-10 2M18 60l-10 2M70 52l10 2M70 60l10 2" fill="none" stroke="#171717" stroke-width="2.5" stroke-linecap="round"/></svg>` },
  { id: "cat-munchkin", label: "Munchkin", svg: `<svg viewBox="0 0 80 80" role="img" aria-label="Munchkin cat"><path d="M18 32 17 14l17 10c4-2 8-3 12-3s8 1 12 3l17-10-1 19c3 5 4 10 4 15 0 16-14 27-34 27S12 63 12 47c0-5 2-10 6-15Z" fill="#d8b09a" stroke="#171717" stroke-width="3"/><path d="M23 30 21 18l11 9M59 27l11-9-2 13" fill="none" stroke="#a67b68" stroke-width="3" stroke-linecap="round"/><circle cx="31" cy="45" r="4.5" fill="#6f9eb3"/><circle cx="57" cy="45" r="4.5" fill="#6f9eb3"/><path d="M36 58c4 4 8 4 12 0M20 54l-8 2M20 61l-8 2M68 54l8 2M68 61l8 2" fill="none" stroke="#ffb815" stroke-width="2.5" stroke-linecap="round"/></svg>` },
];

function avatarChoicesMarkup(selected = "cat-ink") {
  return catAvatars.map((avatar) => `<button class="auth-avatar-option" type="button" data-avatar-choice="${avatar.id}" aria-pressed="${avatar.id === selected ? "true" : "false"}" aria-label="Choose ${avatar.label} cat avatar">${avatar.svg}<span>${avatar.label}</span></button>`).join("");
}

function selectedAvatarMarkup(selected = "cat-ink") {
  const avatar = catAvatars.find((item) => item.id === selected) || catAvatars[0];
  return `${avatar.svg}<span>${avatar.label}</span>`;
}

window.pawprintAvatarChoices = catAvatars.map(({ id, label }) => ({ id, label }));
window.pawprintAvatarMarkup = (id) => catAvatars.find((avatar) => avatar.id === id)?.svg || catAvatars[0].svg;
window.pawprintSavePublicProfile = async ({ nickname, avatar, ageGroup }) => {
  if (!client || !window.pawprintSession?.user) throw new Error("AUTH_REQUIRED");
  const result = await client.from("profiles").upsert({ id: window.pawprintSession.user.id, nickname, avatar, age_group: ageGroup }, { onConflict: "id" });
  if (result.error) throw new Error(result.error.message || "PROFILE_SAVE_FAILED");
  window.pawprintPublicProfile = { ...(window.pawprintPublicProfile || {}), id: window.pawprintSession.user.id, nickname, avatar, age_group: ageGroup };
  window.dispatchEvent(new CustomEvent("pawprint-profile-ready", { detail: window.pawprintPublicProfile }));
  return window.pawprintPublicProfile;
};

function setStatus(message, kind = "") {
  if (!statusNode) return;
  statusNode.textContent = message || "";
  statusNode.dataset.kind = kind;
}

function formFromEvent(event, selector) {
  const target = event?.target;
  const current = event?.currentTarget;
  const form = target?.closest?.(selector) || current?.closest?.(selector) || modal?.querySelector(selector);
  return form && form.tagName === "FORM" ? form : null;
}

function withTimeout(promise, milliseconds, message = "AUTH_TIMEOUT") {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = window.setTimeout(() => reject(new Error(message)), milliseconds);
  });
  return Promise.race([promise, timeout]).finally(() => window.clearTimeout(timer));
}

function authMarkup(accountMode = "login") {
  const configured = Boolean(client);
  const providers = authConfig?.providers || {};
  const googleEnabled = configured && providers.google === true;
  const appleEnabled = configured && providers.apple === true;
  if (accountMode === "reset") return `<button class="auth-close" type="button" data-close-auth aria-label="Close password reset">×</button>
    <p class="auth-kicker">Private by default</p><h2>Reset your password.</h2>
    <p>Supabase will send a secure reset link. Pawprint never stores your password.</p>
    <form class="auth-form" id="pawprintResetForm">
      <label for="pawprintAuthEmail">Email address<input id="pawprintAuthEmail" name="email" type="email" autocomplete="email" placeholder="you@example.com" required></label>
      <button class="auth-submit" type="submit" ${configured ? "" : "disabled"}>Send reset link</button>
    </form>
    <div class="auth-mode-links"><span>Remembered it?</span><button class="auth-link" type="button" data-auth-view="login">Back to log in</button></div>
    <p class="auth-status" id="pawprintAuthStatus" role="status" aria-live="polite">${configured ? "" : "Supabase Auth is not configured for this preview yet."}</p>`;
  if (accountMode === "reset-confirm") return `<button class="auth-close" type="button" data-close-auth aria-label="Close password reset">×</button>
    <p class="auth-kicker">One secure step</p><h2>Choose a new password.</h2>
    <p>Use at least 8 characters. Your password stays with Supabase Auth.</p>
    <form class="auth-form" id="pawprintResetConfirmForm">
      <label for="pawprintNewPassword">New password<div class="auth-password-wrap"><input id="pawprintNewPassword" name="password" type="password" minlength="8" autocomplete="new-password" required><button class="auth-password-toggle" type="button" data-toggle-password data-target="pawprintNewPassword" aria-label="View password">View</button></div></label>
      <label for="pawprintConfirmPassword">Confirm password<div class="auth-password-wrap"><input id="pawprintConfirmPassword" name="confirmPassword" type="password" minlength="8" autocomplete="new-password" required><button class="auth-password-toggle" type="button" data-toggle-password data-target="pawprintConfirmPassword" aria-label="View password">View</button></div></label>
      <button class="auth-submit" type="submit" ${configured ? "" : "disabled"}>Update password</button>
    </form><p class="auth-status" id="pawprintAuthStatus" role="status" aria-live="polite">${configured ? "" : "Supabase Auth is not configured for this preview yet."}</p>`;
  const isSignup = accountMode === "signup";
  return `<button class="auth-close" type="button" data-close-auth aria-label="Close sign in">×</button>
    <p class="auth-kicker">Private by default</p><h2>${isSignup ? "Create your Pawprint account." : "Sign in to Pawprint."}</h2>
    <p>${isSignup ? "Create an account with Supabase Auth to use the browser app and keep your Journal safe." : "Sign in before entering the browser app. Use a password, magic link, or a connected provider."}</p>
    <form class="auth-form" id="pawprintPasswordForm" data-auth-mode="${isSignup ? "signup" : "login"}">
      <label for="pawprintAuthEmail">Email address<input id="pawprintAuthEmail" name="email" type="email" autocomplete="email" placeholder="you@example.com" required></label>
      <label for="pawprintAuthPassword">Password<div class="auth-password-wrap"><input id="pawprintAuthPassword" name="password" type="password" minlength="8" autocomplete="${isSignup ? "new-password" : "current-password"}" required><button class="auth-password-toggle" type="button" data-toggle-password data-target="pawprintAuthPassword" aria-label="View password">View</button></div></label>
      ${isSignup ? `<label for="pawprintConfirmPassword">Confirm password<div class="auth-password-wrap"><input id="pawprintConfirmPassword" name="confirmPassword" type="password" minlength="8" autocomplete="new-password" required><button class="auth-password-toggle" type="button" data-toggle-password data-target="pawprintConfirmPassword" aria-label="View password">View</button></div></label>` : ""}
      <button class="auth-submit" type="submit" ${configured ? "" : "disabled"}>${isSignup ? "Create account" : "Log in"}</button>
    </form>
    <div class="auth-mode-links"><span>${isSignup ? "Already have an account?" : "New to Pawprint?"} <button class="auth-link" type="button" data-auth-view="${isSignup ? "login" : "signup"}">${isSignup ? "Log in" : "Sign up"}</button></span>${isSignup ? "" : `<button class="auth-link" type="button" data-auth-view="reset">Forgot password?</button>`}</div>
    <div class="auth-divider"><span>or continue with</span></div>
    <form class="auth-form" id="pawprintMagicLinkForm" style="margin-top:0">
      <input id="pawprintMagicLinkEmail" name="email" type="email" autocomplete="email" placeholder="Email for a magic link" aria-label="Email for a magic link" required>
      <button class="auth-submit" type="submit" ${configured ? "" : "disabled"}>Send magic link</button>
    </form>
    <div class="auth-divider"><span>or continue with</span></div>
    <div class="auth-socials"><button class="auth-social" type="button" data-auth-provider="google" ${googleEnabled ? "" : "disabled"}>Google${googleEnabled ? "" : " · setup required"}</button><button class="auth-social" type="button" data-auth-provider="apple" ${appleEnabled ? "" : "disabled"}>Apple${appleEnabled ? "" : " · setup required"}</button></div>
    ${configured && (!googleEnabled || !appleEnabled) ? `<p class="auth-provider-note">Email login and magic links are ready. Google and Apple become available after their OAuth providers are configured in Supabase.</p>` : ""}
    <p class="auth-status" id="pawprintAuthStatus" role="status" aria-live="polite">${configured ? "" : "Supabase Auth is not configured for this preview yet."}</p>
    <p class="auth-note">Pawprint stores only your chosen nickname, avatar, and age group in your public profile. Email and passwords stay with Supabase Auth.</p>`;
}

function onboardingMarkup() {
  return `<button class="auth-close" type="button" data-close-auth aria-label="Close onboarding">×</button>
    <p class="auth-kicker">One small setup</p><h2>Make your Pawprint yours.</h2>
    <p>Choose what the community sees. We will not import your Google or Apple name or photo automatically.</p>
    <form class="auth-form" id="pawprintOnboardingForm">
      <label for="pawprintNickname">Nickname<input id="pawprintNickname" name="nickname" maxlength="40" autocomplete="nickname" required placeholder="e.g. Alley Scout"></label>
      <label>Cat avatar <span style="font-weight:500;color:#999ca2">Choose a sketch</span></label>
      <details class="auth-avatar-dropdown" data-avatar-dropdown>
        <summary aria-label="Open cat avatar choices"><span class="auth-avatar-selected" data-avatar-selected>${selectedAvatarMarkup()}</span><span>Choose another</span></summary>
        <div class="auth-avatar-picker" role="listbox" aria-label="Choose a custom cat avatar">${avatarChoicesMarkup()}</div>
      </details>
      <input id="pawprintAvatar" name="avatar" type="hidden" value="cat-ink">
      <label for="pawprintAgeGroup">Age group<select id="pawprintAgeGroup" name="ageGroup" required><option value="" selected disabled>Select one</option><option value="13_17">13–17</option><option value="18_24">18–24</option><option value="25_34">25–34</option><option value="35_44">35–44</option><option value="45_plus">45+</option><option value="prefer_not_to_say">Prefer not to say</option></select></label>
      <details class="auth-privacy"><summary>Privacy notice · Philippine Data Privacy Act of 2012 (RA 10173)</summary><ul><li>Your email and password stay with Supabase Auth. Pawprint stores only your chosen nickname, cat avatar, age group, and privacy-consent record for this profile.</li><li>Location is requested only when you start a cat capture and only after device permission. We do not silently track, edit, sell, or publicly reveal your exact location. Public pins use an approximate area, wait at least 5 minutes, and expire after 24 hours.</li><li>Photos are re-encoded before storage or sharing to remove GPS metadata. Do not upload people, private documents, or anything you do not have permission to share.</li><li>You may ask to access, correct, export, or delete your data, or withdraw consent where applicable. Some records may be retained when required for safety or law.</li></ul><p><a href="#privacy">Read the plain-language Privacy section</a> or contact Pawprint with a privacy concern.</p></details>
      <label class="auth-legal"><input id="pawprintAgeConfirm" type="checkbox" required><span>I confirm that I meet Pawprint's minimum age requirement and will use the app safely.</span></label>
      <label class="auth-legal"><input id="pawprintPrivacyConsent" name="privacyConsent" type="checkbox" value="yes" required><span>I have read this notice and consent to the described processing under RA 10173.</span></label>
      <button class="auth-submit" type="submit">Finish profile setup</button>
    </form><p class="auth-status" id="pawprintAuthStatus" role="status" aria-live="polite"></p>`;
}

async function openAuth(mode = "auth", accountMode = "login") {
  if (window.pawprintDemoMode && !document.body.classList.contains("demo-auth-open")) return;
  if (!modal) return;
  const requestId = Number(modal.dataset.openRequest || 0) + 1;
  modal.dataset.openRequest = String(requestId);
  const currentRequest = () => modal.dataset.openRequest === String(requestId) && modal.getAttribute("aria-hidden") === "false";
  modal.innerHTML = `<div class="auth-panel" role="dialog" aria-modal="true" aria-labelledby="pawprintAuthTitle"><button class="auth-close" type="button" data-close-auth aria-label="Close sign in">×</button><p class="auth-kicker">Private by default</p><h2 id="pawprintAuthTitle">Preparing secure sign-in…</h2><p role="status" aria-live="polite">Connecting to Pawprint Auth. This only happens when you open sign-in.</p></div>`;
  modal.classList.add("is-open");
  modal.setAttribute("aria-hidden", "false");
  modal.dataset.mode = mode;
  modal.dataset.accountMode = accountMode;
  try {
    await ensureAuthClient();
    if (!currentRequest()) return;
    if (client) await syncAuthSession();
    if (!currentRequest()) return;
    if (window.pawprintSession && mode !== "onboarding") {
      closeAuth();
      const ready = await finishOnboarding();
      if (ready) continuePendingApp();
      return;
    }
    modal.innerHTML = `<div class="auth-panel" role="dialog" aria-modal="true" aria-labelledby="pawprintAuthTitle">${mode === "onboarding" ? onboardingMarkup() : authMarkup(accountMode)}</div>`;
    statusNode = modal.querySelector("#pawprintAuthStatus");
    if (!client && authConfig?.enabled) setStatus("Secure sign-in could not connect. Check your connection and try again.", "error");
    if (!authConfig?.enabled) setStatus("Supabase Auth is not configured for this preview yet.", "error");
    if (mode === "onboarding") modal.querySelector("#pawprintNickname")?.focus();
    else modal.querySelector("#pawprintAuthEmail")?.focus();
  } catch (error) {
    if (!currentRequest()) return;
    modal.innerHTML = `<div class="auth-panel" role="dialog" aria-modal="true" aria-labelledby="pawprintAuthTitle">${mode === "onboarding" ? onboardingMarkup() : authMarkup(accountMode)}</div>`;
    statusNode = modal.querySelector("#pawprintAuthStatus");
    setStatus(error?.message === "AUTH_CONFIG_TIMEOUT" ? "Pawprint Auth did not respond. Check that localhost is running, then close and retry." : "Secure sign-in is taking longer than expected. Please close this dialog and retry.", "error");
    if (mode === "onboarding") modal.querySelector("#pawprintNickname")?.focus();
    else modal.querySelector("#pawprintAuthEmail")?.focus();
  }
}

function closeAuth() {
  if (!modal) return;
  modal.dataset.openRequest = String(Number(modal.dataset.openRequest || 0) + 1);
  modal.classList.remove("is-open");
  modal.setAttribute("aria-hidden", "true");
}

function installAuthenticatedFetch() {
  if (authenticatedFetchInstalled) return;
  authenticatedFetchInstalled = true;
  const originalFetch = window.fetch;
  window.fetch = (input, init = {}) => {
    const requestUrl = typeof input === "string" ? input : input?.url || "";
    const sameOriginApi = requestUrl.startsWith("/api/") || requestUrl.startsWith(location.origin + "/api/");
    if (!sameOriginApi || !window.pawprintSession?.access_token) return originalFetch(input, init);
    const headers = new Headers(init.headers || (input instanceof Request ? input.headers : undefined));
    headers.set("Authorization", `Bearer ${window.pawprintSession.access_token}`);
    return originalFetch(input, { ...init, headers });
  };
}

function watchAuthState() {
  if (!client || authStateSubscription) return;
  authStateSubscription = client.auth.onAuthStateChange((event, session) => {
    window.pawprintSession = session;
    authSessionChecked = true;
    updateTriggers();
    if (event === "PASSWORD_RECOVERY") openAuth("auth", "reset-confirm");
    else if (session) finishOnboarding().then((ready) => { if (ready) continuePendingApp(); });
  }).data.subscription;
}

async function syncAuthSession() {
  if (!client) return null;
  if (!authSessionChecked) {
    const sessionResult = await withTimeout(client.auth.getSession(), 8000, "AUTH_SESSION_TIMEOUT");
    window.pawprintSession = sessionResult.data.session;
    authSessionChecked = true;
  }
  updateTriggers();
  watchAuthState();
  return window.pawprintSession;
}

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
  let result;
  try {
    result = await withTimeout(client.from("profiles").select("id,nickname,avatar,age_group").eq("id", window.pawprintSession.user.id).maybeSingle(), 12000, "PROFILE_TIMEOUT");
  } catch (error) {
    return { error: error?.message || "PROFILE_UNAVAILABLE" };
  }
  if (result.error) {
    if (/relation .*profiles.* does not exist/i.test(result.error.message || "")) return { missingTable: true };
    return { error: result.error.message };
  }
  window.pawprintPublicProfile = result.data || null;
  window.dispatchEvent(new CustomEvent("pawprint-profile-ready", { detail: result.data || null }));
  return result.data;
}

async function ensureAppUserRecord() {
  if (!window.pawprintSession?.access_token) return null;
  try {
    const response = await fetch("/api/me", { headers: { accept: "application/json" } });
    if (!response.ok) return null;
    const data = await response.json();
    window.pawprintAppUser = data.user || null;
    return window.pawprintAppUser;
  } catch {
    return null;
  }
}

async function finishOnboarding() {
  await ensureAppUserRecord();
  const profile = await loadProfile();
  if (!profile || profile.missingTable || profile.error || !profile.nickname) {
    openAuth("onboarding");
    return false;
  }
  return true;
}

function continuePendingApp() {
  if (!window.pawprintAuthGate.pendingApp || !window.pawprintSession) return;
  window.pawprintAuthGate.pendingApp = false;
  window.dispatchEvent(new CustomEvent("pawprint-authenticated", { detail: { continueToApp: true } }));
}

async function handleMagicLink(event) {
  event.preventDefault();
  if (!client) return setStatus("Supabase Auth is not configured for this preview yet.", "error");
  const form = formFromEvent(event, "#pawprintMagicLinkForm");
  if (!form) return setStatus("The sign-in form is not ready. Please try again.", "error");
  const email = new FormData(form).get("email");
  const redirectTo = `${location.origin}/auth/callback`;
  const result = await client.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo } });
  if (result.error) return setStatus(result.error.message, "error");
  setStatus("Magic link sent. Check your inbox, then return here to continue.", "success");
  form.reset();
}

async function handlePassword(event) {
  event.preventDefault();
  if (!client) return setStatus("Supabase Auth is not configured for this preview yet.", "error");
  const form = formFromEvent(event, "#pawprintPasswordForm");
  if (!form) return setStatus("The sign-in form is not ready. Please try again.", "error");
  const values = new FormData(form);
  const email = String(values.get("email") || "").trim();
  const password = String(values.get("password") || "");
  const confirmPassword = String(values.get("confirmPassword") || "");
  const submit = form.querySelector("button[type=submit]");
  if (form.dataset.authMode === "signup" && password !== confirmPassword) return setStatus("Passwords do not match.", "error");
  submit.disabled = true;
  const originalLabel = submit.textContent;
  submit.textContent = form.dataset.authMode === "signup" ? "Creating account…" : "Signing in…";
  try {
    const result = await withTimeout(
      form.dataset.authMode === "signup"
        ? client.auth.signUp({ email, password, options: { emailRedirectTo: `${location.origin}/auth/callback` } })
        : client.auth.signInWithPassword({ email, password }),
      15000,
      "AUTH_REQUEST_TIMEOUT",
    );
    if (result.error) return setStatus(result.error.message, "error");
    if (form.dataset.authMode === "signup" && !result.data.session) {
      setStatus("Account created. Check your email to confirm, then return to Pawprint.", "success");
      form.reset();
    } else {
      setStatus("Signed in. Opening your Pawprint…", "success");
      closeAuth();
    }
  } catch (error) {
    setStatus(error?.message === "AUTH_REQUEST_TIMEOUT" ? "Supabase Auth took too long to respond. Check your connection and try again." : error?.message || "Unable to sign in right now. Please try again.", "error");
  } finally {
    submit.disabled = false;
    submit.textContent = originalLabel;
  }
}

async function handleReset(event) {
  event.preventDefault();
  if (!client) return setStatus("Supabase Auth is not configured for this preview yet.", "error");
  const form = formFromEvent(event, "#pawprintResetForm");
  if (!form) return setStatus("The reset form is not ready. Please try again.", "error");
  const email = String(new FormData(form).get("email") || "").trim();
  const result = await client.auth.resetPasswordForEmail(email, { redirectTo: `${location.origin}/auth/callback?next=reset` });
  if (result.error) return setStatus(result.error.message, "error");
  setStatus("Reset link sent. Check your inbox, then choose a new password.", "success");
  form.reset();
}

async function handleResetConfirm(event) {
  event.preventDefault();
  if (!client) return setStatus("Supabase Auth is not configured for this preview yet.", "error");
  const form = formFromEvent(event, "#pawprintResetConfirmForm");
  if (!form) return setStatus("The password form is not ready. Please try again.", "error");
  const values = new FormData(form);
  const password = String(values.get("password") || "");
  if (password !== String(values.get("confirmPassword") || "")) return setStatus("Passwords do not match.", "error");
  const result = await client.auth.updateUser({ password });
  if (result.error) return setStatus(result.error.message, "error");
  closeAuth();
  window.notify?.("Password updated. Welcome back to Pawprint.");
}

async function handleProvider(provider) {
  if (!client) return setStatus("Supabase Auth is not configured for this preview yet.", "error");
  if (authConfig?.providers?.[provider] !== true) return setStatus(`${provider === "google" ? "Google" : "Apple"} sign-in is not enabled in Supabase yet. Use email login for now.`, "error");
  const result = await client.auth.signInWithOAuth({ provider, options: { redirectTo: `${location.origin}/auth/callback` } });
  if (result.error) setStatus(result.error.message, "error");
}

async function handleOnboarding(event) {
  event.preventDefault();
  if (!client || !window.pawprintSession?.user) return setStatus("Your session is not ready yet. Please sign in again.", "error");
  const form = formFromEvent(event, "#pawprintOnboardingForm");
  if (!form) return setStatus("The profile form is not ready. Please try again.", "error");
  const values = new FormData(form);
  const nickname = String(values.get("nickname") || "").trim();
  const ageGroup = String(values.get("ageGroup") || "");
  const avatar = String(values.get("avatar") || "").trim() || null;
  const privacyConsent = values.get("privacyConsent") === "yes";
  if (!privacyConsent) return setStatus("Please review and accept the privacy notice before continuing.", "error");
  const result = await client.from("profiles").upsert({ id: window.pawprintSession.user.id, nickname, avatar, age_group: ageGroup, privacy_notice_version: "2026-10-15", privacy_consent_at: new Date().toISOString() }, { onConflict: "id" });
  if (result.error) return setStatus("Profile setup is not ready yet. Apply docs/supabase-auth.sql in Supabase, then try again.", "error");
  window.pawprintPublicProfile = { id: window.pawprintSession.user.id, nickname, avatar, age_group: ageGroup };
  window.dispatchEvent(new CustomEvent("pawprint-profile-ready", { detail: window.pawprintPublicProfile }));
  closeAuth();
  continuePendingApp();
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
    const view = event.target.closest("[data-auth-view]")?.dataset.authView;
    if (view) return openAuth("auth", view);
    const passwordToggle = event.target.closest("[data-toggle-password]");
    if (passwordToggle) {
      const input = modal.querySelector(`#${passwordToggle.dataset.target}`);
      if (!input) return;
      const visible = input.type === "text";
      input.type = visible ? "password" : "text";
      passwordToggle.textContent = visible ? "View" : "Hide";
      passwordToggle.setAttribute("aria-label", visible ? "View password" : "Hide password");
      return;
    }
    const avatarChoice = event.target.closest("[data-avatar-choice]");
    if (avatarChoice) {
      const selected = avatarChoice.dataset.avatarChoice;
      const input = modal.querySelector("#pawprintAvatar");
      if (input) input.value = selected;
      modal.querySelectorAll("[data-avatar-choice]").forEach((choice) => {
        choice.setAttribute("aria-pressed", String(choice === avatarChoice));
      });
      const selectedAvatar = catAvatars.find((avatar) => avatar.id === selected);
      const selectedNode = modal.querySelector("[data-avatar-selected]");
      if (selectedAvatar && selectedNode) selectedNode.innerHTML = selectedAvatarMarkup(selected);
      const dropdown = avatarChoice.closest("[data-avatar-dropdown]");
      if (dropdown) dropdown.open = false;
      return;
    }
    const provider = event.target.closest("[data-auth-provider]")?.dataset.authProvider;
    if (provider) return handleProvider(provider);
    if (event.target.closest("[data-open-auth]") && window.pawprintSession) return handleSignOut();
  });
  modal.addEventListener("submit", (event) => {
    if (event.target.id === "pawprintMagicLinkForm") handleMagicLink(event);
    if (event.target.id === "pawprintPasswordForm") handlePassword(event);
    if (event.target.id === "pawprintResetForm") handleReset(event);
    if (event.target.id === "pawprintResetConfirmForm") handleResetConfirm(event);
    if (event.target.id === "pawprintOnboardingForm") handleOnboarding(event);
  });
}

function bindDocumentTriggers() {
  document.addEventListener("click", (event) => {
    if (publicDemoOnly()) {
      const appTrigger = event.target.closest("[data-open-app]");
      const authTrigger = event.target.closest("[data-open-auth]");
      if (!appTrigger && !authTrigger) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (appTrigger) window.pawprintOpenDemo?.();
      else window.notify?.("Sign-in is coming in a future release. Explore the demo for now.");
      return;
    }
    const appTrigger = event.target.closest("[data-open-app]");
    if (appTrigger && !window.pawprintSession) {
      event.preventDefault();
      event.stopImmediatePropagation();
      window.pawprintAuthGate.pendingApp = true;
      openAuth("auth", "login");
      return;
    }
    const trigger = event.target.closest("[data-open-auth]");
    if (!trigger) return;
    event.preventDefault();
    if (window.pawprintSession) return handleSignOut();
    openAuth("auth", "login");
  }, true);
}

function protectAppRoute() {
  if (publicDemoOnly()) {
    if (location.hash === "#app" && new URLSearchParams(location.search).get("demo") !== "1") {
      const demoUrl = new URL(location.href);
      demoUrl.searchParams.set("demo", "1");
      demoUrl.hash = "app";
      history.replaceState({}, "", demoUrl.toString());
      window.pawprintOpenDemo?.();
    }
    return;
  }
  if (window.pawprintDemoMode || location.hash !== "#app" || window.pawprintSession) return;
  window.pawprintAuthGate.pendingApp = true;
  document.body.classList.remove("is-app");
  history.replaceState({}, "", `${location.pathname}${location.search}#top`);
  openAuth("auth", "login");
}

async function init() {
  addStyles();
  if (publicDemoOnly()) {
    window.pawprintSession = null;
    releaseAuthGate();
    protectAppRoute();
    window.addEventListener("hashchange", protectAppRoute);
    return;
  }
  modal = document.createElement("div");
  modal.className = "auth-backdrop";
  modal.setAttribute("aria-hidden", "true");
  document.body.appendChild(modal);
  bindModal();
  bindDocumentTriggers();
  addTriggers();
  installAuthenticatedFetch();
  const callbackParams = new URLSearchParams(location.search);
  const callbackCode = callbackParams.get("code");
  const recoveryCallback = callbackParams.get("next") === "reset";
  const isDemoRoute = new URLSearchParams(location.search).get("demo") === "1";
  const needsAuth = !isDemoRoute && (location.hash === "#app" || location.pathname === "/auth/callback" || recoveryCallback);
  if (!needsAuth) {
    updateTriggers();
    releaseAuthGate();
    return;
  }
  try {
    await ensureAuthClient();
    if (client && location.pathname === "/auth/callback" && callbackCode) {
      const exchange = await client.auth.exchangeCodeForSession(callbackCode);
      if (exchange.error) openAuth("auth", "login");
      history.replaceState({}, "", "/#app");
    }
    if (client) await syncAuthSession();
  } catch {
    // The public landing page stays usable even if the auth CDN or service is unavailable.
  }
  if (recoveryCallback) openAuth("auth", "reset-confirm");
  else if (window.pawprintSession) finishOnboarding().then((ready) => { if (ready) continuePendingApp(); });
  else protectAppRoute();
  releaseAuthGate();
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
else init();
