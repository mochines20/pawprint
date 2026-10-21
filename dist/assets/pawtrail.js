/*! PawTrail for Pawprint – a trail of cat footprints that appears on the page as you scroll.
 *  Vanilla, no dependencies. Footprints live in the page background, wander left and right,
 *  and "stamp" in when they scroll into view. Respects prefers-reduced-motion. Hidden when printing.
 *
 *    PawTrail.init({ color:'#151515', accent:'#FFB400', opacity:.09 })   // returns { refresh(), destroy() }
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.PawTrail = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  var CSS =
    '.pt-layer{position:absolute;left:0;top:0;width:100%;pointer-events:none;overflow:hidden;contain:layout paint style}' +
    '.pt-p{position:absolute;left:0;top:0;width:var(--pt-s);height:var(--pt-s);margin:calc(var(--pt-s) / -2) 0 0 calc(var(--pt-s) / -2);' +
      'opacity:0;transform:rotate(var(--r)) scale(.4);will-change:transform,opacity;fill:var(--pt-c)}' +
    '.pt-p.pt-a{fill:var(--pt-a)}' +
    '.pt-p.pt-in{animation:pt-stamp .55s cubic-bezier(.3,.7,.3,1) both}' +
    '.pt-p.pt-retrace{animation:pt-retrace .48s cubic-bezier(.3,.7,.3,1) both}' +
    '.pt-p.pt-now{opacity:var(--o);transform:rotate(var(--r)) scale(1);animation:none}' +
    '.pt-p.pt-walking{animation:pt-walk .52s ease-in-out infinite alternate}' +
    '@keyframes pt-stamp{0%{opacity:0;transform:rotate(var(--r)) scale(.4)}60%{opacity:var(--o);transform:rotate(var(--r)) scale(1.18)}100%{opacity:var(--o);transform:rotate(var(--r)) scale(1)}}' +
    '@keyframes pt-retrace{0%{opacity:0;transform:translateY(7px) rotate(var(--r)) scale(.55)}65%{opacity:var(--o);transform:translateY(-2px) rotate(var(--r)) scale(1.08)}100%{opacity:var(--o);transform:rotate(var(--r)) scale(1)}}' +
    '@keyframes pt-walk{0%{transform:rotate(var(--r)) translateY(1px) scale(.94)}100%{transform:rotate(var(--r)) translateY(-3px) scale(1.04)}}' +
    '@media (prefers-reduced-motion:reduce){.pt-p{opacity:var(--o);transform:rotate(var(--r)) scale(1);animation:none!important}}' +
    '@media print{.pt-layer{display:none}}';

  var PAW = '<ellipse cx="0" cy="4.5" rx="8.6" ry="7.4"/><ellipse cx="-10.5" cy="-3.6" rx="3.6" ry="4.6" transform="rotate(-24 -10.5 -3.6)"/>' +
    '<ellipse cx="-3.8" cy="-9.4" rx="3.6" ry="4.8"/><ellipse cx="3.8" cy="-9.4" rx="3.6" ry="4.8"/>' +
    '<ellipse cx="10.5" cy="-3.6" rx="3.6" ry="4.6" transform="rotate(24 10.5 -3.6)"/>';
  var SVGNS = 'http://www.w3.org/2000/svg';

  // small deterministic pseudo-random so the trail is the same on every visit and after resizes
  function rnd(i) { var x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
  function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }

  function init(userOpts) {
    var doc = document;
    if (!doc || !doc.body) return null;
    var o = {
      parent: doc.body, color: '#151515', accent: '#FFB400',
      opacity: 0.12, accentOpacity: 0.4, accentEvery: 8,
      size: null,            // px; default adapts to screen width
      step: null,            // px between footprints; default adapts to screen height
      amplitude: 0.30,       // how far the path wanders (fraction of page width)
      wavelength: 1.9,       // path wave length in viewport heights
      startAt: 0,            // px from the top where the trail starts
      endBefore: 0,          // px kept free at the bottom (e.g. footer height)
      behind: true,          // z-index:-1 (behind content). Set false to paint above non-positioned content
      zIndex: null
    };
    for (var k in (userOpts || {})) if (userOpts[k] !== undefined) o[k] = userOpts[k];

    if (!doc.getElementById('pt-css')) {
      var st = doc.createElement('style'); st.id = 'pt-css'; st.textContent = CSS; doc.head.appendChild(st);
    }
    var layer = doc.createElement('div');
    layer.className = 'pt-layer'; layer.setAttribute('aria-hidden', 'true');
    layer.style.zIndex = o.zIndex != null ? String(o.zIndex) : (o.behind ? '-1' : '0');
    layer.style.setProperty('--pt-c', o.color); layer.style.setProperty('--pt-a', o.accent);
    o.parent.appendChild(layer);

    var io = null, destroyed = false, rt = null, ro = null;
    var reduce = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
    var lastScrollY = window.scrollY || window.pageYOffset || 0;
    var lastDirection = 1, scrollTimer = null, scrollRaf = null, walkTimer = null, activePaw = null;

    function pawY(paw) { return parseFloat(paw.style.top || '0'); }

    function stopWalking() {
      clearTimeout(walkTimer);
      walkTimer = null;
      if (activePaw) activePaw.classList.remove('pt-walking');
      activePaw = null;
    }

    function replay(paw, reverse) {
      if (!paw || reduce) return;
      paw.classList.remove('pt-in', 'pt-retrace', 'pt-now', 'pt-walking');
      // Restart the CSS animation without a JS animation loop.
      void paw.offsetWidth;
      paw.classList.add(reverse ? 'pt-retrace' : 'pt-in');
    }

    function nearestPaw(y, direction) {
      var paws = Array.prototype.slice.call(layer.querySelectorAll('.pt-p'));
      if (!paws.length) return null;
      var vh = window.innerHeight || 800;
      var target = y + (direction > 0 ? vh * 0.78 : vh * 0.22);
      return paws.reduce(function (closest, paw) {
        return Math.abs(pawY(paw) - target) < Math.abs(pawY(closest) - target) ? paw : closest;
      }, paws[0]);
    }

    function setActivePaw(paw, reverse) {
      if (!paw) return;
      stopWalking();
      activePaw = paw;
      if (reverse) {
        replay(paw, true);
        walkTimer = setTimeout(function () {
          if (activePaw === paw) paw.classList.add('pt-walking');
        }, 500);
      } else if (!reduce) {
        paw.classList.add('pt-walking');
      }
    }

    function onScrollFrame() {
      scrollRaf = null;
      if (destroyed) return;
      var y = window.scrollY || window.pageYOffset || 0;
      var delta = y - lastScrollY;
      if (Math.abs(delta) < 1) return;
      var direction = delta > 0 ? 1 : -1;
      var directionChanged = direction !== lastDirection;
      lastDirection = direction;
      lastScrollY = y;

      var paw = nearestPaw(y, direction);
      if (paw && paw !== activePaw) {
        setActivePaw(paw, direction < 0 || directionChanged);
      } else if (paw && direction < 0 && directionChanged) {
        setActivePaw(paw, true);
      }

      clearTimeout(scrollTimer);
      scrollTimer = setTimeout(function () {
        stopWalking();
      }, 180);
    }

    function onScroll() {
      if (scrollRaf === null) scrollRaf = window.requestAnimationFrame(onScrollFrame);
    }

    function build() {
      if (io) io.disconnect();
      layer.innerHTML = '';
      var W = layer.clientWidth || doc.documentElement.clientWidth;
      var vh = window.innerHeight;
      var H = Math.max(doc.documentElement.scrollHeight, doc.body.scrollHeight);
      layer.style.height = H + 'px';
      var small = W < 640;
      var s = o.size || (small ? 22 : 28);
      var step = o.step || clamp(vh * 0.085, 56, 76);
      var amp = W * (small ? Math.min(o.amplitude, 0.26) : o.amplitude);
      var lambda = vh * o.wavelength;
      var side = Math.max(8, s * 0.62);                       // left/right foot offset from the path
      var y0 = o.startAt + 40, y1 = H - o.endBefore - 40;
      var scrollBottom = window.scrollY + vh;
      var frag = doc.createDocumentFragment(), count = 0;
      var PATH = function (y) { return W / 2 + amp * Math.sin(y / lambda * 6.2832) * (0.75 + 0.25 * Math.sin(y / (lambda * 2.7) + 1.3)); };

      for (var y = y0, i = 0; y < y1; y += step, i++) {
        var yy = y + (rnd(i) - 0.5) * step * 0.25;
        var x = PATH(yy);
        var dx = PATH(yy + 6) - PATH(yy - 6), dy = 12;      // walking down the page
        var ang = Math.atan2(dx, dy) ;                      // heading relative to "down"
        var ox = Math.cos(ang) * side * (i % 2 ? 1 : -1), oy = -Math.sin(ang) * side * (i % 2 ? 1 : -1);
        var rot = Math.atan2(dx, -dy) * 180 / Math.PI + (rnd(i + 91) - 0.5) * 14;   // paw tip points along the walk
        var el = doc.createElementNS(SVGNS, 'svg');
        el.setAttribute('viewBox', '-14 -14 28 28');
        var accent = o.accentEvery > 0 && i % o.accentEvery === o.accentEvery - 1;
        el.setAttribute('class', 'pt-p' + (accent ? ' pt-a' : ''));
        el.style.left = (x + ox).toFixed(1) + 'px'; el.style.top = (yy + oy).toFixed(1) + 'px';
        el.style.setProperty('--pt-s', s + 'px'); el.style.setProperty('--r', rot.toFixed(1) + 'deg');
        el.style.setProperty('--o', String(accent ? o.accentOpacity : o.opacity * (0.85 + rnd(i + 7) * 0.3)));
        el.innerHTML = PAW;
        if (yy < scrollBottom - vh * 0.1) el.classList.add('pt-now');    // already above the fold: no replay
        frag.appendChild(el); count++;
      }
      layer.appendChild(frag);
      lastScrollY = window.scrollY || window.pageYOffset || 0;
      stopWalking();

      if (!reduce && 'IntersectionObserver' in window) {
        io = new IntersectionObserver(function (entries) {
          entries.forEach(function (e) {
            if (e.isIntersecting) { e.target.classList.add('pt-in'); io.unobserve(e.target); }
          });
        }, { rootMargin: '0px 0px -14% 0px', threshold: 0 });
        layer.querySelectorAll('.pt-p:not(.pt-now)').forEach(function (n) { io.observe(n); });
      } else {
        layer.querySelectorAll('.pt-p').forEach(function (n) { n.classList.add('pt-now'); });
      }
      return count;
    }

    function schedule() { clearTimeout(rt); rt = setTimeout(function () { if (!destroyed) build(); }, 180); }
    var n = build();
    window.addEventListener('resize', schedule, { passive: true });
    window.addEventListener('load', schedule);
    window.addEventListener('scroll', onScroll, { passive: true });
    if ('ResizeObserver' in window) { ro = new ResizeObserver(schedule); ro.observe(doc.body); }

    return {
      el: layer, count: function () { return layer.querySelectorAll('.pt-p').length; },
      refresh: build,
      destroy: function () {
        destroyed = true; clearTimeout(rt); clearTimeout(scrollTimer); clearTimeout(walkTimer); if (scrollRaf !== null) window.cancelAnimationFrame(scrollRaf); if (io) io.disconnect(); if (ro) ro.disconnect();
        window.removeEventListener('resize', schedule); window.removeEventListener('load', schedule); window.removeEventListener('scroll', onScroll);
        if (layer.parentNode) layer.parentNode.removeChild(layer);
      }
    };
  }
  return { init: init };
});
