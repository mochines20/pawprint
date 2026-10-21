/* Pawprint integration bridge. The loader implementation itself lives unchanged
 * in pawloader.js; this file only connects its create/show API to the app. */
(() => {
  'use strict';
  const actual = window.PawLoader;
  if (!actual) return;
  const MIN_DELAY = 200;
  const MIN_VISIBLE = 400;
  let appBootHandle = null;
  const toActualOptions = (options = {}) => ({
    variant: options.variant,
    size: options.size,
    label: options.label,
    lang: options.locale === 'fil' ? 'fil' : options.lang,
    messages: options.messages,
  });
  const tone = (node, options = {}) => {
    if (options.tone === 'dark') node.classList.add('pl-dark');
    return node;
  };
  const create = (options = {}) => tone(actual.create(toActualOptions(options)), options);

  function start(target, options = {}) {
    const host = typeof target === 'string' ? document.querySelector(target) : target;
    if (!host) return { element: null, hide() {}, update() {}, showTimeout() {} };
    let element = null;
    let shownAt = 0;
    let closed = false;
    let showTimer = null;
    let hideTimer = null;
    const reveal = () => {
      if (closed) return;
      element = create(options);
      host.appendChild(element);
      shownAt = performance.now();
    };
    if ((options.delayMs ?? MIN_DELAY) <= 0) reveal();
    else showTimer = window.setTimeout(reveal, options.delayMs ?? MIN_DELAY);
    const handle = {
      get element() { return element; },
      get el() { return element; },
      hide() {
        if (closed) return;
        closed = true;
        window.clearTimeout(showTimer);
        if (hideTimer) window.clearTimeout(hideTimer);
        if (!element) return;
        const wait = Math.max(0, (options.minMs ?? MIN_VISIBLE) - (performance.now() - shownAt));
        hideTimer = window.setTimeout(() => element?.remove(), wait);
      },
      update(next = {}) {
        if (closed || !element) return;
        const replacement = create({ ...options, ...next });
        element.replaceWith(replacement);
        element = replacement;
      },
      showTimeout() {
        if (closed || !host || host.querySelector('.pawloader-timeout')) return;
        const notice = document.createElement('div');
        notice.className = 'pawloader-timeout';
        notice.innerHTML = '<strong>Pawprint is taking a little longer.</strong><small>Your connection may be sleepy. Try again when you are ready.</small><button type="button">Retry</button>';
        const recoveryLoader = create({ variant: 'tap', size: 'sm', label: 'Saving…', tone: options.tone || 'light', rotateLabel: false });
        recoveryLoader.setAttribute('aria-hidden', 'true');
        notice.prepend(recoveryLoader);
        notice.querySelector('button').addEventListener('click', () => window.location.reload());
        host.appendChild(notice);
      },
    };
    return handle;
  }

  function showOverlay(options = {}) {
    const overlay = document.createElement('div');
    overlay.className = 'pawloader-overlay';
    overlay.setAttribute('role', 'status');
    overlay.setAttribute('aria-label', options.label || 'Pawprint is loading');
    document.body.appendChild(overlay);
    const handle = start(overlay, options);
    const originalHide = handle.hide.bind(handle);
    handle.hide = () => { originalHide(); window.setTimeout(() => overlay.remove(), MIN_VISIBLE + 20); };
    return handle;
  }

  function showInline(target, options = {}) {
    const host = typeof target === 'string' ? document.querySelector(target) : target;
    if (!host) return { hide() {}, showTimeout() {} };
    const overlay = document.createElement('div');
    overlay.className = 'pawloader-inline-overlay';
    host.style.position = host.style.position || 'relative';
    host.appendChild(overlay);
    const handle = start(overlay, options);
    const originalHide = handle.hide.bind(handle);
    handle.hide = () => { originalHide(); window.setTimeout(() => overlay.remove(), MIN_VISIBLE + 20); };
    return handle;
  }

  function button(button, options = {}) {
    if (!button || button.dataset.pawloaderButton === '1') return button?._pawLoaderHandle || null;
    const label = options.label || button.textContent.trim() || 'Working...';
    const original = button.textContent;
    button.dataset.pawloaderButton = '1';
    button.dataset.pawloaderLabel = original;
    button.setAttribute('aria-busy', 'true');
    button.replaceChildren(create({ variant: 'tap', size: 'sm', label, tone: button.classList.contains('btn-dark') ? 'dark' : 'light', rotateLabel: false }));
    const shownAt = performance.now();
    let hidden = false;
    const handle = {
      hide() {
        if (hidden) return;
        hidden = true;
        const wait = Math.max(0, MIN_VISIBLE - (performance.now() - shownAt));
        window.setTimeout(() => {
          if (!button.isConnected) return;
          button.removeAttribute('aria-busy');
          button.removeAttribute('data-pawloader-button');
          button.textContent = button.dataset.pawloaderLabel || original;
          delete button.dataset.pawloaderLabel;
        }, wait);
      },
    };
    button._pawLoaderHandle = handle;
    return handle;
  }

  function observeBusyButtons() {
    const busy = /checking|saving|save|reserving|reserve|preparing|sending|loading|retry|verify|capture|notify/i;
    const sync = () => {
      document.querySelectorAll('button:disabled').forEach((node) => {
        if (node.dataset.pawloaderButton === '1') return;
        const text = `${node.id} ${node.textContent}`;
        if (busy.test(text)) button(node, { label: node.textContent.trim() || 'Working...' });
      });
      document.querySelectorAll('button[data-pawloader-button="1"]:not(:disabled)').forEach((node) => node._pawLoaderHandle?.hide());
    };
    new MutationObserver(sync).observe(document.body, { attributes: true, attributeFilter: ['disabled'], childList: true, subtree: true });
    sync();
  }

  function hydrateLegacyElements() {
    document.querySelectorAll('paw-loader').forEach((node) => {
      const replacement = create({
        variant: node.getAttribute('variant'),
        size: node.getAttribute('size'),
        label: node.getAttribute('label'),
        locale: node.getAttribute('locale'),
        tone: node.getAttribute('tone'),
        rotateLabel: node.getAttribute('rotate-label') !== 'false',
      });
      node.replaceWith(replacement);
    });
  }

  function trackRequests() {
    if (!window.fetch || window.fetch.__pawLoaderWrapped) return;
    const originalFetch = window.fetch.bind(window);
    const requestConfig = (path, method) => {
      if (method === 'POST' && path === '/api/sightings') return { variant: 'paws', size: 'md', label: 'Checking for a cat…' };
      if (method === 'GET' && path === '/api/dashboard') return { variant: 'paws', size: 'md', label: 'Checking for a cat…', delayMs: 0 };
      if (method === 'GET' && path === '/api/map') return { variant: 'pin', size: 'md', label: 'Checking for a cat…' };
      if (method === 'GET' && path === '/api/sightings') return { variant: 'pin', size: 'md', label: 'Loading your sightings…', target: '.app-map' };
      if (method === 'GET' && path === '/api/me') return { variant: 'paws', size: 'md', label: 'Loading your profile…', target: '#dashboard' };
      if (method === 'GET' && path === '/api/journal') return { variant: 'paws', size: 'md', label: 'Loading your Journal…', target: '#journalEntries' };
      if (method === 'GET' && path === '/api/care-flags') return { variant: 'paws', size: 'md', label: 'Loading Care Flags…', target: '#flagList' };
      if (method === 'GET' && path === '/api/progress') return { variant: 'paws', size: 'md', label: 'Loading quests and medals…', target: '#dashboard' };
      if (method === 'GET' && path === '/api/leaderboards') return { variant: 'paws', size: 'md', label: 'Loading the leaderboard…', target: '#dashboard' };
      if (method === 'GET' && path === '/api/notifications') return { variant: 'paws', size: 'md', label: 'Loading notifications…', target: '#dashboard' };
      if (method === 'GET' && path === '/api/community') return { variant: 'paws', size: 'md', label: 'Loading community tools…', target: '#dashboard' };
      return null;
    };
    const wrapped = async (input, init = {}) => {
      const request = input instanceof Request ? input : null;
      const url = new URL(request?.url || input, location.href);
      const method = String(init.method || request?.method || 'GET').toUpperCase();
      const config = requestConfig(url.pathname, method);
      let loader = null;
      let phaseTimer = null;
      const isBootDashboard = Boolean(appBootHandle && method === 'GET' && url.pathname === '/api/dashboard');
      if (config && !isBootDashboard) loader = config.target ? showInline(config.target, config) : url.pathname === '/api/map' ? showInline('.app-map', config) : showOverlay(config);
      if (isBootDashboard) loader = appBootHandle;
      if (loader && method === 'POST' && url.pathname === '/api/sightings') phaseTimer = window.setTimeout(() => loader.update({ variant: 'pin', label: 'Saving your sighting…' }), 900);
      const timeout = loader ? window.setTimeout(() => loader.showTimeout(), 15000) : null;
      try { return await originalFetch(input, init); }
      finally {
        if (timeout) window.clearTimeout(timeout);
        if (phaseTimer) window.clearTimeout(phaseTimer);
        loader?.hide();
        if (isBootDashboard) appBootHandle = null;
      }
    };
    wrapped.__pawLoaderWrapped = true;
    window.fetch = wrapped;
  }

  function startAppBootLoader() {
    if (location.hash !== '#app' || appBootHandle) return;
    appBootHandle = showOverlay({
      variant: 'paws',
      size: 'lg',
      label: 'Checking for a cat…',
      delayMs: 0,
      minMs: 500,
    });
    const stopIfLeavingApp = () => {
      if (location.hash !== '#app') {
        appBootHandle?.hide();
        appBootHandle = null;
        window.removeEventListener('hashchange', stopIfLeavingApp);
      }
    };
    window.addEventListener('hashchange', stopIfLeavingApp);
    // Demo mode has no dashboard request, so do not leave the boot overlay up.
    if (new URLSearchParams(location.search).get('demo') === '1') {
      window.setTimeout(() => {
        appBootHandle?.hide();
        appBootHandle = null;
        window.removeEventListener('hashchange', stopIfLeavingApp);
      }, 1200);
    }
  }

  function init() {
    if (window.__pawprintPawloaderInitialized) return;
    window.__pawprintPawloaderInitialized = true;
    hydrateLegacyElements();
    document.addEventListener('visibilitychange', () => document.body.classList.toggle('pl-hidden', document.hidden));
    observeBusyButtons();
    trackRequests();
    startAppBootLoader();
  }

  const styles = document.createElement('style');
  styles.textContent = '.pawloader-overlay{position:fixed;inset:0;z-index:90;display:grid;place-items:center;padding:1.25rem;background:rgba(250,248,244,.92)}.pawloader-inline-overlay{position:absolute;inset:0;z-index:5;display:grid;place-items:center;border-radius:inherit;background:rgba(250,248,244,.86)}.pawloader-timeout{display:grid;gap:.7rem;max-width:18rem;padding:1rem 1.1rem;border:2px solid #151515;border-radius:1.1rem;background:#FAF8F4;color:#151515;box-shadow:4px 5px 0 #151515;text-align:center}.pawloader-timeout button{min-height:2.2rem;border:2px solid #151515;border-radius:999px;background:#FFB400;color:#151515;box-shadow:3px 3px 0 #151515;font-weight:800;cursor:pointer}.pl.pl-dark{--pl-fg:#FAF8F4;--pl-line:#3A3A3C;--pl-stone:#A9A7A0;--pl-rim:#8C8A84;--pl-eye-ring:#8C8A84}.pl-hidden .pl *{animation-play-state:paused!important}';
  document.head.appendChild(styles);
  window.PawLoader = Object.freeze({ ...actual, create, start, showOverlay, showInline, button, init, timing: { MIN_DELAY, MIN_VISIBLE } });
  if (document.readyState === 'loading' && !document.body) document.addEventListener('DOMContentLoaded', init, { once: true }); else init();
})();
