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
  // ---- smooth cartoon art -------------------------------------------------
  var HEAD_PATH = 'M-33 -2C-34 -22 -20 -32 0 -32C20 -32 34 -22 33 -2C39 6 35 19 22 26C12 32 -12 32 -22 26C-35 19 -39 6 -33 -2Z';
  var BODY_SIT = 'M46 186C30 168 38 128 64 112C82 100 108 100 122 114C138 130 138 164 144 186C122 191 68 191 46 186Z';
  var BODY_JUMP = 'M42 110C48 90 82 82 112 88C134 92 150 102 154 114C148 126 130 132 110 131C84 136 52 130 42 110Z';
  var BODY_STRETCH = 'M34 120C36 98 66 94 90 108C110 120 128 136 142 150C132 166 110 166 92 154C70 142 38 144 34 120Z';
  var BODY_SLEEP = 'M34 164C28 140 56 118 96 118C136 118 164 138 160 166C156 185 120 193 94 193C64 193 40 185 34 164Z';

  function head(x, y, s, eyes, cls) {
    var e;
    if (eyes === 'closed') {
      e = '<path class="pp-lid-amber" d="M-21 4Q-11 -9 -1 4M6 4Q16 -9 26 4"/>';
    } else if (eyes === 'sleep') {
      e = '<path class="pp-lid-stone" d="M-21 -2Q-11 8 -1 -2M6 -2Q16 8 26 -2"/>';
    } else if (eyes === 'sad') {
      e = '<g class="pp-eyes"><ellipse class="pp-eye" cx="-11" cy="-1" rx="10.5" ry="12"/><ellipse class="pp-eye" cx="17" cy="-1" rx="10.5" ry="12"/>' +
          '<ellipse class="pp-pupil" cx="-10" cy="1" rx="5.4" ry="9.5"/><ellipse class="pp-pupil" cx="18" cy="1" rx="5.4" ry="9.5"/>' +
          '<circle class="pp-glint" cx="-12" cy="-4" r="3"/><circle class="pp-glint" cx="16" cy="-4" r="3"/></g>' +
          '<path class="pp-lidsad" d="M-23 -18L1 -18L1 -14L-23 -4ZM5.5 -18L29 -18L29 -4L5.5 -14Z"/>' +
          '<path class="pp-tear" d="M-20 12Q-24 19 -20 22Q-16 19 -20 12Z"/>';
    } else {
      e = '<g class="pp-eyes"><ellipse class="pp-eye" cx="-11" cy="-3" rx="10.5" ry="12.5"/>' +
          '<ellipse class="pp-eye" cx="17" cy="-3" rx="10.5" ry="12.5"/>' +
          '<path class="pp-lidshade" d="M-21.5 -3A10.5 12.5 0 0 1 -0.5 -3Q-11 -11 -21.5 -3ZM6.5 -3A10.5 12.5 0 0 1 27.5 -3Q17 -11 6.5 -3Z"/>' +
          '<g class="pp-pupils"><ellipse class="pp-pupil" cx="-8" cy="-3" rx="5" ry="10"/>' +
          '<ellipse class="pp-pupil" cx="20" cy="-3" rx="5" ry="10"/>' +
          '<circle class="pp-glint" cx="-10.5" cy="-8" r="3"/><circle class="pp-glint" cx="17.5" cy="-8" r="3"/>' +
          '<circle class="pp-glint" cx="-5.5" cy="2" r="1.4"/><circle class="pp-glint" cx="22.5" cy="2" r="1.4"/></g></g>';
    }
    return '<g transform="translate(' + x + ' ' + y + ') scale(' + s + ')"><g class="pp-headanim ' + (cls || '') + '">' +
      '<g class="pp-ear-l"><path class="pp-ink pp-round" d="M-31 -8C-35 -28 -33 -42 -29 -52C-19 -47 -9 -40 -3 -30Z"/><path class="pp-inner pp-round-s" d="M-26 -15C-28 -28 -27 -37 -26 -42C-20 -39 -14 -35 -10 -29Z"/></g>' +
      '<g class="pp-ear-r"><path class="pp-ink pp-round" d="M7 -29C13 -38 22 -46 30 -52C34 -42 35 -26 31 -9Z"/><path class="pp-inner pp-round-s" d="M12 -28C17 -34 23 -39 28 -43C30 -36 30 -24 28 -15Z"/></g>' +
      '<path class="pp-collar-out" d="M-23 24Q2 46 25 25"/><path class="pp-collar" d="M-23 24Q2 46 25 25"/>' +
      '<path class="pp-amber pp-charm" d="M3 55C-4 47 -6 42 -6 39A9 9 0 1 1 12 39C12 42 10 47 3 55Z"/><circle class="pp-pupil" cx="3" cy="39" r="3"/>' +
      '<path class="pp-ink" d="' + HEAD_PATH + '"/>' +
      '<path class="pp-hi" d="M-24 -21Q-8 -29 10 -27"/>' +
      '<g class="pp-stripe" clip-path="url(#pp-c-head)"><path d="M-8 -34V-20M0 -35V-17M8 -34V-20M-37 4L-24 6M-36 13L-24 11M37 4L24 6M36 13L24 11"/></g>' +
      '<g class="pp-patch" clip-path="url(#pp-c-head)"><path class="pp-orange" d="M-44 -60L10 -60L-4 -20Q-22 -2 -44 -6Z"/>' +
      '<path class="pp-black" d="M16 -60L46 -60L46 -14Q30 -20 16 -38Z"/></g>' + e +
      '<ellipse class="pp-blush" cx="-22" cy="13" rx="7" ry="4"/>' +
      '<path class="pp-stone" d="M25 9Q31 6.5 36 9.5Q34.5 16 30.5 18Q26 15 25 9Z"/>' +
      '<path class="pp-line-stone" d="M30.5 18V22M23 24Q27 29 30.5 22.5Q34 29 38 24"/>' +
      '<path class="pp-whisk" d="M37 11Q54 3 70 5M38 16Q57 14 74 19M36 21Q52 27 66 35"/></g></g>';
  }

  var SIT_BODY =
    '<path class="pp-ink pp-breathe" d="' + BODY_SIT + '"/>' +
    '<path class="pp-hi" d="M58 122Q72 106 98 104"/>' +
    '<g class="pp-stripe" clip-path="url(#pp-c-sit)"><path d="M44 126l24 6M48 142l22 4M60 112l22 14M80 104l20 14"/></g><g class="pp-patch" clip-path="url(#pp-c-sit)"><path class="pp-orange" d="M30 90H92Q84 130 60 150Q40 160 30 150Z"/><path class="pp-black" d="M112 152Q132 140 150 152V192H112Z"/></g>' +
    '' +
    '<path class="pp-line-inner" d="M44 174C42 150 58 134 82 142"/>';
  var SIT_TAIL = '<path class="pp-tail pp-tail-sit pp-stroke-ink" d="M52 176C22 182 6 154 20 126"/>';

  var POSES = {
    sit:
      '<g class="pp-pose pp-sit">' + SIT_TAIL + SIT_BODY +
        '<path class="pp-ink pp-leg" d="M108 134C106 156 108 172 106 183C105 190 128 191 129 183C129 170 131 154 131 140Z"/>' +
        '<path class="pp-line-inner" d="M121 150V180"/>' +
        '<ellipse class="pp-ink" cx="138" cy="183" rx="13" ry="6.5"/>' +
        head(119, 90, 1.2, 'open', 'pp-look-target') +
      '</g>',
    sad:
      '<g class="pp-pose pp-sad">' +
        '<path class="pp-tail pp-tail-sad pp-stroke-ink" d="M54 178C30 192 8 188 4 168"/>' + SIT_BODY +
        '<path class="pp-ink pp-leg" d="M108 134C106 156 108 172 106 183C105 190 128 191 129 183C129 170 131 154 131 140Z"/>' +
        '<ellipse class="pp-ink" cx="138" cy="183" rx="13" ry="6.5"/>' +
        '<g transform="rotate(7 119 104)">' + head(117, 100, 1.2, 'sad', 'pp-sad-head') + '</g>' +
      '</g>',
    jump:
      '<g class="pp-pose pp-jump">' +
        '<path class="pp-stroke-ink pp-tail-jump" d="M48 106C24 104 12 86 20 62C23 54 28 50 34 50"/>' +
        '<path class="pp-ink" d="M56 108C44 114 32 122 22 132C15 139 21 150 31 147C44 143 58 134 72 126Z"/>' +
        '<path class="pp-ink" d="M60 116C52 126 44 136 38 148C34 156 44 160 50 154C58 146 70 134 78 124Z"/>' +
        '<path class="pp-ink" d="' + BODY_JUMP + '"/>' +
        '<path class="pp-hi" d="M58 96Q84 86 114 92"/>' +
        '<g class="pp-stripe" clip-path="url(#pp-c-jump)"><path d="M56 100l8 28M72 94l8 36M88 90l8 40M104 92l6 38"/></g><g class="pp-patch" clip-path="url(#pp-c-jump)"><path class="pp-orange" d="M44 84Q70 76 96 92Q92 132 56 134Z"/><path class="pp-black" d="M114 76Q142 86 156 100L146 132L120 126Z"/></g>' +
        '<path class="pp-ink" d="M130 106C146 110 160 117 172 124C181 129 178 140 168 139C156 137 142 129 128 123Z"/>' +
        '<path class="pp-ink" d="M124 116C138 124 150 134 158 144C163 151 156 158 149 153C140 147 130 138 120 128Z"/>' +
        head(150, 74, 1.06, 'open') +
      '</g>',
    groom:
      '<g class="pp-pose pp-groom">' + SIT_TAIL + SIT_BODY +
        '<ellipse class="pp-ink" cx="138" cy="183" rx="13" ry="6.5"/>' +
        head(117, 96, 1.2, 'closed', 'pp-groom-head') +
        '<g class="pp-lick"><path class="pp-stroke-ink" d="M122 142L138 108"/><circle class="pp-ink" cx="139" cy="105" r="9.5"/>' +
        '<path class="pp-line-inner" d="M134 103L144 101"/></g>' +
        '<ellipse class="pp-tongue" cx="146" cy="105" rx="4.5" ry="3"/>' +
      '</g>',
    stretch:
      '<g class="pp-pose pp-stretch">' +
        '<path class="pp-stroke-ink pp-tail-jump" d="M44 112C24 94 28 66 48 54"/>' +
        '<path class="pp-ink" d="M46 118C42 142 48 164 50 178C50 184 72 184 72 178C70 162 70 140 76 122Z"/>' +
        '<path class="pp-ink" d="M62 124C60 146 66 164 70 178C71 184 92 184 90 177C86 160 84 142 88 126Z"/>' +
        '<path class="pp-ink pp-breathe" d="' + BODY_STRETCH + '"/>' +
        '<path class="pp-hi" d="M42 112Q64 100 88 112"/>' +
        '<g class="pp-stripe" clip-path="url(#pp-c-stretch)"><path d="M46 100l12 40M62 100l14 36M80 108l12 30M98 120l12 30"/></g><g class="pp-patch" clip-path="url(#pp-c-stretch)"><path class="pp-orange" d="M40 98Q80 98 96 122Q80 160 44 150Z"/><path class="pp-black" d="M112 128Q142 138 152 172L112 172Z"/></g>' +
        '<path class="pp-ink" d="M126 148C146 158 166 168 182 175C190 179 186 187 177 187C160 185 138 177 120 164Z"/>' +
        '<path class="pp-ink" d="M118 156C136 168 154 176 170 182C177 185 174 192 166 192C150 190 130 182 112 170Z"/>' +
        head(150, 142, 1.06, 'closed') +
      '</g>',
    sleep:
      '<g class="pp-pose pp-sleep">' +
        '<path class="pp-ink pp-breathe" d="' + BODY_SLEEP + '"/>' +
        '<path class="pp-hi" d="M50 138Q76 120 108 124"/>' +
        '<g class="pp-stripe" clip-path="url(#pp-c-sleep)"><path d="M56 128l8 44M72 122l8 48M88 120l8 50M104 122l6 46"/></g><g class="pp-patch" clip-path="url(#pp-c-sleep)"><path class="pp-orange" d="M40 110H96Q90 150 70 190H40Z"/><path class="pp-black" d="M112 150Q140 140 166 160V196H120Z"/></g>' +
        '<path class="pp-stroke-ink" d="M34 168C42 192 104 200 158 186"/>' +
        '<path class="pp-line-inner" d="M52 176C48 156 64 138 88 140"/>' +
        '<ellipse class="pp-inner" cx="122" cy="182" rx="15" ry="6"/>' +
        head(144, 158, 0.98, 'sleep') +
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
    '<clipPath id="pp-c-head"><path d="' + HEAD_PATH + '"/><path d="M-31 -8C-35 -28 -33 -42 -29 -52C-19 -47 -9 -40 -3 -30Z"/><path d="M7 -29C13 -38 22 -46 30 -52C34 -42 35 -26 31 -9Z"/></clipPath>' +
    '<clipPath id="pp-c-sit"><path d="' + BODY_SIT + '"/></clipPath>' +
    '<clipPath id="pp-c-jump"><path d="' + BODY_JUMP + '"/></clipPath>' +
    '<clipPath id="pp-c-stretch"><path d="' + BODY_STRETCH + '"/></clipPath>' +
    '<clipPath id="pp-c-sleep"><path d="' + BODY_SLEEP + '"/></clipPath></defs>';

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
    '.pp-cat[data-outline]{--pp-body:#F7F1E6;--pp-tailc:#E8892B;--pp-inner:#E8A0A8;--pp-fold:#D9CDB9}' +
    '.pp-cat[data-variant="orange"]{--pp-body:#F59A2E;--pp-tailc:#E5841A;--pp-inner:#F4A6A0;--pp-fold:#D77A12}' +
    '.pp-cat[data-variant="orange"] .pp-eye{fill:#FFE680;stroke:#151515;stroke-width:2.2}' +
    '.pp-stripe{display:none}.pp-cat[data-variant="orange"] .pp-stripe{display:block}.pp-stripe path{fill:none;stroke:#C9660F;stroke-width:5;stroke-linecap:round}' +
    '.pp-lidsad{fill:var(--pp-body,var(--pp-ink));stroke:none}.pp-tear{fill:#7CC4F2;stroke:#151515;stroke-width:1.2;display:none}.pp-cat[data-pose="sad"] .pp-tear{display:block;animation:pp-tear 2.4s ease-in infinite}' +
    '.pp-tail-sad{transform-box:fill-box;transform-origin:100% 0%;animation:pp-sway 3.6s ease-in-out infinite alternate}' +
    '.pp-sad .pp-ear-l{transform-box:fill-box;transform-origin:100% 100%;transform:rotate(-16deg)}.pp-sad .pp-ear-r{transform-box:fill-box;transform-origin:0% 100%;transform:rotate(16deg)}' +
    '.pp-cat[data-pose="sad"] .pp-breathe{animation-duration:5s}' +
    '@keyframes pp-tear{0%{transform:translateY(-3px);opacity:0}15%{opacity:1}100%{transform:translateY(14px);opacity:0}}' +
    '.pp-static{position:relative;left:auto;bottom:auto;transform:none;display:inline-block;will-change:auto}' +
    '.pp-cat[data-outline] .pp-ink{stroke:#151515;stroke-width:4;stroke-linejoin:round}' +
    '.pp-cat[data-outline] .pp-pupil{stroke:none}' +
    '.pp-cat[data-variant="calico"] .pp-patch{display:block}' +
    '.pp-cat[data-outline] .pp-stroke-out{display:block;fill:none;stroke:#151515;stroke-width:17;stroke-linecap:round}' +
    '.pp-cat[data-outline] .pp-stroke-ink{stroke-width:13}' +
    '.pp-rim{fill:none;stroke:var(--pp-eye);stroke-opacity:.55;stroke-width:2.4;stroke-linecap:round}.pp-cat[data-outline] .pp-rim{display:none}' +
    '.pp-collar{fill:none;stroke:var(--pp-eye);stroke-width:7;stroke-linecap:round}.pp-amber{fill:var(--pp-eye)}.pp-lidshade{fill:#C98400;opacity:.55}' +
    '.pp-cat[data-outline] .pp-charm{stroke:#151515;stroke-width:2.5;stroke-linejoin:round}.pp-collar-out{display:none}.pp-cat[data-outline] .pp-collar-out{display:block;fill:none;stroke:#151515;stroke-width:11.5;stroke-linecap:round}' +
    '.pp-hi{fill:none;stroke:var(--pp-hi,#3d3d3d);stroke-width:3;stroke-linecap:round}.pp-blush{fill:#e8a0a8;opacity:.0}.pp-cat[data-outline] .pp-hi{display:none}.pp-cat[data-outline] .pp-blush{opacity:.55}' +
    '.pp-cat[data-outline] .pp-leg{stroke:none}' +
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
    '.pp-cat[data-pose="stretch"] .pp-stretch,.pp-cat[data-pose="sleep"] .pp-sleep,.pp-cat[data-pose="sad"] .pp-sad{display:block}' +
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
    '.pp-hop-go{animation:pp-hop .56s cubic-bezier(.3,.6,.4,1) both}' +
    '.pp-shadow-go{animation:pp-shadow .56s ease-in-out both}' +
    '@keyframes pp-hop{0%{transform:translateY(0) scale(1.1,.88)}20%{transform:translateY(-12px) scale(.93,1.1)}' +
      '52%{transform:translateY(-58px) scale(.9,1.12)}84%{transform:translateY(0) scale(1.12,.86)}100%{transform:translateY(0) scale(1,1)}}' +
    '@keyframes pp-shadow{0%,100%{transform:scaleX(1);opacity:.14}52%{transform:scaleX(.55);opacity:.06}}' +
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
  var HOP_MS = 560;
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

  function applyVariant(el, v) {
    v = (v === 'calico' || v === 'orange') ? v : 'black';
    el.setAttribute('data-variant', v);
    if (v === 'black') el.removeAttribute('data-outline'); else el.setAttribute('data-outline', '1');
  }

  // Static (non-scrolling) cat for badges/avatars. render({parent,variant,pose,size}) -> {el,set(opts),destroy()}
  function render(userOpts) {
    var doc = global.document;
    if (!doc) return null;
    var o = assign({ variant: 'black', pose: 'sit', size: '120px', parent: doc.body, face: 1 }, userOpts || {});
    injectCss(doc);
    var el = doc.createElement('div');
    el.className = 'pp-cat pp-static';
    el.setAttribute('aria-hidden', 'true');
    el.setAttribute('data-face', String(o.face));
    el.style.setProperty('--pp-size', o.size);
    el.innerHTML = '<div class="pp-flip"><div class="pp-hop"><svg class="pp-svg" viewBox="0 0 200 200" focusable="false">' +
      DEFS + POSES.sit + POSES.jump + POSES.groom + POSES.stretch + POSES.sleep + POSES.sad + BANG + '</svg></div></div>';
    function set(n) {
      if (n.variant) applyVariant(el, n.variant);
      if (n.pose) el.setAttribute('data-pose', n.pose);
    }
    set(o);
    o.parent.appendChild(el);
    return { el: el, set: set, destroy: function () { if (el.parentNode) el.parentNode.removeChild(el); } };
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
    applyVariant(root, o.variant);
    root.style.setProperty('--pp-bottom', o.bottom + 'px');
    root.style.setProperty('--pp-z', String(o.zIndex));
    if (o.size) root.style.setProperty('--pp-size', o.size);
    if (o.ink) root.style.setProperty('--pp-ink', o.ink);
    if (o.eye) root.style.setProperty('--pp-eye', o.eye);
    if (o.paper) root.style.setProperty('--pp-paper', o.paper);
    root.innerHTML =
      '<div class="pp-shadow"></div><div class="pp-flip"><div class="pp-hop">' +
      '<svg class="pp-svg" viewBox="0 0 200 200" focusable="false">' +
      DEFS + POSES.sit + POSES.jump + POSES.groom + POSES.stretch + POSES.sleep + POSES.sad + BANG +
      '</svg></div></div>';
    o.parent.appendChild(root);

    var hopEl = root.querySelector('.pp-hop');
    var shadowEl = root.querySelector('.pp-shadow');

    var timers = [];
    var idleTimer = null, scrollTimer = null, raf = null;
    var scrolling = false, hopping = false, asleep = false, destroyed = false, inAction = false;
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
      if (hopping || asleep || destroyed) return;
      hopping = true; inAction = false;
      clearIdle(); setAction('');
      setPose('sit');
      restart(hopEl, 'pp-hop-go'); restart(shadowEl, 'pp-shadow-go');
      later(function () { setPose('jump'); }, 100);
      later(function () { setPose('sit'); }, 400);
      later(function () {
        hopping = false;
        if (isActive()) hop(); else settle();
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
      if (!hopping) hop();
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

  var api = { init: init, render: render, _poses: POSES, _css: CSS, _bang: BANG };
  if (typeof module === 'object' && module.exports) module.exports = api;
  global.PawprintCat = api;
})(typeof window !== 'undefined' ? window : globalThis);
