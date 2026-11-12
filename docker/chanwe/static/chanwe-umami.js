/*
 * Chanwines (2026-11-12, as in Espacios' src/analytics.ts): names the Wiki's Umami session with the signed-in
 * person's Identity subject, so Espacios' collector can credit their web minutes. Outline's own Umami integration
 * loads the tracker; this asks the Wiki for the subject (GET /auth/chanwe.subject, configure-outline-release.cjs)
 * once per page load and calls umami.identify(subject) once the tracker is there. Never inside the desktop app, which
 * counts its own minutes (its tabs stay anonymous), and only on the Wiki's host. Nothing else is sent: no email, no
 * name.
 */
(function () {
  "use strict";

  var HOSTS = ["wiki.chanwe.ar"];

  function tracked(win) {
    return HOSTS.indexOf(String(win.location.hostname).toLowerCase()) !== -1;
  }

  /** True when it identified. */
  function identify(subject, win) {
    if (!subject || win.__CHANWE_DESKTOP__) return false;
    if (!tracked(win)) return false;
    if (!win.umami || typeof win.umami.identify !== "function") return false;
    win.umami.identify(subject);
    return true;
  }

  /** Waits for the tracker (Outline adds it once its app has started; at most 30 s), then identifies. */
  function identifyWhenReady(subject, win, wait) {
    wait = wait || function (ms) { return new Promise(function (resolve) { setTimeout(resolve, ms); }); };
    var tries = 0;
    function attempt() {
      if (identify(subject, win)) return Promise.resolve(true);
      if (win.__CHANWE_DESKTOP__ || !subject || ++tries >= 60) return Promise.resolve(false);
      return wait(500).then(attempt);
    }
    return attempt();
  }

  function start(win, wait) {
    if (win.__CHANWE_DESKTOP__ || !tracked(win) || typeof win.fetch !== "function") return Promise.resolve(false);
    return win
      .fetch("/auth/chanwe.subject", { credentials: "same-origin", headers: { Accept: "application/json" } })
      .then(function (response) { return response.ok ? response.json() : null; })
      .then(function (body) {
        var subject = body && typeof body.subject === "string" ? body.subject : "";
        return subject ? identifyWhenReady(subject, win, wait) : false;
      })
      .catch(function () { return false; });
  }

  if (typeof module === "object" && module.exports) {
    module.exports = { identify: identify, identifyWhenReady: identifyWhenReady, start: start };
  } else {
    start(window);
  }
})();
