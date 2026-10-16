/*!
 * Pawprint Cat — a tiny scroll-reactive mascot.
 *  - hops while the page scrolls (and travels along the bottom of the screen)
 *  - when you stop: sits, then grooms, looks around, stretches, and finally sleeps
 *  - wakes up (with a little "!") when you scroll, tap, or press a key
 * No dependencies. ~10 KB. Respects prefers-reduced-motion.
 *
 * Usage:   <script src="pawprint-cat.js"></script>
 *          <script>PawprintCat.init()</script>
 */
(function (global) {
  'use strict';

  /* ------------------------------------------------------------------ art */
  // Head helper: a 3/4 view cat head facing right, drawn around (0,0), radius 32.
  function head(x, y, s, eyes, cls) {
    var e;
    if (eyes === 'closed') {
      e = '<path class="pp-lid-amber" d="M-20 3Q-11 -8 -2 3M7 3Q16 -8 25 3"/>';
    } else if (eyes === 'sleep') {
      e = '<path class="pp-lid-stone" d="M-20 -2Q-11 6 -2 -2M7 -2Q16 6 25 -2"/>';
    } else {
      e = '<g class="pp-eyes"><ellipse class="pp-eye" cx="-11" cy="-2" rx="9.5" ry="11.5"/>' +
          '<ellipse class="pp-eye" cx="16" cy="-2" rx="9.5" ry="11.5"/>' +
          '<g class="pp-pupils"><ellipse class="pp-pupil" cx="-8" cy="-2" rx="4.6" ry="9"/>' +
          '<ellipse class="pp-pupil" cx="19" cy="-2" rx="4.6" ry="9"/>' +
          '<circle class="pp-glint" cx="-9.6" cy="-6.5" r="2.2"/><circle class="pp-glint" cx="17.4" cy="-6.5" r="2.2"/></g></g>';
    }
    return '<g transform="translate(' + x + ' ' + y + ') scale(' + s + ')"><g class="pp-headanim ' + (cls || '') + '">' +
      '<g class="pp-ear-l"><path class="pp-ink pp-round" d="M-31 -8L-29 -50L-3 -28Z"/><path class="pp-inner pp-round-s" d="M-26 -14L-26 -40L-10 -27Z"/></g>' +
      '<g class="pp-ear-r"><path class="pp-ink pp-round" d="M8 -29L32 -50L34 -8Z"/><path class="pp-inner pp-round-s" d="M12 -27L28 -40L29 -14Z"/></g>' +
      '<circle class="pp-ink" r="32"/>' +
      '<g class="pp-patch" clip-path="url(#pp-c-head)"><path class="pp-orange" d="M-44 -60L10 -60L-4 -20Q-22 -2 -44 -6Z"/>' +
      '<path class="pp-black" d="M16 -60L46 -60L46 -14Q30 -20 16 -38Z"/></g>' + e +
      '<path class="pp-stone" d="M24 9Q31 6 36 10Q34 17 30 19Q25 15 24 9Z"/>' +
      '<path class="pp-line-stone" d="M30 19V23M22 25Q26 29 30 23Q34 29 38 25"/>' +
      '<path class="pp-whisk" d="M36 12L74 2M37 17L78 15M35 22L72 30"/></g></g>';
  }

  var POSES = {
    sit:
      '<g class="pp-pose pp-sit">' +
        '<path class="pp-tail pp-tail-sit pp-stroke-ink" d="M54 172C22 178 6 150 22 126"/>' +
        '<path class="pp-ink pp-breathe" d="M50 184C38 170 42 130 66 112C84 98 108 100 122 114C134 126 136 160 140 184Z"/>' +
        '<g class="pp-patch" clip-path="url(#pp-c-sit)"><path class="pp-orange" d="M30 90H92Q84 130 60 150Q40 160 30 150Z"/><path class="pp-black" d="M112 152Q132 140 150 152V192H112Z"/></g>' +
        '<path class="pp-line-inner" d="M46 172C42 150 58 134 80 142M128 146V180"/>' +
        '<ellipse class="pp-ink" cx="118" cy="181" rx="13" ry="6.5"/><ellipse class="pp-ink" cx="137" cy="181" rx="13" ry="6.5"/>' +
        head(122, 84, 1, 'open', 'pp-look-target') +
      '</g>',
    jump:
      '<g class="pp-pose pp-jump">' +
        '<path class="pp-stroke-ink pp-tail-jump" d="M52 104C24 98 12 72 28 52"/>' +
        '<path class="pp-stroke-ink" d="M72 112L30 134M78 118L44 148"/>' +
        '<ellipse class="pp-ink" cx="102" cy="108" rx="56" ry="25" transform="rotate(-16 102 108)"/>' +
        '<g class="pp-patch" clip-path="url(#pp-c-jump)"><path class="pp-orange" d="M44 84Q70 76 96 92Q92 132 56 134Z"/><path class="pp-black" d="M114 76Q142 86 152 100L142 132L120 126Z"/></g>' +
        '<path class="pp-stroke-ink" d="M136 106L172 130M128 114L160 142"/>' +
        '<circle class="pp-ink" cx="30" cy="134" r="7"/><circle class="pp-ink" cx="44" cy="148" r="7"/>' +
        '<circle class="pp-ink" cx="172" cy="130" r="7"/><circle class="pp-ink" cx="160" cy="142" r="7"/>' +
        head(150, 74, 0.9, 'open') +
      '</g>',
    groom:
      '<g class="pp-pose pp-groom">' +
        '<path class="pp-tail pp-tail-sit pp-stroke-ink" d="M54 172C22 178 6 150 22 126"/>' +
        '<path class="pp-ink pp-breathe" d="M50 184C38 170 42 130 66 112C84 98 108 100 122 114C134 126 136 160 140 184Z"/>' +
        '<g class="pp-patch" clip-path="url(#pp-c-sit)"><path class="pp-orange" d="M30 90H92Q84 130 60 150Q40 160 30 150Z"/><path class="pp-black" d="M112 152Q132 140 150 152V192H112Z"/></g>' +
        '<path class="pp-line-inner" d="M46 172C42 150 58 134 80 142"/>' +
        '<ellipse class="pp-ink" cx="137" cy="181" rx="13" ry="6.5"/>' +
        head(118, 92, 1, 'closed', 'pp-groom-head') +
        '<g class="pp-lick"><path class="pp-stroke-ink" d="M122 140L138 106"/><circle class="pp-ink" cx="139" cy="104" r="9"/>' +
        '<path class="pp-line-inner" d="M134 102L144 100"/></g>' +
        '<ellipse class="pp-tongue" cx="146" cy="104" rx="4.5" ry="3"/>' +
      '</g>',
    stretch:
      '<g class="pp-pose pp-stretch">' +
        '<path class="pp-stroke-ink pp-tail-jump" d="M50 112C30 92 34 64 52 54"/>' +
        '<path class="pp-stroke-ink" d="M62 124L58 180M80 130L84 180"/>' +
        '<ellipse class="pp-ink pp-breathe" cx="98" cy="130" rx="58" ry="26" transform="rotate(20 98 130)"/>' +
        '<g class="pp-patch" clip-path="url(#pp-c-stretch)"><path class="pp-orange" d="M40 98Q80 98 96 122Q80 160 44 150Z"/><path class="pp-black" d="M112 128Q142 138 152 172L112 172Z"/></g>' +
        '<path class="pp-stroke-ink" d="M132 152L186 178M126 160L176 182"/>' +
        '<ellipse class="pp-ink" cx="58" cy="181" rx="11" ry="5.5"/><ellipse class="pp-ink" cx="84" cy="181" rx="11" ry="5.5"/>' +
        '<circle class="pp-ink" cx="186" cy="178" r="6.5"/><circle class="pp-ink" cx="176" cy="182" r="6.5"/>' +
        head(152, 146, 0.92, 'closed') +
      '</g>',
    sleep:
      '<g class="pp-pose pp-sleep">' +
        '<path class="pp-stroke-ink" d="M30 170C60 192 146 194 172 176"/>' +
        '<ellipse class="pp-ink pp-breathe" cx="98" cy="152" rx="64" ry="35"/>' +
        '<g class="pp-patch" clip-path="url(#pp-c-sleep)"><path class="pp-orange" d="M40 110H96Q90 150 70 190H40Z"/><path class="pp-black" d="M112 150Q140 140 166 160V196H120Z"/></g>' +
        '<path class="pp-line-inner" d="M50 176C46 156 62 138 86 140"/>' +
        '<ellipse class="pp-inner" cx="122" cy="181" rx="15" ry="6"/>' +
        head(146, 160, 0.86, 'sleep') +
        '<g class="pp-zs"><path class="pp-z pp-z1" d="M150 100h13l-13 15h13"/><path class="pp-z pp-z2" d="M170 82h10l-10 11h10"/>' +
        '<path class="pp-z pp-z3" d="M186 66h8l-8 9h8"/></g>' +
      '</g>'
  };

  // calico: every stroked limb/tail gets an outline twin underneath (hidden unless calico)
  Object.keys(POSES).forEach(function (k) {
    POSES[k] = POSES[k].replace(/<path class="([^"]*pp-stroke-ink[^"]*)" d="([^"]*)"\/>/g, function (m, c, d) {
      return '<path class="' + c.replace('pp-stroke-ink', 'pp-stroke-out') + '" d="' + d + '"/>' + m;
    });
  });
  var DEFS = '<defs>' +
    '<clipPath id="pp-c-head"><circle r="32"/><path d="M-31 -8L-29 -50L-3 -28Z"/><path d="M8 -29L32 -50L34 -8Z"/></clipPath>' +
    '<clipPath id="pp-c-sit"><path d="M50 184C38 170 42 130 66 112C84 98 108 100 122 114C134 126 136 160 140 184Z"/></clipPath>' +
    '<clipPath id="pp-c-jump"><ellipse cx="102" cy="108" rx="56" ry="25" transform="rotate(-16 102 108)"/></clipPath>' +
    '<clipPath id="pp-c-stretch"><ellipse cx="98" cy="130" rx="58" ry="26" transform="rotate(20 98 130)"/></clipPath>' +
    '<clipPath id="pp-c-sleep"><ellipse cx="98" cy="152" rx="64" ry="35"/></clipPath></defs>';

  var BANG =
    '<g class="pp-bang"><circle cx="154" cy="30" r="15" class="pp-bang-bg"/>' +
    '<path class="pp-bang-mark" d="M154 22V32"/><circle cx="154" cy="38" r="2" class="pp-bang-dot"/></g>';

  /* ------------------------------------------------------------------ css */
  var CSS =
    '.pp-cat{--pp-ink:#151515;--pp-inner:#2c2c2c;--pp-eye:#FFB400;--pp-stone:#8C8A84;--pp-paper:#FAF8F4;' +
    'position:fixed;left:0;bottom:calc(var(--pp-bottom,12px) + env(safe-area-inset-bottom,0px));' +
    'width:var(--pp-size,clamp(84px,24vw,128px));aspect-ratio:1;pointer-events:none;z-index:var(--pp-z,60);' +
    'will-change:transform;contain:layout style}' +
    '.pp-flip{width:100%;height:100%;position:relative}' +
    '.pp-cat[data-face="-1"] .pp-flip{transform:scaleX(-1)}' +
    '.pp-hop{width:100%;height:100%;transform-origin:50% 96%}' +
    '.pp-svg{width:100%;height:100%;display:block;overflow:visible}' +
    '.pp-shadow{position:absolute;left:18%;right:18%;bottom:1%;height:7%;border-radius:50%;background:var(--pp-ink);opacity:.14;transform-origin:50% 50%}' +
    /* colours */
    '.pp-ink{fill:var(--pp-body,var(--pp-ink))}.pp-pupil{fill:var(--pp-ink)}.pp-inner{fill:var(--pp-inner)}.pp-eye{fill:var(--pp-eye)}.pp-stone{fill:var(--pp-stone)}' +
    '.pp-glint{fill:var(--pp-paper)}.pp-tongue{fill:#e8a0a8}' +
    '.pp-stroke-ink{fill:none;stroke:var(--pp-body,var(--pp-ink));stroke-width:13;stroke-linecap:round}' +
    '.pp-stroke-ink.pp-tail,.pp-stroke-ink.pp-tail-jump{stroke:var(--pp-tailc,var(--pp-ink))}' +
    /* calico variant */
    '.pp-stroke-out,.pp-patch{display:none}' +
    '.pp-cat[data-variant="calico"]{--pp-body:#F7F1E6;--pp-tailc:#E8892B;--pp-inner:#E8A0A8;--pp-fold:#D9CDB9}' +
    '.pp-cat[data-variant="calico"] .pp-ink{stroke:#151515;stroke-width:4;stroke-linejoin:round}' +
    '.pp-cat[data-variant="calico"] .pp-pupil{stroke:none}' +
    '.pp-cat[data-variant="calico"] .pp-patch{display:block}' +
    '.pp-cat[data-variant="calico"] .pp-stroke-out{display:block;fill:none;stroke:#151515;stroke-width:17;stroke-linecap:round}' +
    '.pp-cat[data-variant="calico"] .pp-stroke-ink{stroke-width:13}' +
    '.pp-orange{fill:#E8892B}.pp-black{fill:#151515}' +
    '.pp-line-inner{fill:none;stroke:var(--pp-fold,var(--pp-inner));stroke-width:3;stroke-linecap:round}' +
    '.pp-line-stone{fill:none;stroke:var(--pp-stone);stroke-width:2.6;stroke-linecap:round;stroke-linejoin:round}' +
    '.pp-lid-amber{fill:none;stroke:var(--pp-eye);stroke-width:4.4;stroke-linecap:round}' +
    '.pp-lid-stone{fill:none;stroke:var(--pp-stone);stroke-width:4;stroke-linecap:round}' +
    '.pp-whisk{fill:none;stroke:var(--pp-ink);stroke-width:2.4;stroke-linecap:round}' +
    '.pp-round{stroke:var(--pp-ink);stroke-width:7;stroke-linejoin:round}.pp-round-s{stroke:var(--pp-inner);stroke-width:4;stroke-linejoin:round}' +
    '.pp-z{fill:none;stroke:var(--pp-stone);stroke-width:4;stroke-linecap:round;stroke-linejoin:round}' +
    '.pp-bang-bg{fill:var(--pp-eye)}.pp-bang-mark{stroke:var(--pp-ink);stroke-width:4;stroke-linecap:round}.pp-bang-dot{fill:var(--pp-ink)}' +
    /* poses: only the active one is shown */
    '.pp-pose{display:none}' +
    '.pp-cat[data-pose="sit"] .pp-sit,.pp-cat[data-pose="jump"] .pp-jump,.pp-cat[data-pose="groom"] .pp-groom,' +
    '.pp-cat[data-pose="stretch"] .pp-stretch,.pp-cat[data-pose="sleep"] .pp-sleep{display:block}' +
    '.pp-bang{display:none}.pp-cat[data-bang="1"] .pp-bang{display:block;animation:pp-bang .6s ease-out both}' +
    /* ambient motion (only runs for the visible pose) */
    '.pp-tail-sit{transform-box:fill-box;transform-origin:100% 100%;animation:pp-sway 2.8s ease-in-out infinite alternate}' +
    '.pp-tail-jump{transform-box:fill-box;transform-origin:100% 100%;animation:pp-sway 1.4s ease-in-out infinite alternate}' +
    '.pp-breathe{transform-box:fill-box;transform-origin:50% 100%;animation:pp-breathe 3.4s ease-in-out infinite}' +
    '.pp-eyes{transform-box:fill-box;transform-origin:50% 50%;animation:pp-blink 4.8s infinite}' +
    '.pp-headanim{transform-box:fill-box;transform-origin:50% 90%}' +
    '.pp-lick{transform-box:fill-box;transform-origin:30% 100%;animation:pp-lick .55s ease-in-out infinite alternate}' +
    '.pp-tongue{animation:pp-tongue .55s ease-in-out infinite alternate}' +
    '.pp-groom-head{animation:pp-nod 1.1s ease-in-out infinite}' +
    '.pp-z{animation:pp-z 3s ease-in-out infinite;opacity:0}.pp-z2{animation-delay:.9s}.pp-z3{animation-delay:1.8s}' +
    '.pp-cat[data-action="look"] .pp-look-target{animation:pp-look 2.4s ease-in-out both}' +
    '.pp-cat[data-action="look"] .pp-pupils{animation:pp-pupils 2.4s ease-in-out both}' +
    '.pp-cat[data-action="look"] .pp-ear-r{transform-box:fill-box;transform-origin:50% 100%;animation:pp-ear .5s ease-in-out 1.1s 2}' +
    /* hop + shadow (restarted from JS) */
    '.pp-hop-go{animation:pp-hop .68s cubic-bezier(.26,.66,.35,1) both}' +
    '.pp-shadow-go{animation:pp-shadow .68s ease-in-out both}' +
    '@keyframes pp-hop{0%{transform:translateY(0) scale(1.08,.92)}18%{transform:translateY(-8px) scale(.96,1.05)}' +
      '48%{transform:translateY(-48px) scale(.91,1.08)}78%{transform:translateY(-4px) scale(1.04,.96)}100%{transform:translateY(0) scale(1,1)}}' +
    '@keyframes pp-shadow{0%,100%{transform:scaleX(1);opacity:.14}48%{transform:scaleX(.62);opacity:.06}}' +
    '@keyframes pp-sway{from{transform:rotate(-7deg)}to{transform:rotate(9deg)}}' +
    '@keyframes pp-breathe{0%,100%{transform:scaleY(1)}50%{transform:scaleY(1.035)}}' +
    '@keyframes pp-blink{0%,92%,100%{transform:scaleY(1)}95%{transform:scaleY(.1)}}' +
    '@keyframes pp-lick{from{transform:rotate(-12deg) translateY(2px)}to{transform:rotate(7deg) translateY(-3px)}}' +
    '@keyframes pp-tongue{from{opacity:.2}to{opacity:1}}' +
    '@keyframes pp-nod{0%,100%{transform:rotate(0)}50%{transform:rotate(-4deg) translateY(1px)}}' +
    '@keyframes pp-z{0%{opacity:0;transform:translate(0,8px)}30%{opacity:1}100%{opacity:0;transform:translate(8px,-16px)}}' +
    '@keyframes pp-look{0%{transform:rotate(0)}25%{transform:rotate(-6deg) translateX(-3px)}55%{transform:rotate(5deg) translateX(3px)}100%{transform:rotate(0)}}' +
    '@keyframes pp-pupils{0%{transform:translateX(0)}25%{transform:translateX(-3px)}55%{transform:translateX(3px)}100%{transform:translateX(0)}}' +
    '@keyframes pp-ear{0%,100%{transform:rotate(0)}50%{transform:rotate(9deg)}}' +
    '@keyframes pp-bang{0%{opacity:0;transform:translateY(8px) scale(.6)}30%{opacity:1;transform:translateY(0) scale(1.1)}100%{opacity:1;transform:scale(1)}}' +
    '@media (prefers-reduced-motion:reduce){.pp-cat *{animation:none!important}}' +
    '@media print{.pp-cat{display:none}}';

  /* ------------------------------------------------------------- behaviour */
  var HOP_MS = 680;
  var HOP_GAP_MS = 320;
  var ACTIONS = [
    { name: 'groom', pose: 'groom', ms: 3400 },
    { name: 'look', pose: 'sit', ms: 2500 },
    { name: 'stretch', pose: 'stretch', ms: 2600 }
  ];

  function assign(a, b) { for (var k in b) if (b[k] !== undefined) a[k] = b[k]; return a; }
  function rand(a, b) { return a + Math.random() * (b - a); }
  function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }

  function injectCss(doc) {
    if (doc.getElementById('pp-cat-css')) return;
    var s = doc.createElement('style');
    s.id = 'pp-cat-css';
    s.textContent = CSS;
    doc.head.appendChild(s);
  }

  function init(userOpts) {
    var doc = global.document;
    if (!doc || !doc.body) return null;
    var o = assign({
      travel: 'across',        // 'across' = walks along the bottom as you scroll; 'corner' = stays put
      side: 'right',           // resting side when travel is 'corner'
      size: null,              // e.g. '110px'; default is responsive
      bottom: 12, margin: 10, zIndex: 60,
      sleepAfter: 14000,       // ms without any activity before the cat falls asleep
      idleAfter: 700,          // ms after scrolling stops before idle behaviour starts
      variant: 'black', ink: null, eye: null, paper: null,
      parent: doc.body
    }, userOpts || {});

    var reduce = !!(global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches);
    injectCss(doc);

    var root = doc.createElement('div');
    root.className = 'pp-cat';
    root.setAttribute('aria-hidden', 'true');
    root.setAttribute('data-pose', 'sit');
    root.setAttribute('data-face', '1');
    root.setAttribute('data-variant', o.variant === 'calico' ? 'calico' : 'black');
    root.style.setProperty('--pp-bottom', o.bottom + 'px');
    root.style.setProperty('--pp-z', String(o.zIndex));
    if (o.size) root.style.setProperty('--pp-size', o.size);
    if (o.ink) root.style.setProperty('--pp-ink', o.ink);
    if (o.eye) root.style.setProperty('--pp-eye', o.eye);
    if (o.paper) root.style.setProperty('--pp-paper', o.paper);
    root.innerHTML =
      '<div class="pp-shadow"></div><div class="pp-flip"><div class="pp-hop">' +
      '<svg class="pp-svg" viewBox="0 0 200 200" focusable="false">' +
      DEFS + POSES.sit + POSES.jump + POSES.groom + POSES.stretch + POSES.sleep + BANG +
      '</svg></div></div>';
    o.parent.appendChild(root);

    var hopEl = root.querySelector('.pp-hop');
    var shadowEl = root.querySelector('.pp-shadow');

    var timers = [];
    var idleTimer = null, scrollTimer = null, raf = null;
    var scrolling = false, hopping = false, asleep = false, destroyed = false, inAction = false;
    var nextHopAt = 0;
    var lastActivity = Date.now();
    var lastY = global.pageYOffset || 0;
    var x = 0, face = 1, lastAction = '';

    function later(fn, ms) {
      var id = global.setTimeout(function () {
        timers = timers.filter(function (t) { return t !== id; });
        if (!destroyed) fn();
      }, ms);
      timers.push(id);
      return id;
    }
    function clearTimers() {
      timers.forEach(function (t) { global.clearTimeout(t); });
      timers = [];
    }
    function setPose(p) { root.setAttribute('data-pose', p); }
    function setAction(a) { if (a) root.setAttribute('data-action', a); else root.removeAttribute('data-action'); }
    function setFace(f) { if (f !== face) { face = f; root.setAttribute('data-face', String(f)); } }
    function restart(el, cls) { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); }

    /* ---- position ---- */
    function width() { return root.offsetWidth || 96; }
    function target() {
      var vw = global.innerWidth || 360, w = width();
      var left = o.margin, right = Math.max(left, vw - w - o.margin);
      if (o.travel !== 'across' || reduce) return o.side === 'left' ? left : right;
      var de = doc.documentElement, max = Math.max(0, (de.scrollHeight || 0) - (global.innerHeight || 0));
      var p = max > 0 ? clamp((global.pageYOffset || 0) / max, 0, 1) : 0;
      return left + (right - left) * p;
    }
    function apply() { root.style.transform = 'translate3d(' + x.toFixed(1) + 'px,0,0)'; }
    function isActive() { return scrolling || Math.abs(target() - x) > 8; }
    function tick() {
      raf = null;
      var t = target(), dx = t - x;
      if (Math.abs(dx) > 0.4) {
        x += dx * 0.12;
        if (Math.abs(dx) > 3 && o.travel === 'across' && !reduce) setFace(dx > 0 ? 1 : -1);
        apply();
        raf = global.requestAnimationFrame(tick);
      } else { x = t; apply(); }
    }
    function kick() { if (raf === null) raf = global.requestAnimationFrame(tick); }

    /* ---- hop ---- */
    function hop() {
      if (hopping || asleep || destroyed || Date.now() < nextHopAt) return;
      nextHopAt = Date.now() + HOP_MS + HOP_GAP_MS;
      hopping = true; inAction = false;
      clearIdle(); setAction('');
      setPose('sit');
      restart(hopEl, 'pp-hop-go'); restart(shadowEl, 'pp-shadow-go');
      later(function () { setPose('jump'); }, 100);
      later(function () { setPose('sit'); }, 400);
      later(function () {
        hopping = false;
        later(function () { if (isActive()) hop(); else settle(); }, HOP_GAP_MS);
      }, HOP_MS);
    }

    /* ---- idle behaviour ---- */
    function clearIdle() { if (idleTimer) { global.clearTimeout(idleTimer); idleTimer = null; } }
    function settle() {
      setPose('sit'); setAction('');
      scheduleIdle(o.idleAfter);
    }
    function scheduleIdle(ms) {
      clearIdle();
      idleTimer = global.setTimeout(nextIdle, ms == null ? rand(1200, 2400) : ms);
    }
    function nextIdle() {
      idleTimer = null;
      if (destroyed || scrolling || hopping || asleep || doc.hidden) return;
      if (Date.now() - lastActivity > o.sleepAfter) return fallAsleep();
      if (reduce) return scheduleIdle(3000);
      var pool = ACTIONS.filter(function (a) { return a.name !== lastAction; });
      var a = pool[Math.floor(Math.random() * pool.length)];
      lastAction = a.name;
      play(a, function () { scheduleIdle(); });
    }
    function play(a, done) {
      inAction = true;
      setPose(a.pose); setAction(a.name);
      later(function () {
        inAction = false;
        setAction(''); setPose('sit');
        done();
      }, a.ms);
    }
    function fallAsleep() {
      play({ name: 'stretch', pose: 'stretch', ms: 2200 }, function () {
        asleep = true; setPose('sleep');
      });
    }
    function wake() {
      if (!asleep) return;
      asleep = false;
      setPose('sit'); setAction('');
      root.setAttribute('data-bang', '1');
      later(function () { root.removeAttribute('data-bang'); }, 700);
    }

    /* ---- events ---- */
    function activity() {
      lastActivity = Date.now();
      if (asleep) wake();
    }
    function onScroll() {
      var y = global.pageYOffset || 0;
      if (y === lastY) return;
      lastY = y;
      activity();
      scrolling = true;
      global.clearTimeout(scrollTimer);
      scrollTimer = global.setTimeout(function () { scrolling = false; }, 160);
      if (o.travel === 'across' && !reduce) kick(); else { x = target(); apply(); }
      if (reduce) { setPose('sit'); return; }
      if (inAction) { clearTimersOnly(); inAction = false; setAction(''); setPose('sit'); }
      if (!hopping && Date.now() >= nextHopAt) hop();
    }
    function clearTimersOnly() { clearTimers(); }
    function onResize() { x = target(); apply(); }
    function onVisibility() {
      if (doc.hidden) { clearIdle(); } else if (!hopping && !asleep && !inAction) { scheduleIdle(1000); }
    }

    var opts = { passive: true };
    global.addEventListener('scroll', onScroll, opts);
    global.addEventListener('resize', onResize, opts);
    global.addEventListener('touchstart', activity, opts);
    global.addEventListener('pointerdown', activity, opts);
    global.addEventListener('keydown', activity, opts);
    doc.addEventListener('visibilitychange', onVisibility);

    x = target(); apply();
    scheduleIdle(1500);

    return {
      el: root,
      state: function () {
        return { pose: root.getAttribute('data-pose'), action: root.getAttribute('data-action'), asleep: asleep, hopping: hopping, x: x, face: face };
      },
      hop: hop,
      destroy: function () {
        destroyed = true; clearTimers(); clearIdle();
        global.clearTimeout(scrollTimer);
        if (raf !== null) global.cancelAnimationFrame(raf);
        global.removeEventListener('scroll', onScroll);
        global.removeEventListener('resize', onResize);
        global.removeEventListener('touchstart', activity);
        global.removeEventListener('pointerdown', activity);
        global.removeEventListener('keydown', activity);
        doc.removeEventListener('visibilitychange', onVisibility);
        if (root.parentNode) root.parentNode.removeChild(root);
      }
    };
  }

  var api = { init: init, _poses: POSES, _css: CSS, _bang: BANG };
  if (typeof module === 'object' && module.exports) module.exports = api;
  global.PawprintCat = api;
})(typeof window !== 'undefined' ? window : globalThis);
