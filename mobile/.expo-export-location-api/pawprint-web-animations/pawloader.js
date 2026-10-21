/*! PawLoader for Pawprint – vanilla, no dependencies. Pair with pawloader.css.
 *   PawLoader.create({variant,size,label,messages}) -> HTMLElement
 *   PawLoader.show(host, opts) -> { hide(), el }   (200 ms show-delay, 400 ms minimum visible, optional timeout)
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.PawLoader = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  var NS = 'http://www.w3.org/2000/svg';
  var MESSAGES = {
    en: ['Sniffing around…', 'Checking for a cat…', 'Counting whiskers…', 'Almost there…'],
    fil: ['Hinahanap ang pusa…', 'Sinisilip kung may pusa…', 'Konti na lang…']
  };
  var uid = 0;

  function polar(r, deg) { var a = deg * Math.PI / 180; return [60 + r * Math.sin(a), 60 - r * Math.cos(a)]; }
  function arc(r, from, to, cls, w) {
    var a = polar(r, from), b = polar(r, to), large = (to - from) > 180 ? 1 : 0;
    return '<path class="' + cls + '" stroke-width="' + w + '" d="M' + a[0].toFixed(2) + ' ' + a[1].toFixed(2) +
      'A' + r + ' ' + r + ' 0 ' + large + ' 1 ' + b[0].toFixed(2) + ' ' + b[1].toFixed(2) + '"/>';
  }
  // paw print pointing up, centred on (0,0), ~28 units wide
  var PAW = '<ellipse cx="0" cy="4.5" rx="8.6" ry="7.4"/><ellipse cx="-10.5" cy="-3.6" rx="3.6" ry="4.6" transform="rotate(-24 -10.5 -3.6)"/>' +
    '<ellipse cx="-3.8" cy="-9.4" rx="3.6" ry="4.8"/><ellipse cx="3.8" cy="-9.4" rx="3.6" ry="4.8"/>' +
    '<ellipse cx="10.5" cy="-3.6" rx="3.6" ry="4.6" transform="rotate(24 10.5 -3.6)"/>';

  var ART = {
    chase: function () {
      var R = 36, g = '';
      g += '<circle class="track" cx="60" cy="60" r="' + R + '"/>';
      g += '<g class="pl-spin">';
      // rim layer first (visible on dark surfaces), then ink on top
      g += '<g class="pl-wag-wrap">';
      g += '<g class="pl-tailwag">' + arc(R, -250, -292, 'rim', 19) + arc(R, -290, -312, 'rim', 14) + arc(R, -310, -324, 'rim', 10) +
           arc(R, -250, -292, 'body', 13) + arc(R, -290, -312, 'body', 9) + arc(R, -310, -324, 'body', 5.5) + '</g>';
      g += arc(R, -252, -14, 'rim', 25) + arc(R, -252, -14, 'body', 20);
      g += '</g>';
      // head (leading, facing the direction of travel = right)
      g += '<g class="pl-head">' +
        '<path class="rim" stroke-width="9" stroke-linejoin="round" d="M47 18L48.5 3L58 11ZM62 11L71.5 3L73 18Z"/>' +
        '<path class="ink" stroke="#151515" stroke-width="4" stroke-linejoin="round" d="M47 18L48.5 3L58 11ZM62 11L71.5 3L73 18Z"/>' +
        '<circle class="rim" cx="60" cy="24" r="17" stroke-width="3"/><circle class="ink" cx="60" cy="24" r="15"/>' +
        '<ellipse class="amber" cx="62.5" cy="22" rx="4" ry="5"/><ellipse class="amber" cx="72" cy="22" rx="4" ry="5"/>' +
        '<ellipse class="ink" cx="64" cy="22.5" rx="1.9" ry="3.8"/><ellipse class="ink" cx="73.5" cy="22.5" rx="1.9" ry="3.8"/>' +
        '<circle fill="#fff" cx="63.2" cy="20.4" r="1.1"/><circle fill="#fff" cx="72.7" cy="20.4" r="1.1"/>' +
        '<circle cx="76" cy="28" r="2.4" fill="#E8A0A8"/>' +
        '<path d="M77 30Q82 29 85 31M77.5 27Q82 24.5 85 25" fill="none" stroke="#8C8A84" stroke-width="1.2" stroke-linecap="round"/>' +
        '</g>';
      g += '</g>';
      return { vb: '0 0 120 120', body: g, calm: '.pl-spin' };
    },
    paws: function () {
      var xs = [24, 76, 128, 180], ys = [40, 22, 40, 22], rot = [96, 84, 96, 84], g = '';
      for (var i = 0; i < 4; i++) {
        g += '<g transform="translate(' + xs[i] + ' ' + ys[i] + ') rotate(' + rot[i] + ')"><g class="pl-paw" style="animation-delay:' + (i * 0.24).toFixed(2) + 's"><g class="pp">' + PAW + '</g></g></g>';
      }
      return { vb: '0 0 204 62', body: g };
    },
    pin: function () {
      var pin = 'M60 12C47 12 37.5 21.5 37.5 34C37.5 52 60 78 60 78C60 78 82.5 52 82.5 34C82.5 21.5 73 12 60 12Z';
      var g = '<ellipse class="pl-shadow" cx="60" cy="80" rx="16" ry="4.2" fill="#151515" opacity=".28"/>' +
        '<ellipse class="pl-ripple" cx="60" cy="80" rx="22" ry="6.5" fill="none" stroke="#FFB400" stroke-width="3"/>' +
        '<g class="pl-pin-g"><path d="' + pin + '" fill="#FFB400" stroke="#151515" stroke-width="4" stroke-linejoin="round"/>' +
        '<circle cx="60" cy="34" r="12" fill="#FAF8F4" stroke="#151515" stroke-width="3"/>' +
        '<g transform="translate(60 35) scale(.52)" fill="#151515">' + PAW + '</g></g>' +
        '<g class="pl-pin-paw"><g transform="translate(60 -6) rotate(180) scale(1.15)" class="fg">' + PAW + '</g></g>';
      return { vb: '0 0 120 96', body: g, calm: '.pl-pin-g' };
    },
    tap: function () {
      var g = '<ellipse class="pl-tap-ring" cx="16" cy="26" rx="11" ry="3.5" fill="none" stroke="currentColor" stroke-width="1.6"/>' +
        '<g class="pl-tap-paw"><g class="tp" transform="translate(16 15) scale(.95)">' + PAW + '</g></g>';
      return { vb: '0 0 32 32', body: g };
    }
  };

  function create(o) {
    o = o || {};
    var variant = ART[o.variant] ? o.variant : 'chase';
    var size = /^(sm|md|lg)$/.test(o.size) ? o.size : 'md';
    var label = o.label || 'Loading…';
    var lang = o.lang === 'fil' ? 'fil' : 'en';
    var art = ART[variant]();
    var el = document.createElement('div');
    el.className = 'pl pl-' + variant + ' pl-' + size;
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    var svg = '<svg xmlns="' + NS + '" viewBox="' + art.vb + '" aria-hidden="true" focusable="false">' + art.body + '</svg>';
    el.innerHTML = '<span class="pl-sr">' + escapeHtml(label) + '</span>' + svg + '<div class="pl-cap" aria-hidden="true">' + escapeHtml(label) + '</div>';
    if (art.calm) { var t = el.querySelector(art.calm); if (t) t.classList.add('pl-calm-target'); }
    if (variant === 'paws') el.querySelectorAll('.pl-paw').forEach(function (p) { p.classList.add('pl-calm-target'); });

    // rotating visible captions (the screen-reader text above stays stable, so it is not spammed)
    var msgs = o.messages === false ? null : (o.messages || (size === 'lg' ? MESSAGES[lang] : null));
    var timer = null;
    if (msgs && msgs.length > 1 && size === 'lg' && variant !== 'tap') {
      var cap = el.querySelector('.pl-cap'), i = 0;
      cap.textContent = msgs[0];
      timer = setInterval(function () {
        cap.classList.add('pl-swap');
        setTimeout(function () { i = (i + 1) % msgs.length; cap.textContent = msgs[i]; cap.classList.remove('pl-swap'); }, 220);
      }, 2500);
    }
    el._plStop = function () { if (timer) clearInterval(timer); timer = null; };
    return el;
  }

  function show(host, o) {
    o = o || {};
    var delay = o.delayMs == null ? 200 : o.delayMs, minMs = o.minMs == null ? 400 : o.minMs;
    var el = null, shownAt = 0, tShow, tHide, tTimeout, done = false;
    tShow = setTimeout(function () {
      if (done) return;
      el = create(o); host.appendChild(el); shownAt = Date.now();
    }, delay);
    if (o.timeoutMs) tTimeout = setTimeout(function () {
      if (done || !el) return;
      el._plStop();
      el.querySelector('.pl-sr').textContent = o.timeoutText || 'This is taking longer than usual.';
      var cap = el.querySelector('.pl-cap'); cap.removeAttribute('aria-hidden'); cap.textContent = o.timeoutText || 'This is taking longer than usual.';
      if (o.onRetry) {
        var b = document.createElement('button'); b.type = 'button'; b.className = 'pl-retry'; b.textContent = 'Try again';
        b.onclick = function () { ctl.hide(); o.onRetry(); }; el.appendChild(b);
      }
    }, o.timeoutMs);
    var ctl = {
      get el() { return el; },
      hide: function () {
        if (done) return; done = true; clearTimeout(tShow); clearTimeout(tTimeout);
        if (!el) return;                                   // never became visible (fast response): no flicker
        var wait = Math.max(0, minMs - (Date.now() - shownAt));
        tHide = setTimeout(function () { el._plStop(); if (el.parentNode) el.parentNode.removeChild(el); }, wait);
      }
    };
    return ctl;
  }
  function escapeHtml(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  return { create: create, show: show, messages: MESSAGES };
});


