/*
 * CHANWE app veil: the hand-off between apps. A paper screen with the app's
 * orange icon covers the page while it starts, then fades away; leaving for
 * another app shows the same screen with that app's icon, so the two meet in
 * the middle and the jump between domains reads as one movement.
 *
 * Load it as a classic, blocking script, first thing in <body>, so the veil
 * is up before the first paint:
 *
 *   <script src="/brand/app-veil.js" data-icon="/favicon.svg" data-label="Portal Clientes"></script>
 *
 * data-wait   hold the veil until the app calls window.cwVeil.done()
 *             (capped at 4 s); without it the veil lifts on window load.
 *
 * It shows on the first load of the app in a tab, and on every arrival from
 * another site (another CHANWE app, Identity). A reload or back/forward never
 * shows it, and neither does prefers-reduced-motion.
 *
 * Leaving: window.cwVeil.leave(href, { icon, label }), or any same-tab link
 * with data-cw-veil-icon (and optional data-cw-veil-label) does it on click.
 *
 * Copies live in each app's public folder (see brand/consumers.json); edit
 * here and run `npm run brand:sync -- --write`.
 */
(function () {
  if (window.cwVeil) return;
  var script = document.currentScript;
  // Configuration sits on the script tag; an app that cannot set attributes
  // there (PDrive adds its scripts itself) uses <meta name="cw-veil-icon">,
  // "cw-veil-label" and "cw-veil-wait" instead.
  var meta = function (name) { var element = document.querySelector('meta[name="cw-veil-' + name + '"]'); return element ? element.getAttribute("content") : undefined; };
  var dataset = script && script.dataset ? script.dataset : {};
  var config = { icon: dataset.icon || meta("icon"), label: dataset.label || meta("label"), wait: dataset.wait !== undefined ? dataset.wait : meta("wait") };
  var reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  // From the start of the navigation, the veil stays at least this long, and
  // at least HOLD_MS once it is on screen (a deferred script puts it up late).
  var MIN_VISIBLE_MS = 900;
  var HOLD_MS = 450;
  var FADE_MS = 650;
  var LEAVE_MS = 450;
  var WAIT_CAP_MS = 4000;

  var css =
    ".cw-veil{position:fixed;inset:0;z-index:2147483000;display:grid;place-items:center;background:var(--cw-brand-paper,#F8FAFC);opacity:1;transition:opacity " + FADE_MS + "ms cubic-bezier(.22,1,.36,1);pointer-events:auto}" +
    ".cw-veil.is-leaving{transition-duration:380ms}" +
    ".cw-veil.is-entering{opacity:0}" +
    ".cw-veil.is-out{opacity:0;pointer-events:none}" +
    ".cw-veil__stack{display:grid;justify-items:center;gap:16px;animation:cw-veil-in 700ms cubic-bezier(.22,1,.36,1) both}" +
    ".cw-veil__icon{width:56px;height:56px;display:block;border-radius:15px;box-shadow:0 12px 32px rgba(253,56,16,.18);transition:transform " + FADE_MS + "ms cubic-bezier(.22,1,.36,1)}" +
    ".cw-veil.is-out .cw-veil__icon{transform:scale(1.06)}" +
    ".cw-veil__label{font:500 11px/1.4 'JetBrains Mono',ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.14em;text-transform:uppercase;color:var(--cw-brand-fg-muted,#475569)}" +
    ".cw-veil__line{position:relative;width:120px;height:1px;overflow:hidden;background:rgba(253,56,16,.22)}" +
    ".cw-veil__line::after{content:'';position:absolute;inset:0;background:linear-gradient(90deg,transparent,var(--cw-brand-primary,#FD3810),transparent);transform:translateX(-100%);animation:cw-veil-run 1.1s cubic-bezier(.45,.05,.55,.95) infinite}" +
    "@keyframes cw-veil-in{from{opacity:0;transform:translateY(6px) scale(.96)}}" +
    "@keyframes cw-veil-run{to{transform:translateX(100%)}}";

  var veil = null;
  var lifted = false;
  var shownAt = 0;
  var safety = 0;

  function injectStyle() {
    if (document.getElementById("cw-veil-style")) return;
    var style = document.createElement("style");
    style.id = "cw-veil-style";
    style.textContent = css;
    (document.head || document.documentElement).appendChild(style);
  }

  function build(icon, label) {
    injectStyle();
    var element = document.createElement("div");
    element.className = "cw-veil";
    element.setAttribute("aria-hidden", "true");
    var stack = document.createElement("div");
    stack.className = "cw-veil__stack";
    if (icon) {
      var image = document.createElement("img");
      image.className = "cw-veil__icon";
      image.src = icon;
      image.alt = "";
      stack.appendChild(image);
    }
    if (label) {
      var text = document.createElement("span");
      text.className = "cw-veil__label";
      text.textContent = label;
      stack.appendChild(text);
    }
    var line = document.createElement("span");
    line.className = "cw-veil__line";
    stack.appendChild(line);
    element.appendChild(stack);
    (document.body || document.documentElement).appendChild(element);
    shownAt = performance.now();
    return element;
  }

  function remove(element) {
    if (element && element.parentNode) element.parentNode.removeChild(element);
  }

  function lift() {
    if (lifted || !veil) return;
    lifted = true;
    clearTimeout(safety);
    var element = veil;
    var now = performance.now();
    var wait = Math.max(0, MIN_VISIBLE_MS - now, HOLD_MS - (now - shownAt));
    setTimeout(function () {
      element.classList.add("is-out");
      setTimeout(function () { remove(element); if (veil === element) veil = null; }, FADE_MS + 40);
    }, wait);
  }

  function navigationType() {
    var entry = performance.getEntriesByType && performance.getEntriesByType("navigation")[0];
    return entry ? entry.type : "navigate";
  }

  function arrivedFromAnotherSite() {
    if (!document.referrer) return false;
    try { return new URL(document.referrer).origin !== location.origin; } catch (error) { return false; }
  }

  function firstInThisTab() {
    try {
      if (sessionStorage.getItem("cw-veil-seen")) return false;
      sessionStorage.setItem("cw-veil-seen", "1");
      return true;
    } catch (error) {
      return false;
    }
  }

  function shouldShowOnArrival() {
    if (reduced) return false;
    var type = navigationType();
    var first = firstInThisTab();
    if (type === "reload" || type === "back_forward") return false;
    return first || arrivedFromAnotherSite();
  }

  function leave(href, options) {
    if (reduced) { location.assign(href); return; }
    options = options || {};
    remove(veil);
    lifted = false;
    veil = build(options.icon, options.label);
    veil.classList.add("is-leaving", "is-entering");
    // Two frames so the browser paints the transparent veil before it fades in.
    requestAnimationFrame(function () { requestAnimationFrame(function () { if (veil) veil.classList.remove("is-entering"); }); });
    setTimeout(function () { location.assign(href); }, LEAVE_MS);
    // If the navigation never happens (a download, a blocked URL), give the page back.
    clearTimeout(safety);
    safety = setTimeout(lift, 8000);
  }

  function onClick(event) {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    var link = event.target instanceof Element ? event.target.closest("a[data-cw-veil-icon]") : null;
    if (!link || !link.href || link.hasAttribute("download")) return;
    var target = link.getAttribute("target");
    if (target && target !== "_self") return;
    event.preventDefault();
    leave(link.href, { icon: link.getAttribute("data-cw-veil-icon"), label: link.getAttribute("data-cw-veil-label") || "" });
  }

  if (shouldShowOnArrival()) {
    veil = build(config.icon, config.label);
    safety = setTimeout(lift, config.wait !== undefined ? WAIT_CAP_MS : WAIT_CAP_MS * 2);
    if (config.wait === undefined) {
      if (document.readyState === "complete") lift();
      else window.addEventListener("load", lift, { once: true });
    }
  }

  document.addEventListener("click", onClick);
  // Back to a page kept in the back/forward cache: drop the leaving veil.
  window.addEventListener("pageshow", function (event) {
    if (event.persisted && veil) { lifted = false; lift(); }
  });

  window.cwVeil = { done: lift, leave: leave };
})();
