(() => {
  'use strict';

  const MIN_DELAY = 200;
  const MIN_VISIBLE = 400;
  const COPY = Object.freeze({
    en: ["Sniffing around...", "Checking for a cat...", "Counting whiskers...", "Almost there..."],
    fil: ["Hinahanap ang pusa...", "Sinisilip kung may pusa...", "Konti na lang..."],
  });
  // Keep the production loader set intentionally small: paws for checking/lists,
  // pin for map and save states, and tap for action buttons.
  const VARIANTS = new Set(["paws", "pin", "tap"]);
  const SIZES = new Set(["lg", "md", "sm"]);

  const styles = `
    :root {
      --paw-ink: #151515;
      --paw-paper: #FAF8F4;
      --paw-stone: #8C8A84;
      --paw-line: #E4E1DA;
      --paw-amber: #FFB400;
      --paw-care: #D9402B;
    }
    .pawloader,
    paw-loader {
      --paw-loader-color: var(--paw-ink);
      --paw-loader-accent: var(--paw-amber);
      position: relative;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: .65rem;
      min-width: 2rem;
      min-height: 2rem;
      color: var(--paw-loader-color);
      font: 700 .78rem/1.25 var(--font-display, inherit);
      vertical-align: middle;
      isolation: isolate;
    }
    .pawloader[data-tone="dark"],
    paw-loader[data-tone="dark"] {
      --paw-loader-color: var(--paw-paper);
      --paw-loader-accent: var(--paw-amber);
    }
    .pawloader[data-size="lg"],
    paw-loader[data-size="lg"] {
      width: min(100%, 15rem);
      min-height: 10rem;
      flex-direction: column;
      padding: 1.25rem;
      border: 2px solid var(--paw-ink);
      border-radius: 1.5rem;
      background: var(--paw-paper);
      box-shadow: 5px 6px 0 var(--paw-ink);
    }
    .pawloader[data-size="md"],
    paw-loader[data-size="md"] { min-width: 7rem; min-height: 3rem; }
    .pawloader[data-size="sm"],
    paw-loader[data-size="sm"] { min-width: 1.15rem; min-height: 1.15rem; gap: 0; }
    .pawloader[data-size="sm"] .pawloader__visual,
    paw-loader[data-size="sm"] .pawloader__visual { width: 1.2rem; height: 1.2rem; }
    .pawloader__visual { display: block; width: 3.6rem; height: 3.6rem; overflow: visible; flex: none; }
    .pawloader[data-size="lg"] .pawloader__visual,
    paw-loader[data-size="lg"] .pawloader__visual { width: 7rem; height: 7rem; }
    .pawloader__caption { color: var(--paw-loader-color); text-align: center; }
    .pawloader[data-size="sm"] .pawloader__caption,
    paw-loader[data-size="sm"] .pawloader__caption { display: none; }
    .pawloader__sr { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0; }
    .pawloader[data-state="pending"],
    paw-loader[data-state="pending"] { opacity: 0; }
    .pawloader[data-state="visible"],
    paw-loader[data-state="visible"] { opacity: 1; transition: opacity .12s ease; }
    .pawloader__animated { transform-box: fill-box; transform-origin: center; }
    .pawloader-chase__rotor { animation: pawloader-chase 1.4s linear infinite; transform-origin: 60px 60px; }
    .pawloader-chase__head { animation: pawloader-head-bounce 1.4s ease-in-out infinite; transform-origin: 91px 24px; }
    .pawloader-chase__tail { animation: pawloader-tail-breathe 1.4s ease-in-out infinite; transform-origin: 26px 82px; }
    .pawloader-paws__step { animation: pawloader-paw-step 1.62s ease-in-out infinite; transform-origin: center; }
    .pawloader-paws__step:nth-child(2) { animation-delay: .18s; }
    .pawloader-paws__step:nth-child(3) { animation-delay: .36s; }
    .pawloader-paws__step:nth-child(4) { animation-delay: .54s; }
    .pawloader-paws__newest { color: var(--paw-loader-accent); }
    .pawloader-pin__paw { animation: pawloader-paw-press 1.5s ease-in-out infinite; transform-origin: 28px 25px; }
    .pawloader-pin__pin { animation: pawloader-pin-drop 1.5s ease-in-out infinite; transform-origin: 60px 54px; }
    .pawloader-pin__ripple { animation: pawloader-ripple 1.5s ease-out infinite; transform-origin: 60px 88px; }
    .pawloader-tap__paw { animation: pawloader-tap 700ms ease-in-out infinite; transform-origin: 24px 30px; }
    @keyframes pawloader-chase { to { transform: rotate(360deg); } }
    @keyframes pawloader-head-bounce { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-3px); } }
    @keyframes pawloader-tail-breathe { 0%,100% { transform: scale(.94); } 50% { transform: scale(1.05); } }
    @keyframes pawloader-paw-step { 0%,100% { opacity: .16; transform: translateY(5px) scale(.88); } 18%,68% { opacity: 1; transform: translateY(0) scale(1); } }
    @keyframes pawloader-paw-press { 0%,100% { transform: translateY(0) rotate(-8deg); } 35% { transform: translateY(6px) rotate(-3deg); } }
    @keyframes pawloader-pin-drop { 0%,100% { opacity: 1; transform: translateY(0); } 28% { transform: translateY(-9px); } 48% { transform: translateY(2px); } }
    @keyframes pawloader-ripple { 0% { opacity: .65; transform: scale(.45); } 60%,100% { opacity: 0; transform: scale(1.35); } }
    @keyframes pawloader-tap { 0%,100% { transform: translateY(0) rotate(-4deg); } 45% { transform: translateY(5px) rotate(1deg); } }
    @keyframes pawloader-calm { 0%,100% { opacity: .55; } 50% { opacity: 1; } }
    .pawloader-overlay { position: fixed; inset: 0; z-index: 90; display: grid; place-items: center; padding: 1.25rem; background: color-mix(in srgb, var(--paw-paper) 92%, transparent); }
    .pawloader-inline-overlay { position: absolute; inset: 0; z-index: 5; display: grid; place-items: center; border-radius: inherit; background: color-mix(in srgb, var(--paw-paper) 86%, transparent); }
    .pawloader-timeout { display: grid; gap: .7rem; max-width: 18rem; padding: 1rem 1.1rem; border: 2px solid var(--paw-ink); border-radius: 1.1rem; background: var(--paw-paper); color: var(--paw-ink); box-shadow: 4px 5px 0 var(--paw-ink); text-align: center; }
    .pawloader-timeout strong { font-size: .9rem; }
    .pawloader-timeout small { color: var(--paw-stone); }
    .pawloader-timeout button { min-height: 2.2rem; border: 2px solid var(--paw-ink); border-radius: 999px; background: var(--paw-amber); color: var(--paw-ink); box-shadow: 3px 3px 0 var(--paw-ink); font: 800 .76rem/1 var(--font-display, inherit); cursor: pointer; }
    .pawloader-button { position: relative; }
    .pawloader-button > .pawloader { color: currentColor; }
    .pawloader-hidden .pawloader__animated { animation-play-state: paused !important; }
    @media (prefers-reduced-motion: reduce) {
      .pawloader__animated { animation: pawloader-calm 1s ease-in-out infinite !important; }
      .pawloader-chase__rotor { transform: none !important; }
      .pawloader[data-size="sm"] .pawloader__animated,
      paw-loader[data-size="sm"] .pawloader__animated { animation: pawloader-calm 1s ease-in-out infinite !important; }
    }
  `;

  const svg = {
    chase: `
      <svg class="pawloader__visual" viewBox="0 0 120 120" aria-hidden="true" focusable="false">
        <g class="pawloader__animated pawloader-chase__rotor">
          <circle cx="60" cy="60" r="36" fill="none" stroke="currentColor" stroke-width="10" stroke-linecap="round" stroke-dasharray="188 38"/>
          <circle class="pawloader__animated pawloader-chase__tail" cx="27" cy="83" r="6" fill="var(--paw-loader-accent)"/>
          <g class="pawloader__animated pawloader-chase__head">
            <path d="M79 27 81 10l12 11 14-6-3 18c5 5 8 11 8 18 0 14-12 25-27 25S58 65 58 51c0-10 6-19 15-24l6 0Z" fill="var(--paw-loader-color)" stroke="var(--paw-loader-color)" stroke-width="3" stroke-linejoin="round"/>
            <circle cx="78" cy="49" r="3.2" fill="var(--paw-loader-accent)"/>
            <circle cx="96" cy="49" r="3.2" fill="var(--paw-loader-accent)"/>
            <path d="M82 60c3 4 8 4 11 0" fill="none" stroke="var(--paw-paper)" stroke-width="3" stroke-linecap="round"/>
          </g>
        </g>
      </svg>`,
    paws: `
      <svg class="pawloader__visual" viewBox="0 0 160 54" aria-hidden="true" focusable="false">
        <g class="pawloader__animated pawloader-paws__step" transform="translate(4 8) rotate(-8 18 18)"><circle cx="18" cy="28" r="9" fill="currentColor"/><circle cx="7" cy="15" r="4.5" fill="currentColor"/><circle cx="16" cy="10" r="4.5" fill="currentColor"/><circle cx="26" cy="10" r="4.5" fill="currentColor"/><circle cx="34" cy="16" r="4.5" fill="currentColor"/></g>
        <g class="pawloader__animated pawloader-paws__step" transform="translate(43 1) rotate(8 18 18)"><circle cx="18" cy="28" r="9" fill="currentColor"/><circle cx="7" cy="15" r="4.5" fill="currentColor"/><circle cx="16" cy="10" r="4.5" fill="currentColor"/><circle cx="26" cy="10" r="4.5" fill="currentColor"/><circle cx="34" cy="16" r="4.5" fill="currentColor"/></g>
        <g class="pawloader__animated pawloader-paws__step" transform="translate(82 8) rotate(-8 18 18)"><circle cx="18" cy="28" r="9" fill="currentColor"/><circle cx="7" cy="15" r="4.5" fill="currentColor"/><circle cx="16" cy="10" r="4.5" fill="currentColor"/><circle cx="26" cy="10" r="4.5" fill="currentColor"/><circle cx="34" cy="16" r="4.5" fill="currentColor"/></g>
        <g class="pawloader__animated pawloader-paws__step pawloader-paws__newest" transform="translate(121 1) rotate(8 18 18)"><circle cx="18" cy="28" r="9" fill="currentColor"/><circle cx="7" cy="15" r="4.5" fill="currentColor"/><circle cx="16" cy="10" r="4.5" fill="currentColor"/><circle cx="26" cy="10" r="4.5" fill="currentColor"/><circle cx="34" cy="16" r="4.5" fill="currentColor"/></g>
      </svg>`,
    pin: `
      <svg class="pawloader__visual" viewBox="0 0 120 120" aria-hidden="true" focusable="false">
        <g class="pawloader__animated pawloader-pin__paw" fill="var(--paw-loader-color)"><ellipse cx="26" cy="25" rx="13" ry="9"/><circle cx="11" cy="12" r="5"/><circle cx="22" cy="7" r="5"/><circle cx="34" cy="8" r="5"/><circle cx="44" cy="15" r="5"/></g>
        <g class="pawloader__animated pawloader-pin__pin"><path d="M60 37c-14 0-24 10-24 23 0 17 24 36 24 36s24-19 24-36c0-13-10-23-24-23Z" fill="var(--paw-loader-color)" stroke="var(--paw-loader-color)" stroke-width="3"/><circle cx="60" cy="59" r="7" fill="var(--paw-loader-accent)"/></g>
        <circle class="pawloader__animated pawloader-pin__ripple" cx="60" cy="92" r="17" fill="none" stroke="var(--paw-loader-accent)" stroke-width="3"/>
      </svg>`,
    tap: `
      <svg class="pawloader__visual" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
        <g class="pawloader__animated pawloader-tap__paw" fill="currentColor"><ellipse cx="24" cy="30" rx="11" ry="8"/><circle cx="11" cy="19" r="4.5"/><circle cx="20" cy="14" r="4.5"/><circle cx="29" cy="14" r="4.5"/><circle cx="37" cy="20" r="4.5"/></g>
      </svg>`,
  };

  function escapeAttribute(value) {
    return String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[character]));
  }

  function normalize(options = {}) {
    const variant = VARIANTS.has(options.variant) ? options.variant : 'paws';
    const size = SIZES.has(options.size) ? options.size : variant === 'tap' ? 'sm' : 'md';
    const locale = String(options.locale || document.documentElement.lang || 'en').toLowerCase().startsWith('fil') ? 'fil' : 'en';
    const fallback = COPY[locale][0];
    return { variant, size, locale, label: String(options.label || fallback), tone: options.tone === 'dark' ? 'dark' : 'light', rotateLabel: options.rotateLabel !== false && size === 'lg' };
  }

  function installStyles() {
    if (document.getElementById('paw-loader-styles')) return;
    const style = document.createElement('style');
    style.id = 'paw-loader-styles';
    style.textContent = styles;
    document.head.appendChild(style);
  }

  class PawLoaderElement extends HTMLElement {
    connectedCallback() {
      this.render();
      this.dataset.state = 'pending';
      this._pawVisibleTimer = window.setTimeout(() => { this.dataset.state = 'visible'; this._pawShownAt = performance.now(); }, MIN_DELAY);
    }
    disconnectedCallback() { this.stopLabelRotation(); if (this._pawVisibleTimer) window.clearTimeout(this._pawVisibleTimer); }
    render() {
      installStyles();
      const options = normalize({ variant: this.getAttribute('variant'), size: this.getAttribute('size'), label: this.getAttribute('label'), locale: this.getAttribute('locale'), tone: this.getAttribute('tone'), rotateLabel: this.getAttribute('rotate-label') !== 'false' });
      this.className = 'pawloader';
      this.dataset.variant = options.variant;
      this.dataset.size = options.size;
      this.dataset.tone = options.tone;
      this.dataset.state = this.dataset.state || 'visible';
      this.setAttribute('role', 'status');
      this.setAttribute('aria-live', 'polite');
      this.setAttribute('aria-label', options.label);
      this.innerHTML = `${svg[options.variant]}<span class="pawloader__caption" aria-hidden="true"></span><span class="pawloader__sr">${escapeAttribute(options.label)}</span>`;
      this.setLabel(options);
    }
    setLabel(options) {
      this.stopLabelRotation();
      const caption = this.querySelector('.pawloader__caption');
      if (caption) caption.textContent = options.label;
      if (!options.rotateLabel) return;
      const copy = COPY[options.locale];
      let index = Math.max(0, copy.indexOf(options.label));
      this._pawLabelTimer = window.setInterval(() => {
        index = (index + 1) % copy.length;
        if (caption) caption.textContent = copy[index];
      }, 2500);
    }
    stopLabelRotation() { if (this._pawLabelTimer) window.clearInterval(this._pawLabelTimer); this._pawLabelTimer = null; }
  }

  function defineElement() {
    if (!window.customElements || window.customElements.get('paw-loader')) return;
    window.customElements.define('paw-loader', PawLoaderElement);
  }

  function create(options = {}) {
    installStyles();
    defineElement();
    const node = document.createElement('paw-loader');
    const normalized = normalize(options);
    Object.entries(normalized).forEach(([key, value]) => {
      if (key === 'rotateLabel') return;
      node.setAttribute(key === 'locale' ? 'locale' : key, value);
    });
    node.setAttribute('rotate-label', String(normalized.rotateLabel));
    return node;
  }

  function start(target, options = {}) {
    const host = typeof target === 'string' ? document.querySelector(target) : target;
    if (!host) return { element: null, hide() {}, update() {}, showTimeout() {} };
    const element = create(options);
    element.dataset.state = 'pending';
    host.replaceChildren(element);
    let timer = null;
    let shownAt = 0;
    let closed = false;
    const reveal = () => { if (closed) return; element.dataset.state = 'visible'; shownAt = performance.now(); };
    timer = window.setTimeout(reveal, MIN_DELAY);
    const cleanup = () => { if (closed) return; closed = true; if (timer) window.clearTimeout(timer); element.remove(); };
    return {
      element,
      hide() {
        if (closed) return;
        const wait = shownAt ? Math.max(0, MIN_VISIBLE - (performance.now() - shownAt)) : 0;
        window.setTimeout(cleanup, wait);
      },
      update(next = {}) {
        const normalized = normalize({ ...options, ...next });
        element.setAttribute('variant', normalized.variant); element.setAttribute('size', normalized.size); element.setAttribute('label', normalized.label); element.setAttribute('locale', normalized.locale); element.render();
      },
      showTimeout() {
        if (closed || host.querySelector('.pawloader-timeout')) return;
        const notice = document.createElement('div');
        notice.className = 'pawloader-timeout';
        notice.innerHTML = '<strong>Pawprint is taking a little longer.</strong><small>Your connection may be sleepy. Try again when you are ready.</small><button type="button">Retry</button>';
        notice.querySelector('button').addEventListener('click', () => window.location.reload());
        host.appendChild(notice);
      },
    };
  }

  function showOverlay(options = {}) {
    const overlay = document.createElement('div');
    overlay.className = 'pawloader-overlay';
    overlay.setAttribute('aria-label', options.label || 'Pawprint is loading');
    document.body.appendChild(overlay);
    const handle = start(overlay, options);
    const originalHide = handle.hide;
    handle.hide = () => { const pending = handle.element?.dataset.state === 'pending'; originalHide(); window.setTimeout(() => overlay.remove(), pending ? 0 : MIN_VISIBLE + 20); };
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
    const originalHide = handle.hide;
    handle.hide = () => { const pending = handle.element?.dataset.state === 'pending'; originalHide(); window.setTimeout(() => overlay.remove(), pending ? 0 : MIN_VISIBLE + 20); };
    return handle;
  }

  function button(button, options = {}) {
    if (!button || button.dataset.pawloaderButton === '1') return button?._pawLoaderHandle || null;
    const label = options.label || button.textContent.trim() || 'Working...';
    button.dataset.pawloaderButton = '1';
    button.dataset.pawloaderLabel = label;
    button.setAttribute('aria-busy', 'true');
    const loader = create({ variant: 'tap', size: 'sm', label, tone: button.classList.contains('btn-dark') ? 'dark' : 'light', rotateLabel: false });
    loader.dataset.state = 'pending';
    button.replaceChildren(loader);
    let shownAt = 0;
    let showTimer = window.setTimeout(() => { shownAt = performance.now(); loader.dataset.state = 'visible'; }, MIN_DELAY);
    let hidden = false;
    const restore = () => { if (hidden && button.isConnected) { button.removeAttribute('aria-busy'); button.removeAttribute('data-pawloader-button'); button.textContent = button.dataset.pawloaderLabel || label; delete button.dataset.pawloaderLabel; } };
    const handle = { hide() { if (hidden) return; hidden = true; window.clearTimeout(showTimer); const wait = shownAt ? Math.max(0, MIN_VISIBLE - (performance.now() - shownAt)) : 0; window.setTimeout(restore, wait); } };
    button._pawLoaderHandle = handle;
    return handle;
  }

  function observeBusyButtons() {
    const busy = /checking|saving|save|reserving|reserve|preparing|sending|loading|retry|verify|capture|notify/i;
    const sync = () => {
      document.querySelectorAll('button:disabled').forEach((node) => {
        if (node.dataset.pawloaderButton === '1') {
          if (!node.querySelector('paw-loader') && node.textContent.trim()) node.dataset.pawloaderLabel = node.textContent.trim();
          return;
        }
        const text = `${node.id} ${node.textContent}`;
        if (busy.test(text)) button(node, { label: node.textContent.trim() || 'Working...' });
      });
      document.querySelectorAll('button[data-pawloader-button="1"]:not(:disabled)').forEach((node) => node._pawLoaderHandle?.hide());
    };
    new MutationObserver(sync).observe(document.body, { attributes: true, attributeFilter: ['disabled'], childList: true, subtree: true });
    sync();
  }

  function trackRequests() {
    if (!window.fetch || window.fetch.__pawLoaderWrapped) return;
    const originalFetch = window.fetch.bind(window);
    const requestConfig = (path, method) => {
      if (method === 'POST' && path === '/api/sightings') return { variant: 'paws', size: 'md', label: 'Checking for a cat…' };
      if (method === 'GET' && path === '/api/dashboard') return { variant: 'paws', size: 'md', label: 'Checking for a cat…' };
      if (method === 'GET' && path === '/api/map') return { variant: 'pin', size: 'md', label: 'Checking for a cat…' };
      if (method === 'GET' && path === '/api/journal') return { variant: 'paws', size: 'md', label: 'Loading your Journal...' , target: '#journalEntries' };
      if (method === 'GET' && path === '/api/care-flags') return { variant: 'paws', size: 'md', label: 'Loading Care Flags...', target: '#flagList' };
      if (method === 'GET' && path === '/api/progress') return { variant: 'paws', size: 'md', label: 'Loading quests and medals...', target: '#dashboard' };
      if (method === 'GET' && path === '/api/leaderboards') return { variant: 'paws', size: 'md', label: 'Loading the leaderboard...', target: '#dashboard' };
      if (method === 'GET' && path === '/api/notifications') return { variant: 'paws', size: 'md', label: 'Loading notifications...', target: '#dashboard' };
      if (method === 'GET' && path === '/api/community') return { variant: 'paws', size: 'md', label: 'Loading community tools...', target: '#dashboard' };
      return null;
    };
    const wrapped = async (input, init = {}) => {
      const request = input instanceof Request ? input : null;
      const url = new URL(request?.url || input, location.href);
      const method = String(init.method || request?.method || 'GET').toUpperCase();
      const config = requestConfig(url.pathname, method);
      let loader = null;
      let phaseTimer = null;
      if (config) loader = config.target ? showInline(config.target, config) : url.pathname === '/api/map' ? showInline('.app-map', config) : showOverlay(config);
      if (loader && method === 'POST' && url.pathname === '/api/sightings') {
        phaseTimer = window.setTimeout(() => loader.update({ variant: 'pin', size: 'md', label: 'Saving your sighting…' }), 900);
      }
      const timeout = loader ? window.setTimeout(() => loader.showTimeout(), 15000) : null;
      try { return await originalFetch(input, init); }
      finally { if (timeout) window.clearTimeout(timeout); if (phaseTimer) window.clearTimeout(phaseTimer); loader?.hide(); }
    };
    wrapped.__pawLoaderWrapped = true;
    window.fetch = wrapped;
  }

  function init() {
    installStyles();
    defineElement();
    document.addEventListener('visibilitychange', () => document.body.classList.toggle('pawloader-hidden', document.hidden));
    observeBusyButtons();
    trackRequests();
  }

  window.PawLoader = Object.freeze({ create, start, showOverlay, showInline, button, copy: COPY, timing: { MIN_DELAY, MIN_VISIBLE }, init });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true }); else init();
})();
