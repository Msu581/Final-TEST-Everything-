/* ============================================================
   VERIFICATION SUITE — season.js
   Seasonal background layer. ADD-ON ONLY.

   This file does not touch authentication. It never reads or
   writes the session keys, never listens on #loginForm, and
   never changes an input, a handler or a redirect. It only:

     - decides which SEASON and which TIME OF DAY to show
     - builds a scene behind the sign-in panel
     - drifts a few leaves / petals / flakes over the portal
     - watches #login and #app to know which screen is up

   Contents
     1. Season resolution      (random / current / manual)
     2. Time-of-day resolution (clock -> five bands)
     3. Particle configuration (per season)
     4. Tree artwork
     4b. Scene life (clouds, birds, butterflies, balloon, gusts,
         fireflies, distant treeline, ground dressing)
     5. Scene + portal mounting
     6. Season picker
     7. Screen watcher + clock tick
   ============================================================ */

(function () {
  "use strict";

  var root = document.documentElement;
  var REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var SEASONS = ["spring", "summer", "autumn", "winter"];


  /* ==========================================================
     1. SEASON RESOLUTION
     ========================================================== */

  /* Calendar season from the month.
     Mar-May spring · Jun-Aug summer · Sep-Nov autumn · Dec-Feb winter */
  function seasonFromDate(date) {
    var month = date.getMonth() + 1;
    if (month >= 3 && month <= 5)  return "spring";
    if (month >= 6 && month <= 8)  return "summer";
    if (month >= 9 && month <= 11) return "autumn";
    return "winter";
  }

  /* Rolled ONCE, when the page loads. "Random" therefore stays
     put for the whole visit — signing in does not reshuffle it —
     and a refresh produces a new draw. */
  var randomDraw = SEASONS[Math.floor(Math.random() * SEASONS.length)];

  /* mode is one of: random | current | spring | summer | autumn | winter
     It is deliberately not persisted: a reload returns to Current season. */
  var mode = "current";

  function resolveSeason() {
    if (mode === "random")  return randomDraw;
    if (mode === "current") return seasonFromDate(new Date());
    return mode;
  }


  /* ==========================================================
     2. TIME-OF-DAY RESOLUTION
     Follows the computer's local clock and is completely
     independent of the season: any season can be shown at any
     hour, and the hour never overrides the season.
     ========================================================== */

  /* 05:00-07:59 sunrise · 08:00-11:59 morning · 12:00-16:59
     afternoon · 17:00-19:59 evening · 20:00-04:59 night */
  function timeOfDay(date) {
    var hour = date.getHours();
    if (hour >= 5  && hour < 8)  return "sunrise";
    if (hour >= 8  && hour < 12) return "morning";
    if (hour >= 12 && hour < 17) return "afternoon";
    if (hour >= 17 && hour < 20) return "evening";
    return "night";
  }


  /* ==========================================================
     3. PARTICLE CONFIGURATION
     Counts are kept low on purpose: the whole scene stays well
     under a hundred nodes so an office laptop does not notice.
     ========================================================== */

  var PARTICLES = {
    spring: { shape: "petal", login: 22, portal: 9,
              size: [7, 15],  fall: [10, 18], drift: [40, 150], spin: [5, 11], alpha: [.55, .95] },
    summer: { shape: "leaf",  login: 10, portal: 5,
              size: [9, 16],  fall: [14, 23], drift: [25, 110], spin: [7, 14], alpha: [.45, .8]  },
    autumn: { shape: "leaf",  login: 28, portal: 12,
              size: [10, 21], fall: [8, 16],  drift: [70, 230], spin: [3, 8],  alpha: [.7, 1]    },
    winter: { shape: "snow",  login: 26, portal: 16,
              size: [4, 11],  fall: [12, 22], drift: [25, 95],  spin: [8, 14], alpha: [.6, 1]    }
  };

  function rand(min, max) { return min + Math.random() * (max - min); }

  /* Where a particle is allowed to start.
     In the scene, leaves and petals are released from the two
     canopy zones (the left and right thirds, high up) rather
     than from anywhere on screen. Snow falls from the sky, so
     it uses the full width. The portal has no trees, so
     everything there simply enters from above. */
  function spawn(shape, inScene) {
    if (!inScene || shape === "snow") {
      return { x: rand(-4, 104), top: rand(-14, -2) };
    }
    var overhead = Math.random() < 0.18;
    if (overhead) return { x: rand(26, 74), top: rand(-8, 4) };
    var left = Math.random() < 0.5;
    return {
      x: left ? rand(-3, 33) : rand(67, 103),
      top: rand(4, 38)                 /* canopy height */
    };
  }

  /* ----------------------------------------------------------
     Sign-in scene particles.
     Leaves and petals are released from the real leaf clusters
     of the two trees (measured on screen), flutter down and come
     to rest on the grass before fading. Snow still falls from
     the sky, but now also settles on the ground instead of
     sliding off the bottom of the frame.
     ---------------------------------------------------------- */
  var sceneRoot = null;

  function sceneSize() {
    var w = sceneRoot ? sceneRoot.clientWidth : 0;
    var h = sceneRoot ? sceneRoot.clientHeight : 0;
    return { w: w || window.innerWidth, h: h || window.innerHeight };
  }

  /* every visible leaf mass of both trees, in scene pixels */
  function canopyTargets() {
    if (!sceneRoot) return [];
    var base = sceneRoot.getBoundingClientRect();
    if (!base.width || !base.height) return [];
    var out = [];
    var trees = sceneRoot.querySelectorAll(".sn-tree");
    Array.prototype.forEach.call(trees, function (tree) {
      var side = tree.classList.contains("sn-tree--l") ? 1 : -1;
      var masses = tree.querySelectorAll(".sn-canopy > ellipse");
      Array.prototype.forEach.call(masses, function (mass) {
        var r = mass.getBoundingClientRect();
        if (r.width < 3 || r.right < base.left + 6 || r.left > base.right - 6) return;
        out.push({
          x: Math.max(r.left, base.left) - base.left,
          y: r.top - base.top,
          w: Math.min(r.right, base.right) - Math.max(r.left, base.left),
          h: r.height,
          side: side
        });
      });
    });
    return out;
  }

  function fillSceneParticles(host, season) {
    host.textContent = "";
    if (REDUCED) return;

    var config = PARTICLES[season];
    var snow = config.shape === "snow";
    var windy = season === "winter";          /* winter: steady wind from the left */
    var size = sceneSize();
    var targets = snow ? [] : canopyTargets();
    var fragment = document.createDocumentFragment();

    for (var i = 0; i < config.login; i++) {
      var x, top, side = Math.random() < .5 ? 1 : -1;

      if (snow && windy) {
        /* the wind carries flakes rightwards, so they start further left */
        x = rand(-.5, .95) * size.w;
        top = rand(-.12, -.02) * size.h;
      } else if (snow) {
        x = rand(-.04, 1.04) * size.w;
        top = rand(-.12, -.02) * size.h;
      } else if (targets.length) {
        var t = targets[Math.floor(Math.random() * targets.length)];
        x = t.x + Math.random() * t.w;
        top = t.y + Math.random() * t.h;
        side = t.side;
      } else {
        /* layout not measurable yet (screen hidden) — near the trunks */
        x = (side > 0 ? rand(0, .16) : rand(.84, 1)) * size.w;
        top = rand(.36, .62) * size.h;
      }

      /* where it lands: somewhere on the strip of grass */
      var land = rand(.875, .985) * size.h;
      var drop = Math.max(70, land - top);
      var fall = rand(config.fall[0], config.fall[1]);
      var dur = snow ? fall * (drop / size.h) * 1.05
                     : Math.max(5, fall * (drop / size.h) * 1.7);

      /* leaves mostly drift away from their own tree, into the frame */
      var dir = snow ? (Math.random() < .5 ? -1 : 1)
                     : (Math.random() < .74 ? side : -side);
      var drift = rand(config.drift[0], config.drift[1]) * .75 * dir;
      if (windy) { drift = rand(.18, .42) * size.w; dur *= .85; }

      var particle = document.createElement("span");
      particle.className = windy ? "sn-p sn-p--wind" : snow ? "sn-p" : "sn-p sn-p--leaf";
      particle.style.cssText =
        "--p-x:"       + x.toFixed(1) + "px;" +
        "--p-top:"     + top.toFixed(1) + "px;" +
        "--p-size:"    + rand(config.size[0], config.size[1]).toFixed(1) + "px;" +
        "--p-dur:"     + dur.toFixed(2) + "s;" +
        "--p-delay:"   + (-rand(0, dur)).toFixed(2) + "s;" +
        "--p-drift:"   + drift.toFixed(0) + "px;" +
        "--p-sway:"    + rand(12, 30).toFixed(0) + "px;" +
        "--sn-drop:"   + drop.toFixed(0) + "px;" +
        "--p-opacity:" + rand(config.alpha[0], config.alpha[1]).toFixed(2) + ";";

      var shape = document.createElement("span");
      shape.className = "sn-p__shape sn-p__shape--" + config.shape;
      shape.style.setProperty("--p-spin", rand(config.spin[0], config.spin[1]).toFixed(2) + "s");
      if (Math.random() < .5) shape.style.animationDirection = "reverse";

      particle.appendChild(shape);
      fragment.appendChild(particle);
    }
    host.appendChild(fragment);
  }

  /* Builds the particle elements for one container. */
  function fillParticles(host, season, inScene) {
    if (inScene) { fillSceneParticles(host, season); return; }
    host.textContent = "";
    if (REDUCED) return;

    var config = PARTICLES[season];
    var count = inScene ? config.login : config.portal;
    /* over the portal the particles cross real content, so they are
       smaller and much fainter than the ones in the sign-in scene */
    var scale = inScene ? 1 : .78;
    var fade  = inScene ? 1 : .5;
    var fragment = document.createDocumentFragment();

    for (var i = 0; i < count; i++) {
      var at = spawn(config.shape, inScene);
      var size = rand(config.size[0], config.size[1]) * scale;
      var fall = rand(config.fall[0], config.fall[1]);

      var particle = document.createElement("span");
      particle.className = "sn-p";
      particle.style.cssText =
        "--p-x:"       + at.x.toFixed(2) + "%;" +
        "--p-top:"     + at.top.toFixed(2) + "%;" +
        "--p-size:"    + size.toFixed(1) + "px;" +
        "--p-dur:"     + fall.toFixed(2) + "s;" +
        /* negative delay: the fall is already in progress on the
           first frame, so nothing "starts" in unison */
        "--p-delay:"   + (-rand(0, fall)).toFixed(2) + "s;" +
        "--p-drift:"   + (rand(config.drift[0], config.drift[1]) * (Math.random() < .5 ? -1 : 1)).toFixed(0) + "px;" +
        "--p-opacity:" + (rand(config.alpha[0], config.alpha[1]) * fade).toFixed(2) + ";";

      var shape = document.createElement("span");
      shape.className = "sn-p__shape sn-p__shape--" + config.shape;
      shape.style.setProperty("--p-spin", rand(config.spin[0], config.spin[1]).toFixed(2) + "s");
      if (Math.random() < .5) shape.style.animationDirection = "reverse";

      particle.appendChild(shape);
      fragment.appendChild(particle);
    }
    host.appendChild(fragment);
  }

  /* How far a particle has to travel before it leaves the frame.
     Measured rather than guessed so the fall reads at any height. */
  function measureDrop(host) {
    var height = host.clientHeight || window.innerHeight;
    host.style.setProperty("--sn-drop", (height + 90) + "px");
  }


  /* ==========================================================
     4. TREE ARTWORK
     Two hand-drawn silhouettes. The trunk and limbs are painted
     with the season's bark colours, the canopy with its foliage
     colours; winter simply drops the canopy opacity and reveals
     the snow caps (both handled in season.css).
     ========================================================== */

  function limbs(paths) {
    return paths.map(function (p) {
      return '<path class="sn-limb" d="' + p[0] + '" stroke-width="' + p[1] + '"/>';
    }).join("");
  }

  /* A canopy is a handful of leaf masses. Each mass is scattered
     into many small ellipses in three tones, which reads as
     foliage; a single big blob reads as a bokeh circle. */
  function cluster(cx, cy, rx, ry, count) {
    var out = '<ellipse cx="' + cx + '" cy="' + cy + '" rx="' + rx +
              '" ry="' + ry + '" fill="var(--sn-leaf-3)" opacity=".5"/>';
    for (var i = 0; i < count; i++) {
      var angle = Math.random() * Math.PI * 2;
      var reach = Math.sqrt(Math.random());
      var x = cx + Math.cos(angle) * rx * reach * .82;
      var y = cy + Math.sin(angle) * ry * reach * .82;
      var r = rx * rand(.22, .40);
      var tone = Math.random() < .42 ? "2" : (Math.random() < .55 ? "1" : "3");
      out += '<ellipse cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) +
             '" rx="' + r.toFixed(1) + '" ry="' + (r * rand(.72, .92)).toFixed(1) +
             '" fill="var(--sn-leaf-' + tone + ')" opacity="' + rand(.62, .95).toFixed(2) + '"/>';
    }
    return out;
  }

  function canopy(masses) {
    return masses.map(function (m) {
      return cluster(m[0], m[1], m[2], m[3], m[4]);
    }).join("");
  }

  function caps(list) {
    return list.map(function (c) {
      return '<ellipse cx="' + c[0] + '" cy="' + c[1] + '" rx="' + c[2] + '" ry="' + c[3] + '"/>';
    }).join("");
  }

  /* left-hand tree — tall, leaning into the frame */
  var TREE_L =
    '<svg class="sn-tree sn-tree--l" viewBox="0 0 260 640" preserveAspectRatio="xMinYMax meet" aria-hidden="true">' +
      '<path class="sn-trunk" d="M58 640c4-74 10-138 19-188 5-32 7-58 7-82h15c0 26 3 52 8 84 8 50 16 112 20 186z"/>' +
      limbs([
        ["M86 452C104 438 124 428 142 420", 8],
        ["M88 476C74 462 58 452 40 444", 7],
        ["M85 404C104 384 122 370 140 356", 7],
        ["M84 386C70 366 58 350 46 332", 6],
        ["M86 356C88 322 90 296 92 268", 8],
        ["M90 316C108 300 124 288 138 274", 5.5],
        ["M89 296C75 278 64 264 54 248", 5],
        ["M92 268C94 242 96 224 98 204", 6],
        ["M95 236C112 222 124 210 134 196", 4.5],
        ["M94 222C80 208 70 196 62 182", 4],
        ["M98 204C100 186 102 172 104 158", 4.5],
        ["M101 180C114 170 122 160 130 150", 3],
        ["M100 166C90 156 84 148 78 138", 2.6]
      ]) +
      '<g class="sn-canopy">' +
        canopy([
          [126, 392, 54, 40, 16], [46, 404, 44, 32, 12],
          [136, 300, 48, 36, 14], [44, 292, 40, 30, 11],
          [104, 232, 52, 40, 15], [140, 214, 36, 28, 10],
          [62, 204, 34, 26, 9],   [104, 148, 42, 32, 12],
          [86, 330, 46, 34, 13],  [128, 156, 28, 22, 7]
        ]) +
        '<g class="sn-snow-caps">' +
          caps([[126, 366, 46, 12], [46, 380, 36, 10], [136, 276, 40, 11],
                [104, 206, 44, 12], [104, 126, 34, 10], [86, 306, 38, 10]]) +
        '</g>' +
      '</g>' +
    '</svg>';

  /* right-hand tree — broader, shorter, mirrored lean */
  var TREE_R =
    '<svg class="sn-tree sn-tree--r" viewBox="0 0 260 640" preserveAspectRatio="xMaxYMax meet" aria-hidden="true">' +
      '<path class="sn-trunk" d="M202 640c-4-74-10-138-19-188-5-32-7-58-7-82h-15c0 26-3 52-8 84-8 50-16 112-20 186z"/>' +
      limbs([
        ["M174 458C156 444 136 434 118 426", 8],
        ["M172 482C186 468 202 458 220 450", 7],
        ["M175 410C156 390 138 376 120 362", 7],
        ["M176 392C190 372 202 356 214 338", 6],
        ["M174 362C172 328 170 302 168 274", 8],
        ["M170 322C152 306 136 294 122 280", 5.5],
        ["M171 302C185 284 196 270 206 254", 5],
        ["M168 274C166 248 164 230 162 210", 6],
        ["M165 242C148 228 136 216 126 202", 4.5],
        ["M166 228C180 214 190 202 198 188", 4],
        ["M162 210C160 192 158 178 156 164", 4.5],
        ["M159 186C146 176 138 166 130 156", 3]
      ]) +
      '<g class="sn-canopy">' +
        canopy([
          [134, 398, 52, 38, 15], [214, 410, 42, 32, 11],
          [124, 306, 46, 34, 13], [216, 298, 38, 28, 10],
          [156, 238, 50, 38, 14], [120, 220, 34, 26, 9],
          [198, 210, 32, 24, 8],  [156, 156, 40, 30, 11],
          [174, 336, 44, 32, 12]
        ]) +
        '<g class="sn-snow-caps">' +
          caps([[134, 372, 44, 12], [214, 386, 34, 10], [124, 282, 38, 11],
                [156, 212, 42, 12], [156, 134, 32, 10], [174, 312, 36, 10]]) +
        '</g>' +
      '</g>' +
    '</svg>';


  /* ==========================================================
     4b. SCENE LIFE
     Everything here lives inside the scene, which sits BEHIND
     both sign-in panels, so none of it can pass over the text.
     Moving things leave one edge of the screen and come back in
     from the other.
     ========================================================== */

  /* --- distant treeline on the hills (static) ---
     [left %, height %, kind, bottom %] */
  var FAR_TREES = [
    [3, 8.5, "pine", 13.6],  [7.5, 6.5, "round", 14], [15, 9.5, "round", 13.4],
    [21, 7, "pine", 13.8],   [34, 6, "round", 14.4],  [46, 8, "pine", 14.2],
    [57, 6.5, "round", 14.4], [65, 9, "pine", 13.8],  [73, 7, "round", 14],
    [84, 9.5, "round", 13.4], [90.5, 7, "pine", 13.8]
  ];

  function farTree(t) {
    var style = 'style="left:' + t[0] + '%;height:' + t[1] + '%;--t-b:' + t[3] + '%"';
    if (t[2] === "pine") {
      return '<svg class="sn-far__tree" viewBox="0 0 40 60" ' + style + ' aria-hidden="true">' +
        '<rect class="sn-far__trunk" x="18.6" y="47" width="2.8" height="13" rx="1"/>' +
        '<g class="sn-far__needles">' +
          '<polygon points="20,1 29,19 11,19"/><polygon points="20,9 33,33 7,33"/>' +
          '<polygon points="20,20 37,50 3,50"/>' +
        '</g>' +
        '<g class="sn-far__snow">' +
          '<polygon points="20,1 23.6,8.2 16.4,8.2"/>' +
          '<ellipse cx="20" cy="19" rx="8.5" ry="1.6"/><ellipse cx="20" cy="33" rx="12" ry="1.8"/>' +
          '<ellipse cx="20" cy="50" rx="15.5" ry="2"/>' +
        '</g>' +
      '</svg>';
    }
    return '<svg class="sn-far__tree" viewBox="0 0 40 60" ' + style + ' aria-hidden="true">' +
      '<rect class="sn-far__trunk" x="18.4" y="30" width="3.2" height="30" rx="1"/>' +
      '<path class="sn-far__twig" d="M20 36L11 25M20 32L29 22M20 30L20 9M16 31L13 17M24 28L27 13"/>' +
      '<g class="sn-far__crown">' +
        '<circle cx="20" cy="20" r="12.5"/><circle cx="12.5" cy="27" r="9.5"/>' +
        '<circle cx="27.5" cy="27" r="9.5"/><circle cx="20" cy="29" r="10"/>' +
        '<circle class="sn-far__lit" cx="16.5" cy="16" r="6.5"/>' +
      '</g>' +
    '</svg>';
  }

  /* --- what each season adds --- */
  var LIFE = {
    spring: { clouds: 5, flock: "birds", flockDir: "r", butterflies: 7,
              wings: [["#F6B7CF", "#FFE3EE"], ["#F7D774", "#FFF3BF"], ["#B7A6F0", "#E6DEFF"]],
              balloon: false, gust: 0, fireflies: 8, dress: "flower" },
    summer: { clouds: 3, flock: "birds", flockDir: "l", butterflies: 5,
              wings: [["#F2994A", "#FFD39A"], ["#4FA3E0", "#C4E6FF"], ["#F7D774", "#FFF3BF"]],
              balloon: true, gust: 0, fireflies: 14, dress: "sun" },
    autumn: { clouds: 5, flock: "geese", flockDir: "l", butterflies: 0,
              balloon: false, gust: 7, gustShape: "leaf", fireflies: 0, dress: "leaf" },
    winter: { clouds: 7, flock: "birds", flockDir: "r", butterflies: 0,
              balloon: false, gust: 16, gustShape: "snow", fireflies: 0, dress: "",
              windLines: 7, cloudSpeed: 2.2 }
  };

  var cloudHost = null, airHost = null, nearHost = null, dressHost = null, rainHost = null;

  /* --- rare rain ---
     Chance of a rainy sky, rolled once per season per visit (a
     refresh rolls again). Winter never rains: it snows.
     To preview it, open the page with ?sn-weather=rain
     (or ?sn-weather=clear to force a dry sky). */
  var RAIN_CHANCE = {
    summer: [.06, .10],
    spring: [.03, .06],
    autumn: [0, .03],
    winter: [0, 0]
  };
  var weatherDraw = {};
  var weatherForce = (function () {
    var m = /[?&]sn-weather=(rain|clear)/.exec(window.location.search);
    return m ? m[1] : null;
  })();

  function weatherFor(season) {
    if (season === "winter") return "clear";
    if (weatherForce) return weatherForce;
    if (!weatherDraw[season]) {
      var range = RAIN_CHANCE[season];
      weatherDraw[season] = Math.random() < rand(range[0], range[1]) ? "rain" : "clear";
    }
    return weatherDraw[season];
  }

  /* a puffy cloud: a row of circles on a flat base, drawn twice —
     once shifted down in the shade colour, once on top in the lit colour */
  function cloudArt() {
    var n = 4 + Math.floor(Math.random() * 3);
    var shapes = '<ellipse cx="100" cy="62" rx="88" ry="15"/>';
    for (var i = 0; i < n; i++) {
      var t = i / (n - 1);
      var cx = 30 + t * 140 + rand(-7, 7);
      var r = 15 + 17 * (1 - Math.abs(t - .5) * 2) + rand(-3, 4);
      shapes += '<circle cx="' + cx.toFixed(1) + '" cy="' + (60 - r * .5).toFixed(1) +
                '" r="' + r.toFixed(1) + '"/>';
    }
    return '<svg viewBox="0 0 200 84" aria-hidden="true">' +
      '<g class="sn-cloud__shade" transform="translate(0 3)">' + shapes + '</g>' +
      '<g class="sn-cloud__body">' + shapes + '</g>' +
    '</svg>';
  }

  function buildClouds(count, W, speedMul, heavy) {
    var html = "";
    for (var i = 0; i < count; i++) {
      var depth = Math.random();                 /* 0 = far, 1 = near */
      var w = heavy ? 240 + depth * 220 : 120 + depth * 200;
      var top = heavy ? rand(-10, 22)            /* a low, full lid of cloud */
                      : 30 - depth * 24 + rand(-4, 4);   /* far clouds sit lower */
      var speed = (5 + depth * 12) * (speedMul || 1);    /* px per second */
      var dur = (W + w + 60) / speed;
      html += '<div class="sn-cloud" style="' +
        '--c-w:' + w.toFixed(0) + 'px;--c-top:' + top.toFixed(1) + '%;' +
        '--c-dur:' + dur.toFixed(1) + 's;--c-delay:' + (-rand(0, dur)).toFixed(1) + 's;' +
        '--c-op:' + (.55 + depth * .45).toFixed(2) + ';' +
        '--c-rest:' + (rand(-.08, .92) * W).toFixed(0) + 'px">' + cloudArt() + '</div>';
    }
    return html;
  }

  var BIRD = '<path d="M1 7Q6 1 12 7Q18 1 23 7"/>';

  function buildFlock(kind, dir, W) {
    var geese = kind === "geese";
    var n = geese ? 7 : 3 + Math.floor(Math.random() * 3);
    var bw = geese ? 22 : rand(13, 17);
    var birds = [], minY = 0, maxX = 0;

    for (var i = 0; i < n; i++) {
      var x, y;
      if (geese) {                               /* V formation, leader in front */
        var k = Math.ceil(i / 2), up = i % 2 ? -1 : 1;
        x = k * 24; y = k * 12 * up;
      } else {                                   /* loose group */
        x = i * rand(16, 28); y = rand(-14, 14);
      }
      if (dir === "r") x = -x;                   /* leader faces the way they fly */
      birds.push([x, y]);
      minY = Math.min(minY, y);
    }
    var minX = Math.min.apply(null, birds.map(function (b) { return b[0]; }));
    birds.forEach(function (b) { b[0] -= minX; b[1] -= minY; maxX = Math.max(maxX, b[0]); });

    var width = maxX + bw;
    var speed = geese ? rand(34, 44) : rand(42, 62);
    var dur = (W * 1.7 + width + 30) / speed;
    var html = '<div class="sn-flock sn-flock--' + dir + '" style="' +
      '--c-w:' + width.toFixed(0) + 'px;--c-top:' + rand(9, 24).toFixed(1) + '%;' +
      '--c-dur:' + dur.toFixed(1) + 's;--c-delay:' + (-rand(0, dur)).toFixed(1) + 's">' +
      '<div class="sn-flock__bob">';
    birds.forEach(function (b) {
      html += '<svg class="sn-bird" viewBox="0 0 24 12" style="' +
        'left:' + b[0].toFixed(0) + 'px;top:' + b[1].toFixed(0) + 'px;width:' + bw.toFixed(0) + 'px;' +
        '--b-flap:' + rand(.32, .5).toFixed(2) + 's;--b-delay:' + (-rand(0, .5)).toFixed(2) + 's">' +
        BIRD + '</svg>';
    });
    return html + '</div></div>';
  }

  function buildButterflies(count, colours, W) {
    var html = "";
    for (var i = 0; i < count; i++) {
      var c = colours[i % colours.length];
      var w = rand(16, 22);
      var dur = (W * 1.7 + w + 30) / rand(20, 32);
      html += '<div class="sn-bfly sn-bfly--' + (Math.random() < .5 ? "l" : "r") + '" style="' +
        '--c-w:' + w.toFixed(0) + 'px;--c-top:' + rand(56, 80).toFixed(1) + '%;' +
        '--c-dur:' + dur.toFixed(1) + 's;--c-delay:' + (-rand(0, dur)).toFixed(1) + 's;' +
        '--f-bob:' + rand(2.4, 4.2).toFixed(2) + 's;--bf-1:' + c[0] + ';--bf-2:' + c[1] + '">' +
        '<div class="sn-bfly__bob"><svg viewBox="0 0 20 16" aria-hidden="true">' +
          '<g class="sn-bfly__wing"><ellipse cx="5.6" cy="6" rx="5" ry="5.4"/><ellipse cx="7" cy="12" rx="3.2" ry="3"/></g>' +
          '<g class="sn-bfly__wing"><ellipse cx="14.4" cy="6" rx="5" ry="5.4"/><ellipse cx="13" cy="12" rx="3.2" ry="3"/></g>' +
          '<rect class="sn-bfly__body" x="9.4" y="3" width="1.2" height="11" rx=".6"/>' +
        '</svg></div></div>';
    }
    return html;
  }

  function buildBalloon(W) {
    var w = 44, dur = (W + w + 60) / 7;
    return '<div class="sn-balloon" style="--c-w:' + w + 'px;--c-top:' + rand(13, 21).toFixed(1) + '%;' +
      '--c-dur:' + dur.toFixed(1) + 's;--c-delay:' + (-rand(0, dur)).toFixed(1) + 's">' +
      '<div class="sn-balloon__bob"><svg viewBox="0 0 60 90" aria-hidden="true">' +
        '<path class="sn-balloon__env" d="M30 2C12 2 2 16 2 30c0 16 14 26 20 36h16c6-10 20-20 20-36C58 16 48 2 30 2z"/>' +
        '<path class="sn-balloon__stripe" d="M30 2c-9 8-11 38-5 64h10c6-26 4-56-5-64z"/>' +
        '<path class="sn-balloon__band" d="M4.5 40h51c-1.4 3.4-3.6 6.4-6 9h-39c-2.4-2.6-4.6-5.6-6-9z"/>' +
        '<path class="sn-balloon__rope" d="M23 66l2.4 11M37 66l-2.4 11"/>' +
        '<rect class="sn-balloon__basket" x="24" y="77" width="12" height="9" rx="1.6"/>' +
      '</svg></div></div>';
  }

  /* leaves or flakes caught by the wind, crossing the whole scene */
  function buildGust(count, shape, W) {
    var html = "";
    for (var i = 0; i < count; i++) {
      var s = shape === "snow" ? rand(3, 7) : rand(9, 15);
      var dur = (W * 1.7 + 60) / (shape === "snow" ? rand(55, 100) : rand(70, 120));
      html += '<div class="sn-gust" style="--c-w:' + s.toFixed(1) + 'px;' +
        '--c-top:' + rand(24, 82).toFixed(1) + '%;--c-dur:' + dur.toFixed(1) + 's;' +
        '--c-delay:' + (-rand(0, dur)).toFixed(1) + 's;--g-wave:' + rand(2.2, 4.4).toFixed(2) + 's;' +
        '--p-size:' + s.toFixed(1) + 'px;--p-spin:' + rand(1.6, 3.4).toFixed(2) + 's;' +
        'opacity:' + rand(.55, .9).toFixed(2) + '">' +
        '<div class="sn-gust__bob"><span class="sn-p__shape sn-p__shape--' + shape + '"></span></div></div>';
    }
    return html;
  }

  function buildFireflies(count) {
    var html = "";
    for (var i = 0; i < count; i++) {
      html += '<span class="sn-ff" style="left:' + rand(3, 97).toFixed(1) + '%;top:' + rand(58, 92).toFixed(1) + '%;' +
        '--ff-glow:' + rand(2.2, 4.6).toFixed(2) + 's;--ff-move:' + rand(5, 9).toFixed(2) + 's;' +
        '--ff-delay:' + (-rand(0, 6)).toFixed(2) + 's;' +
        '--ff-x:' + rand(-40, 40).toFixed(0) + 'px;--ff-y:' + rand(-30, 20).toFixed(0) + 'px"></span>';
    }
    return '<div class="sn-fireflies">' + html + '</div>';
  }

  /* little flowers or fallen leaves scattered on the grass (static) */
  function buildDress(kind) {
    if (!kind) return "";
    var html = "";
    var tones = kind === "leaf" ? ["var(--sn-leaf-1)", "var(--sn-leaf-2)", "var(--sn-leaf-3)"]
              : kind === "sun"  ? ["#F4D35E", "#FFFFFF", "#F2A65A"]
              : ["var(--sn-petal-1)", "var(--sn-petal-2)", "#FFFFFF", "#F7D774"];
    for (var i = 0; i < 24; i++) {
      html += '<span class="sn-dress__i sn-dress__i--' + kind + '" style="' +
        'left:' + rand(1, 99).toFixed(1) + '%;bottom:' + rand(8, 88).toFixed(0) + '%;' +
        '--d-c:' + tones[i % tones.length] + ';--d-r:' + rand(0, 360).toFixed(0) + 'deg;' +
        '--d-s:' + rand(.7, 1.3).toFixed(2) + '"></span>';
    }
    return html;
  }

  /* thin streaks of moving air (winter) */
  function buildWindLines(count, W) {
    var html = "";
    for (var i = 0; i < count; i++) {
      var w = rand(90, 220);
      var dur = (W * 1.7 + w + 30) / rand(320, 520);
      html += '<span class="sn-windline" style="--c-w:' + w.toFixed(0) + 'px;' +
        '--c-top:' + rand(18, 80).toFixed(1) + '%;--c-dur:' + dur.toFixed(2) + 's;' +
        '--c-delay:' + (-rand(0, dur)).toFixed(2) + 's;opacity:' + rand(.25, .55).toFixed(2) + '"></span>';
    }
    return html;
  }

  /* rain streaks + little splashes on the grass */
  function buildRain() {
    var html = "";
    for (var i = 0; i < 120; i++) {
      html += '<span class="sn-rdrop" style="left:' + rand(-5, 120).toFixed(1) + '%;' +
        '--r-len:' + rand(14, 26).toFixed(0) + 'px;--r-dur:' + rand(.5, .85).toFixed(2) + 's;' +
        '--r-delay:' + (-rand(0, 1)).toFixed(2) + 's;opacity:' + rand(.35, .75).toFixed(2) + '"></span>';
    }
    for (var j = 0; j < 16; j++) {
      html += '<span class="sn-splash" style="left:' + rand(2, 98).toFixed(1) + '%;' +
        'bottom:' + rand(1, 12).toFixed(1) + '%;--r-dur:' + rand(.7, 1.2).toFixed(2) + 's;' +
        '--r-delay:' + (-rand(0, 1.2)).toFixed(2) + 's"></span>';
    }
    return html;
  }

  function fillLife(season) {
    if (!cloudHost) return;
    var life = LIFE[season];
    var W = sceneSize().w;
    var rain = weatherFor(season) === "rain";
    root.setAttribute("data-sn-weather", rain ? "rain" : "clear");

    cloudHost.innerHTML = rain ? buildClouds(14, W, 1.6, true)
                               : buildClouds(life.clouds, W, life.cloudSpeed);
    dressHost.innerHTML = buildDress(life.dress);

    if (REDUCED) {
      airHost.textContent = ""; nearHost.textContent = ""; rainHost.textContent = "";
      return;
    }

    /* in the rain the birds, balloon, butterflies and fireflies stay home */
    airHost.innerHTML = rain ? "" :
      buildFlock(life.flock, life.flockDir, W) +
      (life.balloon ? buildBalloon(W) : "");

    nearHost.innerHTML =
      (!rain && life.butterflies ? buildButterflies(life.butterflies, life.wings, W) : "") +
      (life.gust ? buildGust(life.gust, life.gustShape, W) : "") +
      (life.windLines ? buildWindLines(life.windLines, W) : "") +
      (!rain && life.fireflies ? buildFireflies(life.fireflies) : "");

    rainHost.innerHTML = rain ? buildRain() : "";
  }

  function measureScene() {
    if (!sceneRoot) return;
    var size = sceneSize();
    sceneRoot.style.setProperty("--sn-w", size.w + "px");
    sceneRoot.style.setProperty("--sn-h", size.h + "px");
  }


  /* ==========================================================
     5. MOUNTING
     ========================================================== */

  var sceneFall = null;   /* particle host inside the sign-in scene */
  var portalFall = null;  /* particle host over the portal */

  /* The scene is appended to <main class="auth"> — the whole
     sign-in screen — and is absolutely positioned, so it takes no
     part in that grid and cannot move either column. Both columns
     are then floated above it as glass panels. */
  function mountScene() {
    var panel = document.querySelector(".auth");
    if (!panel || panel.querySelector(".sn-scene")) return;

    var scene = document.createElement("div");
    scene.className = "sn-scene";
    scene.setAttribute("aria-hidden", "true");
    scene.innerHTML =
      '<div class="sn-sky"></div>' +
      '<div class="sn-stars"></div>' +
      '<div class="sn-meteor"></div>' +
      '<div class="sn-bloom"></div>' +
      '<div class="sn-orb"></div>' +
      '<div class="sn-overcast"></div>' +
      '<div class="sn-clouds" data-sn-clouds></div>' +
      '<div class="sn-air" data-sn-air></div>' +
      '<div class="sn-land">' +
        '<div class="sn-hills"></div>' +
        '<div class="sn-far">' + FAR_TREES.map(farTree).join("") + '</div>' +
        '<div class="sn-ground"></div>' +
        '<div class="sn-dress" data-sn-dress></div>' +
        '<div class="sn-snow-bed"></div>' +
        TREE_L + TREE_R +
      '</div>' +
      '<div class="sn-gloom"></div>' +
      '<div class="sn-near" data-sn-near></div>' +
      '<div class="sn-rain" data-sn-rain></div>' +
      '<div class="sn-fall" data-sn-fall></div>' +
      '<div class="sn-vignette"></div>';

    panel.insertBefore(scene, panel.firstChild);
    sceneRoot = scene;
    sceneFall = scene.querySelector("[data-sn-fall]");
    cloudHost = scene.querySelector("[data-sn-clouds]");
    airHost   = scene.querySelector("[data-sn-air]");
    nearHost  = scene.querySelector("[data-sn-near]");
    dressHost = scene.querySelector("[data-sn-dress]");
    rainHost  = scene.querySelector("[data-sn-rain]");
  }

  /* The portal gets particles only — no sky, no ground, no trees. */
  function mountPortal() {
    if (document.querySelector(".sn-portal")) return;
    var layer = document.createElement("div");
    layer.className = "sn-portal";
    layer.setAttribute("aria-hidden", "true");
    layer.innerHTML = '<div class="sn-fall" data-sn-portal-fall></div>';
    document.body.appendChild(layer);
    portalFall = layer.querySelector("[data-sn-portal-fall]");
  }


  /* ==========================================================
     6. SEASON PICKER
     ========================================================== */

  var GLYPH = {
    random: "\uD83C\uDFB2", current: "\uD83D\uDCC5",
    spring: "\uD83C\uDF38", summer: "\u2600\uFE0F",
    autumn: "\uD83C\uDF42", winter: "\u2744\uFE0F"
  };

  var picker, pickerGlyph;

  function mountPicker() {
    if (document.querySelector(".sn-picker")) return;

    picker = document.createElement("div");
    picker.className = "sn-picker";
    picker.innerHTML =
      '<span class="sn-picker__glyph" data-sn-glyph aria-hidden="true"></span>' +
      '<select class="sn-picker__select" aria-label="Background season">' +
        '<option value="random">' + GLYPH.random + ' Random</option>' +
        '<option value="current">' + GLYPH.current + ' Current season</option>' +
        '<option value="spring">' + GLYPH.spring + ' Spring</option>' +
        '<option value="summer">' + GLYPH.summer + ' Summer</option>' +
        '<option value="autumn">' + GLYPH.autumn + ' Autumn</option>' +
        '<option value="winter">' + GLYPH.winter + ' Winter</option>' +
      '</select>';

    document.body.appendChild(picker);
    pickerGlyph = picker.querySelector("[data-sn-glyph]");

    var select = picker.querySelector("select");
    select.value = mode;                       /* Current season is the default */
    select.addEventListener("change", function () {
      mode = select.value;                     /* stays until changed or reloaded */
      apply(true);
    });
  }


  /* ==========================================================
     7. APPLY, SCREEN WATCHER, CLOCK
     ========================================================== */

  var shownSeason = null;

  /* Writes the season and the hour onto <html>; season.css does
     the rest. Particles are rebuilt only when the season really
     changed, so the clock tick costs nothing. */
  function apply(force) {
    var season = resolveSeason();
    var band = timeOfDay(new Date());

    root.setAttribute("data-season", season);
    root.setAttribute("data-time", band);
    if (pickerGlyph) pickerGlyph.textContent = GLYPH[season];

    if (force || season !== shownSeason) {
      shownSeason = season;
      measureScene();
      fillLife(season);
      if (sceneFall)  { measureDrop(sceneFall);  fillParticles(sceneFall, season, true); }
      if (portalFall) { measureDrop(portalFall); fillParticles(portalFall, season, false); }
    }
  }

  /* Which screen is up. script.js toggles the hidden attribute on
     #login and #app; we only observe that, never change it. */
  function syncScreen() {
    var login = document.getElementById("login");
    var app = document.getElementById("app");
    var screen = "boot";
    if (login && !login.hidden) screen = "login";
    else if (app && !app.hidden) screen = "app";
    root.setAttribute("data-sn-screen", screen);

    /* the panel has no height while it is hidden, so measure on show,
       and re-release the leaves from where the trees really are */
    if (screen === "login" && sceneFall) measureDrop(sceneFall);
    if (screen === "login" && screen !== lastScreen && shownSeason) {
      measureScene();
      fillLife(shownSeason);
      if (sceneFall) fillParticles(sceneFall, shownSeason, true);
    }
    lastScreen = screen;
  }
  var lastScreen = null;

  function debounce(fn, ms) {
    var timer;
    return function () {
      clearTimeout(timer);
      timer = setTimeout(fn, ms);
    };
  }

  function start() {
    mountScene();
    mountPortal();
    mountPicker();
    apply(true);
    syncScreen();

    /* screen changes: boot -> login -> portal -> login */
    var watcher = new MutationObserver(syncScreen);
    ["login", "app"].forEach(function (id) {
      var node = document.getElementById(id);
      if (node) watcher.observe(node, { attributes: true, attributeFilter: ["hidden"] });
    });

    /* the hour rolls over on its own — no reload needed, and the
       season is left exactly as it was */
    setInterval(apply, 60000);

    var remeasure = debounce(function () {
      if (sceneFall)  measureDrop(sceneFall);
      /* the trees moved with the layout: re-aim the leaves at them */
      if (root.getAttribute("data-sn-screen") === "login" && shownSeason) {
        measureScene();
        fillLife(shownSeason);
        if (sceneFall) fillParticles(sceneFall, shownSeason, true);
      }
      if (portalFall) measureDrop(portalFall);
    }, 220);
    window.addEventListener("resize", remeasure, { passive: true });
    window.addEventListener("orientationchange", remeasure);

    /* stop animating in a background tab */
    document.addEventListener("visibilitychange", function () {
      if (document.hidden) root.setAttribute("data-sn-paused", "");
      else root.removeAttribute("data-sn-paused");
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
