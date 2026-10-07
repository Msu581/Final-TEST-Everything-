/* ============================================================
   PORTAL BAR — shared "Back to portal" / "Log out" control
   ============================================================

   This file is loaded by the tool pages with a single <script>
   line at the end of each one. It adds a small floating control
   in the bottom-right corner.

   It is deliberately self-contained:

   - All of its HTML and CSS live inside a Shadow DOM, so none of
     the tool's own styling can affect this bar, and none of this
     bar's styling can leak into the tool.
   - It defines no global variables and touches no existing
     element on the page.
   - Removing the one <script> line from a tool restores that tool
     to its exact original state.

   TO MOVE THE BAR: change BOTTOM / RIGHT below.
   TO CHANGE THE COLOURS: change ACCENT / ACCENT_DARK below.
   ============================================================ */

(function () {
  "use strict";

  /* ---- settings you can safely edit ---- */
  var BOTTOM      = "18px";       // distance from the bottom of the screen
  var RIGHT       = "18px";       // distance from the right of the screen
  var ACCENT      = "#501c15";    // MSU maroon
  var ACCENT_DARK = "#3a130e";    // hover shade
  var PORTAL_URL  = "../../";     // the sign-in portal, relative to a tool
  var SESSION_KEY = "vsuite.session";   // must match STORAGE_KEY in script.js
  /* -------------------------------------- */

  if (window.__msuPortalBar) return;   // never inject twice
  window.__msuPortalBar = true;

  function start() {
    var host = document.createElement("div");
    host.id = "msu-portal-bar";
    host.style.all = "initial";
    host.style.position = "fixed";
    host.style.bottom = BOTTOM;
    host.style.right = RIGHT;
    host.style.zIndex = "2147483000";

    var root = host.attachShadow ? host.attachShadow({ mode: "open" }) : host;

    var style = document.createElement("style");
    style.textContent = [
      ":host, * { box-sizing: border-box; }",
      ".wrap {",
      "  display: flex; align-items: stretch; gap: 1px;",
      "  font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;",
      "  border-radius: 999px; overflow: hidden;",
      "  box-shadow: 0 4px 16px rgba(0,0,0,.35);",
      "}",
      "button {",
      "  border: 0; cursor: pointer; color: #fff;",
      "  background: " + ACCENT + ";",
      "  font-size: 13px; font-weight: 600; letter-spacing: .2px;",
      "  padding: 10px 16px; line-height: 1;",
      "  transition: background .15s ease;",
      "}",
      "button:hover  { background: " + ACCENT_DARK + "; }",
      "button:focus-visible { outline: 2px solid #b28a34; outline-offset: 2px; }",
      ".out { background: #6b2018; }",
      ".out:hover { background: #4d150f; }",
      "@media (max-width: 520px) { button { padding: 9px 12px; font-size: 12px; } }",
      "@media print { .wrap { display: none; } }"
    ].join("\n");

    var wrap = document.createElement("div");
    wrap.className = "wrap";

    var back = document.createElement("button");
    back.type = "button";
    back.textContent = "\u2190 Portal";
    back.title = "Return to the portal without signing out";
    back.addEventListener("click", function () {
      window.location.href = PORTAL_URL;
    });

    var out = document.createElement("button");
    out.type = "button";
    out.className = "out";
    out.textContent = "Log out";
    out.title = "End the session and return to the sign-in page";
    out.addEventListener("click", function () {
      try { localStorage.removeItem(SESSION_KEY); } catch (e) {}
      try { sessionStorage.removeItem(SESSION_KEY); } catch (e) {}
      window.location.href = PORTAL_URL;
    });

    wrap.appendChild(back);
    wrap.appendChild(out);
    root.appendChild(style);
    root.appendChild(wrap);
    document.body.appendChild(host);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
