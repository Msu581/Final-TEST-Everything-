/* ============================================================
   VERIFICATION SUITE — script.js
   ============================================================ */

/* ============================================================
   ▼▼▼  CONFIGURATION — THIS IS THE ONLY BLOCK YOU EDIT  ▼▼▼
   ============================================================ */

const CONFIG = {

  /* 1. Where each tool lives.
        These are now folders inside this same repository, so they are
        written as relative paths instead of full URLs. */
  TOOL_URLS: {
    allInOne:         "apps/allinone/",
    whiteVsOriginal:  "apps/white-vs-original/",
    consolidatedChecker: "apps/consolidated-checker/",
    provisional:      "apps/provisional/",
    trTruEligible:    "apps/tr-tru-eligible/"
  },

  /* Open the tools in a new tab (true) or in this tab (false). */
  OPEN_IN_NEW_TAB: false,

  /* 2. Sign-in credentials.
        NOTE: this is a shared team gate, not secure authentication.
        Anyone who can load this page can read these values in the
        page source. See "Security limitations" in README.md. */
  CREDENTIALS: [
    { id: "SuperAdmin123", password: "Medhavi@1238", display: "SuperAdmin123" },
    { id: "mahi", password: "Medhavi@128", display: "Mahi" },
    { id: "shubham", password: "Medhavi@128", display: "Shubham" }
    // add more team members here, same shape:
    // { id: "Exam02", password: "change-me", display: "Exam02" }
  ],

  /* 3. Organisation names shown in the header, footer and sign-in panel. */
  ORG_NAME: "Medhavi Skills University",
  ORG_UNIT: "Controller of Examinations",

  /* 4. Session behaviour. */
  SESSION_HOURS: 8,        // how long a session stays valid
  MAX_ATTEMPTS: 5,         // failed tries before a short cooldown
  LOCKOUT_SECONDS: 30
};

/* ============================================================
   ▲▲▲  END OF CONFIGURATION — no need to edit below  ▲▲▲
   ============================================================ */


const STORAGE_KEY  = "vsuite.session";
const ATTEMPTS_KEY = "vsuite.attempts";
const THEME_KEY    = "vsuite.theme";   // must match the inline script in index.html

const $  = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const el = {
  boot:      $("#boot"),
  login:     $("#login"),
  app:       $("#app"),
  slip:      $("#slip"),
  form:      $("#loginForm"),
  userId:    $("#userId"),
  password:  $("#password"),
  keep:      $("#keepSignedIn"),
  error:     $("#formError"),
  submit:    $("#submitBtn"),
  toggle:    $("#togglePassword"),
  stamp:     $("#stamp"),
  logout:    $("#logoutBtn"),
  menuBtn:   $("#menuBtn"),
  mobileNav: $("#mobileNav"),
  header:    $("#siteHeader"),

  // sign-in loading screen
  load:        $("#signinLoad"),
  loadTrack:   $("#signinTrack"),
  loadTruck:   $("#signinTruck"),
  loadWheelB:  $("#signinWheelBackSpin"),
  loadWheelF:  $("#signinWheelFrontSpin"),
  loadFill:    $("#signinRoadFill"),
  loadPct:     $("#signinPct"),
  loadText:    $("#signinText"),
  loadSub:     $("#signinSub"),
  loadSeal:    $("#signinSeal")
};

const prefersReducedMotion =
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const wait = (ms) => new Promise((r) => setTimeout(r, ms));


/* ------------------------------------------------------------
   Theme (light / dark)
   ------------------------------------------------------------ */

function readStoredTheme() {
  try {
    const value = localStorage.getItem(THEME_KEY);
    return value === "dark" || value === "light" ? value : null;
  } catch (_) {
    return null;
  }
}

/* Light is the default for this suite. The operating system's colour
   preference is deliberately ignored, so the page always opens in light
   mode unless the person has picked dark with the toggle before. */
function defaultTheme() {
  return "light";
}

function currentTheme() {
  return document.documentElement.getAttribute("data-theme") === "dark"
    ? "dark"
    : "light";
}

function syncThemeControls(theme) {
  const isDark = theme === "dark";
  $$("[data-theme-toggle]").forEach((btn) => {
    btn.setAttribute("aria-checked", String(isDark));
    btn.title = isDark ? "Switch to light theme" : "Switch to dark theme";
  });
}

function applyTheme(theme, animate) {
  const next = theme === "dark" ? "dark" : "light";
  const root = document.documentElement;

  if (animate && !prefersReducedMotion) {
    root.classList.add("theme-switching");
    window.setTimeout(() => root.classList.remove("theme-switching"), 320);
  }

  root.setAttribute("data-theme", next);
  syncThemeControls(next);
}

function wireTheme() {
  // the inline script in <head> has already set data-theme; just sync the UI
  syncThemeControls(currentTheme());

  $$("[data-theme-toggle]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const next = currentTheme() === "dark" ? "light" : "dark";
      applyTheme(next, true);
      try { localStorage.setItem(THEME_KEY, next); } catch (_) {}
    });
  });

  // the operating system's preference is not followed: with no stored
  // choice the suite stays in light mode
  if (!readStoredTheme() && currentTheme() !== defaultTheme()) {
    applyTheme(defaultTheme(), false);
  }
}


/* ------------------------------------------------------------
   Session handling
   ------------------------------------------------------------ */

function readSession() {
  for (const store of [localStorage, sessionStorage]) {
    try {
      const raw = store.getItem(STORAGE_KEY);
      if (!raw) continue;
      const data = JSON.parse(raw);
      if (!data || !data.user || !data.expires) continue;
      if (Date.now() > data.expires) {
        store.removeItem(STORAGE_KEY);
        return { expired: true };
      }
      return data;
    } catch (err) {
      try { store.removeItem(STORAGE_KEY); } catch (_) {}
    }
  }
  return null;
}

function writeSession(user, persist) {
  const data = {
    user,
    expires: Date.now() + CONFIG.SESSION_HOURS * 3600 * 1000
  };
  const store = persist ? localStorage : sessionStorage;
  try { store.setItem(STORAGE_KEY, JSON.stringify(data)); } catch (_) {}
}

function clearSession() {
  try { localStorage.removeItem(STORAGE_KEY); } catch (_) {}
  try { sessionStorage.removeItem(STORAGE_KEY); } catch (_) {}
}


/* ------------------------------------------------------------
   Screen switching
   ------------------------------------------------------------ */

function showLogin(message) {
  document.body.classList.remove("is-booting");
  el.boot.hidden = true;
  el.app.hidden = true;
  el.login.hidden = false;
  el.login.classList.remove("screen-out");
  el.stamp.classList.remove("is-on");
  el.form.reset();
  setPasswordVisible(false);
  window.scrollTo(0, 0);
  if (message) {
    showMessage(message.title, message.body, message.kind || "info");
  } else {
    hideMessage();
  }
  // focus the first field, but not on a fresh page load on mobile
  if (message) el.userId.focus();
}

function showPortal(user, animate) {
  document.body.classList.remove("is-booting");
  el.boot.hidden = true;
  el.login.hidden = true;
  el.app.hidden = false;
  $$("[data-current-user]").forEach((n) => { n.textContent = user; });
  if (animate && !prefersReducedMotion) {
    el.app.classList.add("is-entering");
    setTimeout(() => el.app.classList.remove("is-entering"), 600);
  }
  window.scrollTo(0, 0);
  updateHeaderState();
  wireReveals(); // run here: the elements have no layout while #app is hidden
}


/* ------------------------------------------------------------
   Messages (error + info)
   ------------------------------------------------------------ */

function showMessage(title, body, kind) {
  el.error.innerHTML = "";
  const strong = document.createElement("strong");
  strong.textContent = title;
  el.error.appendChild(strong);
  if (body) el.error.appendChild(document.createTextNode(body));
  el.error.hidden = false;
  el.error.classList.toggle("is-info", kind === "info");
}

function hideMessage() {
  el.error.hidden = true;
  el.error.textContent = "";
  el.error.classList.remove("is-info");
}


/* ------------------------------------------------------------
   Lockout after repeated failures
   ------------------------------------------------------------ */

function getAttempts() {
  try {
    return JSON.parse(sessionStorage.getItem(ATTEMPTS_KEY)) || { count: 0, until: 0 };
  } catch (_) {
    return { count: 0, until: 0 };
  }
}

function setAttempts(value) {
  try { sessionStorage.setItem(ATTEMPTS_KEY, JSON.stringify(value)); } catch (_) {}
}

function lockoutRemaining() {
  const { until } = getAttempts();
  return Math.max(0, Math.ceil((until - Date.now()) / 1000));
}

function startLockoutCountdown() {
  const tick = () => {
    const left = lockoutRemaining();
    if (left <= 0) {
      el.submit.disabled = false;
      $(".btn__label", el.submit).textContent = "Sign in";
      hideMessage();
      return;
    }
    el.submit.disabled = true;
    showMessage(
      "Too many attempts",
      `Wait ${left} second${left === 1 ? "" : "s"} before trying again.`,
      "error"
    );
    setTimeout(tick, 1000);
  };
  tick();
}


/* ------------------------------------------------------------
   Sign-in loading screen

   Runs only after the credentials have already been accepted, so it
   holds no authentication logic of its own. The truck drives through a
   scrolling landscape (parallax layers, fixed sun). It moves as one
   unit; the tyre circles are never transformed, only the small hub
   group inside each tyre rotates.
   ------------------------------------------------------------ */

const LOAD_DRIVE_MS   = 3000;   // truck crosses the road
const LOAD_CONFIRM_MS = 800;    // "Authenticated" is held on screen
const LOAD_FADE_MS    = 300;    // fade in, and fade into the portal
/* total from clicking Sign in ≈ 5.1s */

const LOAD_PHASES = [
  { at:  0, sub: "Preparing your session" },
  { at: 40, sub: "Checking access rights" },
  { at: 78, sub: "Almost ready" }
];

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/* scenery layers (parallax strips) inside the loading scene */
function sceneryLayers() {
  if (!el.load) return [];
  return Array.from(el.load.querySelectorAll("[data-parallax]")).map((node) => ({
    node,
    factor: parseFloat(node.dataset.parallax) || 0,
    drift:  parseFloat(node.dataset.drift)    || 0   // px/s of its own (clouds)
  }));
}

function paintScenery(layers, worldX, seconds) {
  for (const layer of layers) {
    const x = -(worldX * layer.factor + seconds * layer.drift);
    layer.node.style.backgroundPositionX = x.toFixed(1) + "px";
  }
}

function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }
function easeInCubic(t)  { return t * t * t; }

/*
   The drive, in three parts:
     0.00 – 0.20  truck rolls in from the left while the world speeds up
     0.20 – 0.82  truck cruises; trees, hills, mountains and road stream past
     0.82 – 1.00  truck accelerates away off the right edge
   The sun is never moved.
*/
const ENTER_END  = 0.20;
const EXIT_START = 0.82;
const WORLD_SPEED = 340;          // px/s of road passing under the truck at cruise
const WHEEL_RADIUS_PX = 9;        // in SVG units = px at desktop size

function driveTruck() {
  return new Promise((resolve) => {
    const truckWidth = el.loadTruck.getBoundingClientRect().width || 120;
    const trackWidth = el.loadTrack.getBoundingClientRect().width;
    const cruiseX = trackWidth * 0.40 + truckWidth * 0.5;   // parked a little left of centre
    const endX    = trackWidth + truckWidth * 1.1;           // just past the right edge
    const layers  = sceneryLayers();
    const svgScale = truckWidth / 120;                       // wheels shrink on mobile

    let lastSub = "";

    const paint = (progress, rotation) => {
      const pct = Math.round(progress * 100);
      el.loadFill.style.width = pct + "%";
      el.loadPct.textContent = pct + "%";

      const phase = LOAD_PHASES.filter((p) => pct >= p.at).pop();
      if (phase && phase.sub !== lastSub) {
        lastSub = phase.sub;
        el.loadSub.textContent = phase.sub;
      }

      if (rotation !== null) {
        el.loadWheelB.style.transform = `rotate(${rotation}deg)`;
        el.loadWheelF.style.transform = `rotate(${rotation}deg)`;
      }
    };

    const truckXAt = (t) => {
      if (t < ENTER_END)   return cruiseX * easeOutCubic(t / ENTER_END);
      if (t < EXIT_START)  return cruiseX;
      return cruiseX + (endX - cruiseX) * easeInCubic((t - EXIT_START) / (1 - EXIT_START));
    };
    const worldSpeedAt = (t) =>   // ramps up while the truck rolls in, then steady
      WORLD_SPEED * (t < ENTER_END ? 0.35 + 0.65 * easeOutCubic(t / ENTER_END) : 1);

    // reduced motion: a still landscape, truck parked on the road, progress only
    if (prefersReducedMotion) {
      el.loadTruck.style.transform = `translateX(${cruiseX}px)`;
      paintScenery(layers, 0, 0);
      const started = performance.now();
      const tick = () => {
        const t = Math.min((performance.now() - started) / LOAD_DRIVE_MS, 1);
        paint(t, null);
        if (t < 1) window.setTimeout(tick, 120);
        else resolve();
      };
      tick();
      return;
    }

    const started = performance.now();
    let last = started;
    let worldX = 0;        // how far the landscape has scrolled
    let ground = 0;        // distance the tyres have rolled (for wheel spin)
    let prevTruckX = 0;

    const frame = (now) => {
      const elapsed = now - started;
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      const t = Math.min(elapsed / LOAD_DRIVE_MS, 1);

      // landscape streams right-to-left behind the truck
      const v = worldSpeedAt(t);
      worldX += v * dt;
      paintScenery(layers, worldX, elapsed / 1000);

      // the whole vehicle moves together; a tiny bob sells the bumps in the road
      const x = truckXAt(t);
      const bob = Math.sin(elapsed / 90) * 0.8 + Math.sin(elapsed / 37) * 0.35;
      el.loadTruck.style.transform = `translate(${x.toFixed(1)}px, ${bob.toFixed(2)}px)`;

      // wheels turn by the real distance covered over the road
      ground += v * dt + Math.max(0, x - prevTruckX);
      prevTruckX = x;
      const rotation = (ground / (2 * Math.PI * WHEEL_RADIUS_PX * svgScale)) * 360;
      paint(t, rotation % 360);

      if (t < 1) requestAnimationFrame(frame);
      else resolve();
    };

    requestAnimationFrame(frame);
  });
}

function resetLoadingScreen() {
  el.load.classList.remove("is-on", "is-out");
  el.loadSeal.classList.remove("is-on");
  el.loadTruck.style.transform = "translateX(0)";
  el.loadWheelB.style.transform = "";
  el.loadWheelF.style.transform = "";
  paintScenery(sceneryLayers(), 0, 0);
  el.loadFill.style.width = "0%";
  el.loadPct.textContent = "0%";
  el.loadText.textContent = "Opening the verification suite";
  el.loadSub.textContent = LOAD_PHASES[0].sub;
}

async function runSigninLoader() {
  if (!el.load) return;   // markup missing: fall straight through to the portal

  resetLoadingScreen();
  el.load.hidden = false;
  void el.load.offsetWidth;      // commit the starting state before fading in
  el.load.classList.add("is-on");
  await wait(LOAD_FADE_MS);

  await driveTruck();

  // the truck has arrived: confirm in the space it left behind
  el.loadFill.style.width = "100%";
  el.loadPct.textContent = "100%";
  el.loadText.textContent = "Session ready";
  el.loadSub.textContent = "Verification complete";
  el.loadSeal.classList.add("is-on");

  await wait(LOAD_CONFIRM_MS);

  el.load.classList.add("is-out");
  await wait(LOAD_FADE_MS);
  el.load.hidden = true;
  el.load.classList.remove("is-on", "is-out");
}


/* ------------------------------------------------------------
   Sign-in
   ------------------------------------------------------------ */

function matchCredentials(id, password) {
  const cleanId = id.trim().toLowerCase();
  return CONFIG.CREDENTIALS.find(
    (c) => c.id.toLowerCase() === cleanId && c.password === password
  );
}

async function handleSubmit(event) {
  event.preventDefault();
  if (lockoutRemaining() > 0) return;

  const id = el.userId.value;
  const password = el.password.value;

  if (!id.trim() || !password) {
    showMessage("Missing details", " Enter both your staff ID and password.", "error");
    shake();
    return;
  }

  hideMessage();
  el.submit.disabled = true;
  el.submit.classList.add("is-busy");
  $(".btn__label", el.submit).textContent = "Checking…";

  await wait(450); // brief, deliberate pause so the state is readable

  const account = matchCredentials(id, password);

  if (!account) {
    const attempts = getAttempts();
    attempts.count += 1;
    if (attempts.count >= CONFIG.MAX_ATTEMPTS) {
      attempts.until = Date.now() + CONFIG.LOCKOUT_SECONDS * 1000;
      attempts.count = 0;
      setAttempts(attempts);
      el.submit.classList.remove("is-busy");
      startLockoutCountdown();
      shake();
      return;
    }
    setAttempts(attempts);
    el.submit.disabled = false;
    el.submit.classList.remove("is-busy");
    $(".btn__label", el.submit).textContent = "Sign in";
    showMessage(
      "Access denied",
      " Your ID or password is incorrect. Check your credentials and try again.",
      "error"
    );
    shake();
    el.password.value = "";
    el.password.focus();
    return;
  }

  setAttempts({ count: 0, until: 0 });
  writeSession(account.display || account.id, el.keep.checked);

  // signed in: hand over to the loading screen, then the portal
  $(".btn__label", el.submit).textContent = "Signing in…";
  const time = new Date();
  const stampMeta = $("[data-stamp-time]");
  if (stampMeta) {
    stampMeta.textContent = time.toLocaleString(undefined, {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit"
    });
  }

  if (!prefersReducedMotion) {
    el.login.classList.add("screen-out");
    await wait(300);
  }
  el.login.hidden = true;

  await runSigninLoader();

  el.submit.disabled = false;
  el.submit.classList.remove("is-busy");
  $(".btn__label", el.submit).textContent = "Sign in";
  showPortal(account.display || account.id, true);
}

function shake() {
  if (prefersReducedMotion) return;
  el.slip.classList.remove("is-shaking");
  void el.slip.offsetWidth; // restart the animation
  el.slip.classList.add("is-shaking");
}

function setPasswordVisible(visible) {
  el.password.type = visible ? "text" : "password";
  el.toggle.textContent = visible ? "Hide" : "Show";
  el.toggle.setAttribute("aria-pressed", String(visible));
  el.toggle.setAttribute("aria-label", visible ? "Hide password" : "Show password");
}

function handleLogout() {
  clearSession();
  closeMobileNav();
  showLogin({
    title: "Signed out",
    body: " Your session on this browser has ended.",
    kind: "info"
  });
}


/* ------------------------------------------------------------
   Tool links
   ------------------------------------------------------------ */

function wireToolLinks() {
  $$("[data-tool]").forEach((link) => {
    const key = link.dataset.tool;
    const url = CONFIG.TOOL_URLS[key];
    const unset = !url || url.indexOf("PASTE_") === 0 || url === "#";

    if (unset) {
      link.setAttribute("aria-disabled", "true");
      link.removeAttribute("href");
      link.title = "Add this tool's URL in the CONFIG block of script.js";
      return;
    }

    link.href = url;
    if (CONFIG.OPEN_IN_NEW_TAB) {
      link.target = "_blank";
      link.rel = "noopener noreferrer";
    } else {
      link.removeAttribute("target");
    }
  });
}


/* ------------------------------------------------------------
   Navigation
   ------------------------------------------------------------ */

function wireNavigation() {
  $$("[data-nav]").forEach((link) => {
    link.addEventListener("click", (event) => {
      const id = link.getAttribute("href");
      const target = id && id.startsWith("#") ? $(id) : null;
      if (!target) return;
      event.preventDefault();
      closeMobileNav();
      target.scrollIntoView({
        behavior: prefersReducedMotion ? "auto" : "smooth",
        block: "start"
      });
      history.replaceState(null, "", id);
    });
  });

  el.menuBtn.addEventListener("click", () => {
    const open = el.menuBtn.getAttribute("aria-expanded") === "true";
    open ? closeMobileNav() : openMobileNav();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeMobileNav();
  });

  // active section indicator
  const sections = $$("main section[id]", el.app);
  if ("IntersectionObserver" in window && sections.length) {
    const spy = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const id = "#" + entry.target.id;
        $$(".nav__link").forEach((link) => {
          link.classList.toggle("is-active", link.getAttribute("href") === id);
        });
      });
    }, { rootMargin: "-45% 0px -50% 0px", threshold: 0 });
    sections.forEach((section) => spy.observe(section));
  }
}

function openMobileNav() {
  el.mobileNav.hidden = false;
  el.mobileNav.dataset.open = "true";
  el.menuBtn.setAttribute("aria-expanded", "true");
  el.menuBtn.setAttribute("aria-label", "Close menu");
}

function closeMobileNav() {
  el.mobileNav.dataset.open = "false";
  el.mobileNav.hidden = true;
  el.menuBtn.setAttribute("aria-expanded", "false");
  el.menuBtn.setAttribute("aria-label", "Open menu");
}


/* ------------------------------------------------------------
   Header: compact state once the page is scrolled
   ------------------------------------------------------------ */

function updateHeaderState() {
  if (!el.header) return;
  el.header.classList.toggle("is-scrolled", window.scrollY > 8);
}

function wireHeaderScroll() {
  if (!el.header) return;
  let queued = false;
  window.addEventListener("scroll", () => {
    if (queued) return;
    queued = true;
    window.requestAnimationFrame(() => {
      updateHeaderState();
      queued = false;
    });
  }, { passive: true });
  updateHeaderState();
}


/* ------------------------------------------------------------
   Scroll reveals
   ------------------------------------------------------------ */

let revealsStarted = false;

function wireReveals() {
  if (revealsStarted) return;
  revealsStarted = true;

  const items = $$(".reveal");
  if (prefersReducedMotion || !("IntersectionObserver" in window)) {
    items.forEach((item) => item.classList.add("is-in"));
    return;
  }

  // safety net: nothing stays invisible if the observer never fires
  setTimeout(() => {
    items.forEach((item) => {
      if (item.getBoundingClientRect().top < window.innerHeight) {
        item.classList.add("is-in");
      }
    });
  }, 1200);
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry, index) => {
      if (!entry.isIntersecting) return;
      setTimeout(() => entry.target.classList.add("is-in"), index * 70);
      observer.unobserve(entry.target);
    });
  }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
  items.forEach((item) => observer.observe(item));
}


/* ------------------------------------------------------------
   Small details: logo fallback, org names, serial, year
   ------------------------------------------------------------ */

function wireLogo() {
  $$("[data-logo]").forEach((img) => {
    const fallback = img.parentElement.querySelector("[data-logo-fallback]");
    const useFallback = () => {
      img.style.display = "none";
      if (fallback) fallback.hidden = false;
    };
    img.addEventListener("error", useFallback);
    if (img.complete && img.naturalWidth === 0) useFallback();
  });
}

function wireStaticText() {
  $$("[data-org-name]").forEach((n) => { n.textContent = CONFIG.ORG_NAME; });
  $$("[data-org-unit]").forEach((n) => { n.textContent = CONFIG.ORG_UNIT; });
  $$("[data-year]").forEach((n) => { n.textContent = new Date().getFullYear(); });

  // monogram shown only while assets/logo.png is missing
  const initials = CONFIG.ORG_NAME
    .split(/\s+/).map((w) => w[0]).join("").slice(0, 3).toUpperCase();
  $$("[data-logo-fallback]").forEach((n) => { n.textContent = initials; });

  const serial = $("[data-serial]");
  if (serial) {
    const now = new Date();
    const stamp =
      String(now.getFullYear()).slice(2) +
      String(now.getMonth() + 1).padStart(2, "0") +
      String(now.getDate()).padStart(2, "0");
    serial.textContent = "COE / " + stamp;
  }
}


/* ------------------------------------------------------------
   Start
   ------------------------------------------------------------ */

function init() {
  wireTheme();
  wireLogo();
  wireStaticText();
  wireToolLinks();
  wireNavigation();
  wireHeaderScroll();

  el.form.addEventListener("submit", handleSubmit);
  el.toggle.addEventListener("click", () => {
    setPasswordVisible(el.password.type === "password");
  });
  el.logout.addEventListener("click", handleLogout);
  $$("[data-logout]").forEach((btn) => btn.addEventListener("click", handleLogout));

  // clear the error as soon as the person starts correcting it
  [el.userId, el.password].forEach((input) => {
    input.addEventListener("input", () => {
      if (!el.error.hidden && lockoutRemaining() === 0) hideMessage();
    });
  });

  const session = readSession();

  if (session && session.user) {
    showPortal(session.user, false);
  } else if (session && session.expired) {
    showLogin({
      title: "Session expired",
      body: " Sign in again to open the suite.",
      kind: "info"
    });
  } else {
    showLogin(null);
  }

  if (lockoutRemaining() > 0) startLockoutCountdown();
}

document.addEventListener("DOMContentLoaded", init);
